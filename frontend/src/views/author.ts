import { api } from '../api';
import { render } from '../app';
import type { Publication, View } from '../types';
import { cardValue, esc, onClick, STATUS_LABEL } from '../ui';

export async function authorView(): Promise<View> {
  const publications = await api<Publication[]>('/publications');

  const html = `
    <h1 class="page-title">Мои публикации</h1>
    ${
      publications.length
        ? publications.map(card).join('')
        : '<p class="empty">Редактор отдела ещё не поручил вам публикаций.</p>'
    }`;

  return {
    html,
    wire(root) {
      onClick(root, 'save', async (element) => {
        await api(`/publications/${element.dataset.id}`, 'PATCH', {
          title: cardValue(element, 'title'),
          body: cardValue(element, 'body'),
        });
        await render();
      });
      onClick(root, 'submit', async (element) => {
        await api(`/publications/${element.dataset.id}`, 'PATCH', {
          title: cardValue(element, 'title'),
          body: cardValue(element, 'body'),
        });
        await api(`/publications/${element.dataset.id}/submit`, 'POST');
        await render();
      });
    },
  };
}

function card(item: Publication): string {
  const editable = item.status === 'assigned' || item.status === 'rework';
  const locked = editable ? '' : ' disabled';
  return `
    <section class="card">
      <div class="card-head">
        <div class="dim">${esc(item.department)} · ${esc(item.topic)}</div>
        <span class="badge ${item.status}">${STATUS_LABEL[item.status]}</span>
      </div>
      <input name="title" value="${esc(item.title)}"${locked} />
      <textarea name="body" rows="8" placeholder="Текст публикации"${locked}>${esc(item.body)}</textarea>
      ${item.note ? `<p class="note">Замечание редактора: ${esc(item.note)}</p>` : ''}
      ${
        editable
          ? `<div class="row">
              <button data-act="save" data-id="${item.id}">Сохранить черновик</button>
              <button class="primary" data-act="submit" data-id="${item.id}">Сдать редактору</button>
            </div>`
          : ''
      }
    </section>`;
}
