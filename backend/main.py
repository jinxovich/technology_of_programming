"""API новостного сайта."""
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


class RegisterIn(BaseModel):
    username: str
    password: str
    full_name: str
    role: str
    department_id: int | None = None


class LoginIn(BaseModel):
    username: str
    password: str


class UserPatch(BaseModel):
    full_name: str
    role: str
    department_id: int | None = None


class NameIn(BaseModel):
    name: str


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


# --- вход и регистрация ---------------------------------------------------


@app.post("/api/register")
def register(data: RegisterIn) -> dict:
    check_role(data.role, data.department_id)
    if db.row("SELECT 1 FROM users WHERE username = ?", (data.username,)):
        raise HTTPException(400, "Логин уже занят")
    db.run(
        "INSERT INTO users (username, password, full_name, role, department_id) VALUES (?, ?, ?, ?, ?)",
        (data.username, hash_pw(data.password), data.full_name, data.role, data.department_id),
    )
    return login(LoginIn(username=data.username, password=data.password))


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
    db.run("DELETE FROM users WHERE id = ?", (user_id,))
    return {"ok": True}
