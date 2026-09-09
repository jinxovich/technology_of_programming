import { api } from '../api';
import { render } from '../app';
import { state } from '../state';
import type { Department, Me, View } from '../types';
import { esc, onClick, onSubmit, options, ROLE_OPTIONS } from '../ui';

export async function adminView(): Promise<View> {
  const users = await api<Me[]>('/users');

  const html = `
    <h1 class="page-title">Список сотрудников</h1>
    <form class="card row" data-form="department">
      <label class="grow">Новый отдел<input name="name" placeholder="Название отдела" required /></label>
      <button>Добавить</button>
    </form>
    <div class="card">
      <div class="grid-row head">
        <span>ФИО</span><span>Логин</span><span>Должность</span><span>Отдел</span><span></span>
      </div>
      ${users.map(row).join('')}
    </div>`;

  return {
    html,
    wire(root) {
      onSubmit(root, 'department', async (data) => {
        state.departments = await api<Department[]>('/departments', 'POST', data);
        await render();
      });
      onSubmit(root, 'user', async (data) => {
        await api(`/users/${data.id}`, 'PATCH', {
          full_name: data.full_name,
          role: data.role,
          department_id: data.department_id ? Number(data.department_id) : null,
        });
        await render();
      });
      onClick(root, 'delete-user', async (element) => {
        if (!confirm('Удалить сотрудника?')) return;
        await api(`/users/${element.dataset.id}`, 'DELETE');
        await render();
      });
    },
  };
}

function row(user: Me): string {
  return `
    <form class="grid-row" data-form="user">
      <input type="hidden" name="id" value="${user.id}" />
      <input name="full_name" value="${esc(user.full_name)}" required />
      <span class="dim">${esc(user.username)}</span>
      <select name="role">${options(ROLE_OPTIONS, user.role)}</select>
      <select name="department_id">
        <option value="">— без отдела —</option>
        ${options(state.departments, user.department_id)}
      </select>
      <span class="actions">
        <button>Сохранить</button>
        <button type="button" class="danger" data-act="delete-user" data-id="${user.id}">Удалить</button>
      </span>
    </form>`;
}
