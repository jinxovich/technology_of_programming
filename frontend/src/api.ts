const BASE = 'http://localhost:8000/api';

export let token = localStorage.getItem('token') ?? '';

export function setToken(value: string): void {
  token = value;
  if (value) localStorage.setItem('token', value);
  else localStorage.removeItem('token');
}

export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(errorText(data));
  return data as T;
}

function errorText(data: unknown): string {
  const detail = (data as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((item) => (item as { msg?: string }).msg).join(', ');
  return 'Ошибка запроса';
}
