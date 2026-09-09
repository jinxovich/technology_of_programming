"""SQLite: схема, стартовые данные и три помощника вместо ORM."""
import sqlite3
from pathlib import Path

from models import hash_pw

DB_PATH = Path(__file__).with_name("news.db")

SCHEMA = """
CREATE TABLE IF NOT EXISTS departments (
    id   INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password      TEXT NOT NULL,
    full_name     TEXT NOT NULL,
    role          TEXT NOT NULL,
    department_id INTEGER
);
CREATE TABLE IF NOT EXISTS topics (
    id            INTEGER PRIMARY KEY,
    title         TEXT NOT NULL,
    department_id INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS publications (
    id        INTEGER PRIMARY KEY,
    topic_id  INTEGER NOT NULL,
    title     TEXT NOT NULL,
    body      TEXT NOT NULL DEFAULT '',
    author_id INTEGER,
    status    TEXT NOT NULL DEFAULT 'assigned',
    note      TEXT NOT NULL DEFAULT ''
);
"""

START_DEPARTMENTS = ["Политика", "Экономика", "Спорт", "Культура"]


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def rows(sql: str, args: tuple = ()) -> list[dict]:
    con = connect()
    try:
        return [dict(r) for r in con.execute(sql, args)]
    finally:
        con.close()


def row(sql: str, args: tuple = ()) -> dict | None:
    found = rows(sql, args)
    return found[0] if found else None


def run(sql: str, args: tuple = ()) -> int:
    con = connect()
    try:
        cursor = con.execute(sql, args)
        con.commit()
        return cursor.lastrowid
    finally:
        con.close()


def init() -> None:
    con = connect()
    try:
        con.executescript(SCHEMA)
        if not con.execute("SELECT 1 FROM departments").fetchone():
            con.executemany("INSERT INTO departments (name) VALUES (?)", [(n,) for n in START_DEPARTMENTS])
        if not con.execute("SELECT 1 FROM users").fetchone():
            con.execute(
                "INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, 'admin')",
                ("admin", hash_pw("admin"), "Администратор сайта"),
            )
        con.commit()
    finally:
        con.close()
