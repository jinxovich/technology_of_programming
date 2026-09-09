import { api } from '../api';
import { render } from '../app';
import { state } from '../state';
import type { Publication, Topic, View } from '../types';
import { esc, onClick, onSubmit, options, STATUS_LABEL } from '../ui';

export async function chiefView(): Promise<View> {
  const [topics, publications] = await Promise.all([
    api<Topic[]>('/topics'),
    api<Publication[]>('/publications'),
  ]);

  const html = `
    <h1 class="page-title">Темы новостного выпуска</h1>
    <form class="card row" data-form="topic">
      <label class="grow">Тема<input name="title" placeholder="Тема выпуска" required /></label>
      <label>Отдел<select name="department_id">${options(state.departments)}</select></label>
      <button class="primary">Добавить тему</button>
    </form>
    ${topics.length ? topics.map((topic) => card(topic, publications)).join('') : '<p class="empty">Тем пока нет.</p>'}`;

  return {
    html,
    wire(root) {
      onSubmit(root, 'topic', async (data) => {
        await api('/topics', 'POST', { title: data.title, department_id: Number(data.department_id) });
        await render();
      });
      onClick(root, 'delete-topic', async (element) => {
        if (!confirm('Удалить тему вместе с её публикациями?')) return;
        await api(`/topics/${element.dataset.id}`, 'DELETE');
        await render();
      });
    },
  };
}

function card(topic: Topic, publications: Publication[]): string {
  const own = publications.filter((item) => item.topic_id === topic.id);
  const ready = own.filter((item) => item.status === 'submitted' || item.status === 'approved').length;

  return `
    <section class="card">
      <div class="card-head">
        <div>
          <h2>${esc(topic.title)}</h2>
          <div class="dim">Отдел: ${esc(topic.department)} · подготовлено ${ready} из ${own.length}</div>
        </div>
        <button class="danger" data-act="delete-topic" data-id="${topic.id}">Удалить</button>
      </div>
      ${
        own.length
          ? `<ul class="list">${own
              .map(
                (item) => `
        <li>
          <span>${esc(item.title)}</span>
          <span class="dim">${esc(item.author ?? 'автор не назначен')}</span>
          <span class="badge ${item.status}">${STATUS_LABEL[item.status]}</span>
        </li>`,
              )
              .join('')}</ul>`
          : '<p class="empty">Редактор отдела ещё не завёл публикации по этой теме.</p>'
      }
    </section>`;
}
