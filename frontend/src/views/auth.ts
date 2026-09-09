import { api, setToken } from '../api';
import { render } from '../app';
import { state } from '../state';
import type { Me, View } from '../types';
import { onSubmit, options, ROLE_OPTIONS } from '../ui';

interface AuthResult {
  token: string;
  user: Me;
}

export function authView(): View {
  const html = `
    <h1 class="page-title">Вход в редакцию</h1>
    <div class="two-cols">
      <form class="card" data-form="login">
        <h2>Вход</h2>
        <label>Логин<input name="username" required autocomplete="username" /></label>
        <label>Пароль<input name="password" type="password" required autocomplete="current-password" /></label>
        <button class="primary">Войти</button>
        <p class="hint">Стартовый администратор: <b>admin</b> / <b>admin</b></p>
      </form>
      <form class="card" data-form="register">
        <h2>Регистрация сотрудника</h2>
        <label>ФИО<input name="full_name" required /></label>
        <label>Логин<input name="username" required autocomplete="username" /></label>
        <label>Пароль<input name="password" type="password" required autocomplete="new-password" /></label>
        <label>Должность<select name="role">${options(ROLE_OPTIONS)}</select></label>
        <label>Отдел
          <select name="department_id">
            <option value="">— без отдела —</option>
            ${options(state.departments)}
          </select>
        </label>
        <button class="primary">Зарегистрироваться</button>
        <p class="hint">Отдел обязателен для редактора отдела и автора.</p>
      </form>
    </div>`;

  return {
    html,
    wire(root) {
      onSubmit(root, 'login', async (data) => {
        await enter(await api<AuthResult>('/login', 'POST', data));
      });
      onSubmit(root, 'register', async (data) => {
        await enter(
          await api<AuthResult>('/register', 'POST', {
            ...data,
            department_id: data.department_id ? Number(data.department_id) : null,
          }),
        );
      });
    },
  };
}

async function enter(result: AuthResult): Promise<void> {
  setToken(result.token);
  state.me = result.user;
  state.page = 'work';
  await render();
}
