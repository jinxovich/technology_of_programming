"""API новостного сайта.

Маршрут публикации: назначена -> на проверке -> (на доработке -> на проверке) -> на сайте.
"""
import sqlite3
import uuid

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import db
import models
from models import ROLES, User, hash_pw

app = FastAPI(title="Новостной сайт")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
db.init()

SESSIONS: dict[str, int] = {}

USER_SQL = "SELECT u.*, d.name AS department FROM users u LEFT JOIN departments d ON d.id = u.department_id"
TOPIC_SQL = "SELECT t.*, d.name AS department FROM topics t JOIN departments d ON d.id = t.department_id"
PUB_SQL = """
SELECT p.*, t.title AS topic, t.department_id, d.name AS department, u.full_name AS author
FROM publications p
JOIN topics t ON t.id = p.topic_id
JOIN departments d ON d.id = t.department_id
LEFT JOIN users u ON u.id = p.author_id
"""


class LoginIn(BaseModel):
    username: str
    password: str


class UserIn(BaseModel):
    username: str
    password: str
    full_name: str
    role: str
    department_id: int | None = None


class UserPatch(BaseModel):
    full_name: str
    role: str
    department_id: int | None = None


class NameIn(BaseModel):
    name: str


class TopicIn(BaseModel):
    title: str
    department_id: int


class PublicationIn(BaseModel):
    topic_id: int
    title: str
    author_id: int


class PublicationPatch(BaseModel):
    title: str
    body: str


class NoteIn(BaseModel):
    note: str


@app.exception_handler(sqlite3.IntegrityError)
def on_integrity_error(_request, _exc) -> JSONResponse:
    return JSONResponse({"detail": "Такая запись уже есть"}, status_code=400)


def current_user(authorization: str = Header("")) -> User:
    user_id = SESSIONS.get(authorization.removeprefix("Bearer ").strip())
    found = db.row(USER_SQL + " WHERE u.id = ?", (user_id,)) if user_id else None
    if not found:
        raise HTTPException(401, "Требуется вход")
    return models.from_row(found)


def need(permission: str):
    def dependency(user: User = Depends(current_user)) -> User:
        if permission not in user.can:
            raise HTTPException(403, "Недостаточно прав")
        return user

    return dependency


def check_role(role: str, department_id: int | None) -> None:
    if role not in ROLES:
        raise HTTPException(400, "Неизвестная должность")
    if ROLES[role].needs_department and not department_id:
        raise HTTPException(400, "Для этой должности нужно указать отдел")


def get_publication(publication_id: int) -> dict:
    found = db.row(PUB_SQL + " WHERE p.id = ?", (publication_id,))
    if not found:
        raise HTTPException(404, "Публикация не найдена")
    return found


def check_department(user: User, publication: dict) -> None:
    if publication["department_id"] != user.department_id:
        raise HTTPException(403, "Публикация другого отдела")


# --- вход -----------------------------------------------------------------


@app.post("/api/login")
def login(data: LoginIn) -> dict:
    found = db.row(USER_SQL + " WHERE u.username = ? AND u.password = ?", (data.username, hash_pw(data.password)))
    if not found:
        raise HTTPException(401, "Неверный логин или пароль")
    token = uuid.uuid4().hex
    SESSIONS[token] = found["id"]
    return {"token": token, "user": models.from_row(found).public()}


@app.get("/api/me")
def me(user: User = Depends(current_user)) -> dict:
    return user.public()


# --- отделы и сотрудники (администратор) ----------------------------------


@app.get("/api/departments")
def departments() -> list[dict]:
    return db.rows("SELECT * FROM departments ORDER BY name")


@app.post("/api/departments")
def add_department(data: NameIn, _: User = Depends(need("users"))) -> list[dict]:
    db.run("INSERT INTO departments (name) VALUES (?)", (data.name,))
    return departments()


@app.get("/api/users")
def users(_: User = Depends(need("users"))) -> list[dict]:
    return [models.from_row(r).public() for r in db.rows(USER_SQL + " ORDER BY u.full_name")]


@app.post("/api/users")
def add_user(data: UserIn, _: User = Depends(need("users"))) -> dict:
    check_role(data.role, data.department_id)
    if db.row("SELECT 1 FROM users WHERE username = ?", (data.username,)):
        raise HTTPException(400, "Логин уже занят")
    user_id = db.run(
        "INSERT INTO users (username, password, full_name, role, department_id) VALUES (?, ?, ?, ?, ?)",
        (data.username, hash_pw(data.password), data.full_name, data.role, data.department_id),
    )
    return models.from_row(db.row(USER_SQL + " WHERE u.id = ?", (user_id,))).public()


@app.patch("/api/users/{user_id}")
def update_user(user_id: int, data: UserPatch, _: User = Depends(need("users"))) -> dict:
    check_role(data.role, data.department_id)
    db.run(
        "UPDATE users SET full_name = ?, role = ?, department_id = ? WHERE id = ?",
        (data.full_name, data.role, data.department_id, user_id),
    )
    return models.from_row(db.row(USER_SQL + " WHERE u.id = ?", (user_id,))).public()


@app.delete("/api/users/{user_id}")
def delete_user(user_id: int, user: User = Depends(need("users"))) -> dict:
    if user_id == user.id:
        raise HTTPException(400, "Нельзя удалить самого себя")
    db.run("UPDATE publications SET author_id = NULL WHERE author_id = ?", (user_id,))
    db.run("DELETE FROM users WHERE id = ?", (user_id,))
    return {"ok": True}


# --- темы выпуска (главный редактор) --------------------------------------


@app.get("/api/topics")
def topics(user: User = Depends(current_user)) -> list[dict]:
    if user.role in ("editor", "author"):
        return db.rows(TOPIC_SQL + " WHERE t.department_id = ? ORDER BY t.id DESC", (user.department_id,))
    return db.rows(TOPIC_SQL + " ORDER BY t.id DESC")


@app.post("/api/topics")
def add_topic(data: TopicIn, _: User = Depends(need("topics"))) -> dict:
    topic_id = db.run("INSERT INTO topics (title, department_id) VALUES (?, ?)", (data.title, data.department_id))
    return db.row(TOPIC_SQL + " WHERE t.id = ?", (topic_id,))


@app.delete("/api/topics/{topic_id}")
def delete_topic(topic_id: int, _: User = Depends(need("topics"))) -> dict:
    db.run("DELETE FROM publications WHERE topic_id = ?", (topic_id,))
    db.run("DELETE FROM topics WHERE id = ?", (topic_id,))
    return {"ok": True}


# --- публикации -----------------------------------------------------------


@app.get("/api/publications")
def publications(user: User = Depends(current_user)) -> list[dict]:
    if user.role == "author":
        return db.rows(PUB_SQL + " WHERE p.author_id = ? ORDER BY p.id DESC", (user.id,))
    if user.role == "editor":
        return db.rows(PUB_SQL + " WHERE t.department_id = ? ORDER BY p.id DESC", (user.department_id,))
    return db.rows(PUB_SQL + " ORDER BY p.id DESC")


@app.get("/api/authors")
def authors(user: User = Depends(need("assign"))) -> list[dict]:
    return db.rows(
        "SELECT id, full_name FROM users WHERE role = 'author' AND department_id = ? ORDER BY full_name",
        (user.department_id,),
    )


@app.post("/api/publications")
def add_publication(data: PublicationIn, user: User = Depends(need("assign"))) -> dict:
    topic = db.row("SELECT * FROM topics WHERE id = ?", (data.topic_id,))
    if not topic:
        raise HTTPException(404, "Тема не найдена")
    if topic["department_id"] != user.department_id:
        raise HTTPException(403, "Тема другого отдела")
    publication_id = db.run(
        "INSERT INTO publications (topic_id, title, author_id) VALUES (?, ?, ?)",
        (data.topic_id, data.title, data.author_id),
    )
    return get_publication(publication_id)


@app.patch("/api/publications/{publication_id}")
def edit_publication(publication_id: int, data: PublicationPatch, user: User = Depends(current_user)) -> dict:
    publication = get_publication(publication_id)
    if "edit" in user.can:
        check_department(user, publication)
    elif "write" in user.can:
        if publication["author_id"] != user.id:
            raise HTTPException(403, "Это чужая публикация")
        if publication["status"] not in ("assigned", "rework"):
            raise HTTPException(400, "Публикация уже у редактора")
    else:
        raise HTTPException(403, "Недостаточно прав")
    db.run("UPDATE publications SET title = ?, body = ? WHERE id = ?", (data.title, data.body, publication_id))
    return get_publication(publication_id)


@app.post("/api/publications/{publication_id}/submit")
def submit_publication(publication_id: int, user: User = Depends(need("write"))) -> dict:
    publication = get_publication(publication_id)
    if publication["author_id"] != user.id:
        raise HTTPException(403, "Это чужая публикация")
    if publication["status"] not in ("assigned", "rework"):
        raise HTTPException(400, "Публикация уже сдана")
    db.run("UPDATE publications SET status = 'submitted', note = '' WHERE id = ?", (publication_id,))
    return get_publication(publication_id)


@app.post("/api/publications/{publication_id}/return")
def return_publication(publication_id: int, data: NoteIn, user: User = Depends(need("approve"))) -> dict:
    publication = get_publication(publication_id)
    check_department(user, publication)
    if publication["status"] != "submitted":
        raise HTTPException(400, "Публикация ещё не сдана автором")
    db.run("UPDATE publications SET status = 'rework', note = ? WHERE id = ?", (data.note, publication_id))
    return get_publication(publication_id)


@app.post("/api/publications/{publication_id}/approve")
def approve_publication(publication_id: int, user: User = Depends(need("approve"))) -> dict:
    publication = get_publication(publication_id)
    check_department(user, publication)
    if publication["status"] != "submitted":
        raise HTTPException(400, "Публикация ещё не сдана автором")
    db.run("UPDATE publications SET status = 'approved', note = '' WHERE id = ?", (publication_id,))
    return get_publication(publication_id)


@app.get("/api/news")
def news() -> list[dict]:
    return db.rows(PUB_SQL + " WHERE p.status = 'approved' ORDER BY p.id DESC")
