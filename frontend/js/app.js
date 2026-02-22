import * as api from './api.js';
import { state, bus, closeModal } from './state.js';
import { renderDashboard } from './views/dashboard.js';
import { renderLibrary } from './views/library.js';
import { renderCategories } from './views/categories.js';
import { renderSettings } from './views/settings.js';

// Re-export state, bus, and closeModal so existing code that imports from app.js still works.
export { state, bus, closeModal };

// ── Router ────────────────────────────────────────────────────────────────
const routes = {
  '#dashboard':  renderDashboard,
  '#library':    renderLibrary,
  '#categories': renderCategories,
  '#settings':   renderSettings,
};

function parseHash() {
  const hash = location.hash || '#dashboard';
  // Handle the sub-route pattern #library/category/123 that sidebar category
  // links produce. The view stays '#library' but categoryId is extracted so
  // the library can pre-filter to that category.
  const catMatch = hash.match(/^#library\/category\/(\d+)$/);
  if (catMatch) return { view: '#library', categoryId: parseInt(catMatch[1]) };
  return { view: hash, categoryId: null };
}

async function navigate() {
  const { view, categoryId } = parseHash();
  const content = document.getElementById('app-content');
  // Replace content with a spinner immediately so the user sees feedback
  // while the async view function fetches data from the backend.
  content.innerHTML = '<div class="loading-spinner">Loading...</div>';

  updateActiveNav(view, categoryId);

  try {
    const fn = routes[view] || renderDashboard;
    await fn(content, { categoryId });
  } catch (err) {
    content.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon">⚠️</div>
      <div class="empty-state-title">Something went wrong</div>
      <div class="empty-state-text">${err.message}</div>
    </div>`;
  }
}

function updateActiveNav(view, categoryId) {
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));
  if (categoryId) {
    const catLink = document.querySelector(`[data-cat-id="${categoryId}"]`);
    if (catLink) catLink.classList.add('active');
  } else {
    const link = document.querySelector(`[data-view="${view.slice(1)}"]`);
    if (link) link.classList.add('active');
  }
}

// ── Sidebar Categories ────────────────────────────────────────────────────
async function loadSidebar() {
  state.categories = await api.getCategories();
  state.tags = await api.getTags();
  renderSidebarCategories();
}

function renderSidebarCategories() {
  const container = document.getElementById('sidebar-categories');
  container.innerHTML = state.categories.map(c => `
    <a href="#library/category/${c.id}"
       class="nav-link"
       data-cat-id="${c.id}">
      <span class="nav-icon">${c.icon}</span>
      <span>${c.name}</span>
      <span style="margin-left:auto;font-size:11px;color:var(--text-muted)">${c.item_count}</span>
    </a>
  `).join('');
}

// ── Event Listeners ───────────────────────────────────────────────────────
bus.addEventListener('media-saved', async () => {
  await loadSidebar();
  navigate();
});

bus.addEventListener('media-deleted', async () => {
  await loadSidebar();
  navigate();
});

bus.addEventListener('categories-changed', async () => {
  await loadSidebar();
  navigate();
});

// ── Init ──────────────────────────────────────────────────────────────────
async function init() {
  await loadSidebar();

  window.addEventListener('hashchange', navigate);
  navigate();

  // modal.js is imported dynamically (lazily) to break the circular dependency:
  // app.js → modal.js → state.js → (back) is fine, but a static import of
  // modal.js at the top of app.js would create a cycle during module resolution.
  document.getElementById('add-media-btn').addEventListener('click', async () => {
    const { openModal } = await import('./components/modal.js');
    openModal(null);
  });

  // The overlay listener is NOT { once: true } — it must stay attached for
  // repeated modal open/close cycles throughout the session.
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  document.getElementById('modal-close-btn').addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

document.addEventListener('DOMContentLoaded', init);
