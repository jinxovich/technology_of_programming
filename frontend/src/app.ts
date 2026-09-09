import { api, setToken, token } from './api';
import { state } from './state';
import type { Department, Me, View } from './types';
import { esc, onClick } from './ui';
import { adminView } from './views/admin';
import { authView } from './views/auth';
import { authorView } from './views/author';
import { chiefView } from './views/chief';
import { editorView } from './views/editor';
import { newsView } from './views/news';

export async function loadDepartments(): Promise<void> {
  state.departments = await api<Department[]>('/departments');
}

export async function boot(): Promise<void> {
  if (token) {
    try {
      state.me = await api<Me>('/me');
      await loadDepartments();
    } catch {
      setToken('');
      state.me = null;
    }
  }
  await render();
}

export async function render(): Promise<void> {
  const root = document.getElementById('app') as HTMLElement;
  let view: View;
  try {
    view = await currentView();
  } catch (error) {
    view = { html: `<p class="empty">${esc((error as Error).message)}</p>` };
  }
  root.innerHTML = header() + `<main class="wrap">${view.html}</main>`;
  wireHeader(root);
  view.wire?.(root);
}

function currentView(): Promise<View> | View {
  if (state.page === 'news') return newsView();
  if (!state.me) return authView();
  if (state.me.role === 'admin') return adminView();
  if (state.me.role === 'chief') return chiefView();
  if (state.me.role === 'editor') return editorView();
  return authorView();
}

function header(): string {
  const me = state.me;
  const tab = (page: 'news' | 'work', label: string) =>
    `<button data-act="page" data-page="${page}" class="${state.page === page ? 'on' : ''}">${label}</button>`;

  return `
    <header class="top">
      <div class="wrap bar">
        <div class="brand">Новостной <span>сайт</span></div>
        <nav class="tabs">
          ${tab('news', 'Сайт')}
          ${tab('work', me ? 'Рабочее место' : 'Вход')}
        </nav>
        <div class="who">
          ${
            me
              ? `<span class="dim">${esc(me.role_title)}${me.department ? ' · ' + esc(me.department) : ''}</span>
                 <b>${esc(me.full_name)}</b>
                 <button data-act="logout">Выйти</button>`
              : ''
          }
        </div>
      </div>
    </header>`;
}

function wireHeader(root: HTMLElement): void {
  onClick(root, 'page', async (element) => {
    state.page = element.dataset.page === 'work' ? 'work' : 'news';
    await render();
  });
  onClick(root, 'logout', async () => {
    setToken('');
    state.me = null;
    state.page = 'news';
    await render();
  });
}
