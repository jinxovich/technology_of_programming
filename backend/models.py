"""Пользователи новостного сайта — по одному классу на роль.

Права роли — это набор строк в `can`, его же проверяет API.
"""
import hashlib


def hash_pw(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


class User:
    role = "user"
    title = "Пользователь"
    can: set[str] = set()
    needs_department = False

    def __init__(self, id, username, full_name, department_id=None, department=None, **_):
        self.id = id
        self.username = username
        self.full_name = full_name
        self.department_id = department_id
        self.department = department

    def public(self) -> dict:
        return {
            "id": self.id,
            "username": self.username,
            "full_name": self.full_name,
            "role": self.role,
            "role_title": self.title,
            "department_id": self.department_id,
            "department": self.department,
            "can": sorted(self.can),
        }


class Admin(User):
    """Составление списка сотрудников."""

    role = "admin"
    title = "Администратор"
    can = {"users"}


class ChiefEditor(User):
    """Список тем выпуска по отделам + проверка наличия подготовленных публикаций."""

    role = "chief"
    title = "Главный редактор"
    can = {"topics", "review"}


class DepartmentEditor(User):
    """Список публикаций отдела, распределение по авторам, правка, разрешение на выкладку."""

    role = "editor"
    title = "Редактор отдела"
    can = {"assign", "edit", "approve"}
    needs_department = True


class Author(User):
    """Подготовка публикации и исправление замечаний редактора отдела."""

    role = "author"
    title = "Автор"
    can = {"write"}
    needs_department = True


ROLES: dict[str, type[User]] = {cls.role: cls for cls in (Admin, ChiefEditor, DepartmentEditor, Author)}


def from_row(row: dict) -> User:
    """Строка таблицы users -> объект нужного класса роли."""
    return ROLES[row["role"]](**row)
