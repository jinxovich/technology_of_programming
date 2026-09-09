import { api } from '../api';
import type { Publication, View } from '../types';
import { esc } from '../ui';

export async function newsView(): Promise<View> {
  const items = await api<Publication[]>('/news');
  if (!items.length) {
    return { html: '<h1 class="page-title">Новостная лента</h1><p class="empty">Пока ни одна публикация не выложена на сайт.</p>' };
  }
  return {
    html: `
      <h1 class="page-title">Новостная лента</h1>
      <div class="feed">
        ${items
          .map(
            (item) => `
          <article class="post">
            <div class="meta">${esc(item.department)} · ${esc(item.topic)}</div>
            <h2>${esc(item.title)}</h2>
            <p class="body">${esc(item.body)}</p>
            <div class="by">${esc(item.author ?? 'автор не указан')}</div>
          </article>`,
          )
          .join('')}
      </div>`,
  };
}
