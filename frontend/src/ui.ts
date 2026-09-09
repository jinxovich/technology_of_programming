import type { Status } from './types';

export const STATUS_LABEL: Record<Status, string> = {
  assigned: 'назначена автору',
  submitted: 'на проверке у редактора',
  rework: 'на доработке у автора',
  approved: 'выложена на сайт',
};

export const ROLE_OPTIONS = [
  { id: 'author', name: 'Автор' },
  { id: 'editor', name: 'Редактор отдела' },
  { id: 'chief', name: 'Главный редактор' },
  { id: 'admin', name: 'Администратор' },
];

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

export function options(items: { id: number | string; name: string }[], selected?: number | string | null): string {
  return items
    .map((item) => {
      const on = String(item.id) === String(selected ?? '') ? ' selected' : '';
      return `<option value="${esc(item.id)}"${on}>${esc(item.name)}</option>`;
    })
    .join('');
}

export function fields(form: HTMLFormElement): Record<string, string> {
  return Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
}

export async function guard(action: () => Promise<void> | void): Promise<void> {
  try {
    await action();
  } catch (error) {
    alert((error as Error).message);
  }
}

export function onSubmit(
  root: HTMLElement,
  name: string,
  handler: (data: Record<string, string>, form: HTMLFormElement) => Promise<void> | void,
): void {
  root.querySelectorAll<HTMLFormElement>(`form[data-form="${name}"]`).forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      void guard(() => handler(fields(form), form));
    });
  });
}

export function onClick(
  root: HTMLElement,
  action: string,
  handler: (element: HTMLElement) => Promise<void> | void,
): void {
  root.querySelectorAll<HTMLElement>(`[data-act="${action}"]`).forEach((element) => {
    element.addEventListener('click', () => void guard(() => handler(element)));
  });
}

/** Значение поля внутри карточки, из которой нажали кнопку. */
export function cardValue(element: HTMLElement, name: string): string {
  const card = element.closest('.card') as HTMLElement | null;
  return card?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)?.value ?? '';
}
