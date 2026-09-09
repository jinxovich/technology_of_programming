import { api, setToken } from '../api';
import { loadDepartments, render } from '../app';
import { state } from '../state';
import type { Me, View } from '../types';
import { onSubmit } from '../ui';

interface AuthResult {
  token: string;
  user: Me;
}

export function authView(): View {
  const html = `
    <h1 class="page-title">Вход в редакцию</h1>
    <form class="card narrow" data-form="login">
      <label>Логин<input name="username" required autocomplete="username" /></label>
      <label>Пароль<input name="password" type="password" required autocomplete="current-password" /></label>
      <button class="primary">Войти</button>
      <p class="hint">
        Стартовый администратор: <b>admin</b> / <b>admin</b>.<br />
        Остальные учётные записи заводит администратор.
      </p>
    </form>`;

  return {
    html,
    wire(root) {
      onSubmit(root, 'login', async (data) => {
        const result = await api<AuthResult>('/login', 'POST', data);
        setToken(result.token);
        state.me = result.user;
        await loadDepartments();
        state.page = 'work';
        await render();
      });
    },
  };
}
