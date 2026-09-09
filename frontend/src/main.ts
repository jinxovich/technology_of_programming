import './style.css';
import { boot } from './app';

boot().catch((error: Error) => {
  const root = document.getElementById('app') as HTMLElement;
  root.innerHTML = `<main class="wrap"><p class="empty">Бэкенд недоступен: ${error.message}</p></main>`;
});
