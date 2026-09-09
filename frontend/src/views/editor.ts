import { api } from '../api';
import { render } from '../app';
import type { AuthorRef, Publication, Topic, View } from '../types';
import { cardValue, esc, onClick, onSubmit, options, STATUS_LABEL } from '../ui';

export async function editorView(): Promise<View> {
  const [topics, publications, authors] = await Promise.all([
    api<Topic[]>('/topics'),
    api<Publication[]>('/publications'),
    api<AuthorRef[]>('/authors'),
  ]);

  const authorOptions = authors.map((author) => ({ id: author.id, name: author.full_name }));
  const topicOptions = topics.map((topic) => ({ id: topic.id, name: topic.title }));

  const html = `
    <h1 class="page-title">Публикации отдела</h1>
    ${
      topicOptions.length && authorOptions.length
        ? `<form class="card row" data-form="publication">
            <label>Тема<select name="topic_id">${options(topicOptions)}</select></label>
            <label class="grow">Заголовок<input name="title" placeholder="Заголовок публикации" required /></label>
            <label>Автор<select name="author_id">${options(authorOptions)}</select></label>
            <button class="primary">Поручить</button>
          </form>`
        : `<p class="empty">Чтобы поручить публикацию, нужны темы от главного редактора и авторы в отделе.</p>`
    }
    ${publications.length ? publications.map(card).join('') : '<p class="empty">Публикаций пока нет.</p>'}`;

  return {
    html,
    wire(root) {
      onSubmit(root, 'publication', async (data) => {
        await api('/publications', 'POST', {
          topic_id: Number(data.topic_id),
          title: data.title,
          author_id: Number(data.author_id),
        });
        await render();
      });
      onClick(root, 'save', async (element) => {
        await api(`/publications/${element.dataset.id}`, 'PATCH', {
          title: cardValue(element, 'title'),
          body: cardValue(element, 'body'),
        });
        await render();
      });
      onClick(root, 'approve', async (element) => {
        await api(`/publications/${element.dataset.id}/approve`, 'POST');
        await render();
      });
      onClick(root, 'return', async (element) => {
        const note = cardValue(element, 'note').trim();
        if (!note) throw new Error('Напишите замечание для автора');
        await api(`/publications/${element.dataset.id}/return`, 'POST', { note });
        await render();
      });
    },
  };
}

function card(item: Publication): string {
  const waiting = item.status === 'submitted';
  return `
    <section class="card">
      <div class="card-head">
        <div class="dim">${esc(item.topic)} · ${esc(item.author ?? 'автор не назначен')}</div>
        <span class="badge ${item.status}">${STATUS_LABEL[item.status]}</span>
      </div>
      <input name="title" value="${esc(item.title)}" />
      <textarea name="body" rows="6" placeholder="Текст публикации">${esc(item.body)}</textarea>
      ${item.note ? `<p class="note">Замечание: ${esc(item.note)}</p>` : ''}
      <div class="row">
        <button data-act="save" data-id="${item.id}">Сохранить правку</button>
        ${
          waiting
            ? `<button class="primary" data-act="approve" data-id="${item.id}">Разрешить выкладку</button>
               <input name="note" class="grow" placeholder="Замечание автору" />
               <button class="danger" data-act="return" data-id="${item.id}">Вернуть на доработку</button>`
            : ''
        }
      </div>
    </section>`;
}
