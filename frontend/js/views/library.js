import * as api from '../api.js';
import { state, bus } from '../state.js';
import { renderStars } from '../components/rating.js';
import { openModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

const STATUS_LABELS = {
  wishlist: 'Wishlist',
  owned:    'Owned',
  // legacy values — shown gracefully if items exist with old statuses
  in_progress: 'In Progress',
  completed:   'Completed',
  dropped:     'Dropped',
};

let currentFilters = {
  q: '',
  category_id: null,
  status: null,
  rating: null,
  sort_by: 'created_at',
  sort_dir: 'desc',
  limit: 50,
  offset: 0,
};

let viewMode = 'grid'; // 'grid' | 'list'
let searchTimer = null;

export async function renderLibrary(container, opts = {}) {
  if (opts.categoryId) {
    currentFilters.category_id = opts.categoryId;
  } else if (!location.hash.includes('category')) {
    currentFilters.category_id = null;
  }

  currentFilters.offset = 0;

  const catName = opts.categoryId
    ? (state.categories.find(c => c.id === opts.categoryId)?.name || 'Library')
    : 'All Media';

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">${catName}</div>
      </div>
      <button class="btn btn-primary" id="add-btn">+ Add Media</button>
    </div>

    <div class="library-toolbar">
      <input type="text" class="search-input" id="search-input"
             placeholder="Search by title or notes…" value="${esc(currentFilters.q)}">

      <div class="view-toggle">
        <button class="view-toggle-btn ${viewMode==='grid'?'active':''}" data-view="grid" title="Grid">▦</button>
        <button class="view-toggle-btn ${viewMode==='list'?'active':''}" data-view="list" title="List">☰</button>
      </div>

      <select class="sort-select" id="sort-select">
        <option value="created_at:desc" ${sel('created_at','desc')}>Newest Added</option>
        <option value="created_at:asc"  ${sel('created_at','asc')}>Oldest Added</option>
        <option value="title:asc"       ${sel('title','asc')}>Title A–Z</option>
        <option value="title:desc"      ${sel('title','desc')}>Title Z–A</option>
        <option value="rating:desc"     ${sel('rating','desc')}>Highest Rated</option>
      </select>
    </div>

    <div class="library-layout">
      <div class="filter-sidebar" id="filter-sidebar">
        <!-- Populated below -->
      </div>
      <div class="library-content" id="library-content">
        <div class="loading-spinner">Loading…</div>
      </div>
    </div>
  `;

  renderFilterSidebar(container);
  await loadItems(container);

  // Add media button
  container.querySelector('#add-btn').addEventListener('click', () => {
    openModal(null, opts.categoryId);
  });

  // Search
  container.querySelector('#search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      currentFilters.q = e.target.value;
      currentFilters.offset = 0;
      await loadItems(container);
    }, 300);
  });

  // Sort
  container.querySelector('#sort-select').addEventListener('change', async (e) => {
    const [by, dir] = e.target.value.split(':');
    currentFilters.sort_by = by;
    currentFilters.sort_dir = dir;
    currentFilters.offset = 0;
    await loadItems(container);
  });

  // View toggle
  container.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      viewMode = btn.dataset.view;
      container.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      await loadItems(container);
    });
  });
}

function sel(by, dir) {
  return currentFilters.sort_by === by && currentFilters.sort_dir === dir ? 'selected' : '';
}

function renderFilterSidebar(container) {
  const sidebar = container.querySelector('#filter-sidebar');
  if (!sidebar) return;

  sidebar.innerHTML = `
    <h3>Status</h3>
    ${['', 'wishlist', 'owned'].map(s => `
      <button class="filter-option ${currentFilters.status === (s||null) ? 'active' : ''}"
              data-filter="status" data-value="${s}">
        <span class="filter-dot" style="background:${statusColor(s)}"></span>
        ${s ? STATUS_LABELS[s] : 'All Statuses'}
      </button>
    `).join('')}

    <h3>Rating</h3>
    ${[null, 'A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'].map(r => `
      <button class="filter-option ${currentFilters.rating === r ? 'active' : ''}"
              data-filter="rating" data-value="${r ?? ''}">
        ${r ? r : 'Any Rating'}
      </button>
    `).join('')}
  `;

  sidebar.querySelectorAll('.filter-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.filter;
      const val = btn.dataset.value;
      if (type === 'status') {
        currentFilters.status = val || null;
      } else if (type === 'rating') {
        currentFilters.rating = val || null;
      }
      currentFilters.offset = 0;
      renderFilterSidebar(container);
      await loadItems(container);
    });
  });
}

function statusColor(s) {
  const map = {
    wishlist:    '#818cf8',
    owned:       '#4ade80',
    // legacy colours kept for graceful display of old items
    in_progress: '#fbbf24',
    completed:   '#4ade80',
    dropped:     '#f87171',
  };
  return s ? (map[s] || 'var(--text-muted)') : 'var(--text-muted)';
}

async function loadItems(container) {
  const content = container.querySelector('#library-content');
  if (!content) return;
  content.innerHTML = '<div class="loading-spinner">Loading…</div>';

  const params = { ...currentFilters };
  if (!params.category_id) delete params.category_id;
  if (!params.status) delete params.status;
  if (!params.rating) delete params.rating;
  if (!params.q) delete params.q;

  const data = await api.getMedia(params);

  if (!data.items.length) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">No results found</div>
        <div class="empty-state-text">Try adjusting your filters or add some media.</div>
      </div>`;
    return;
  }

  let html = '';
  if (viewMode === 'grid') {
    html = `<div class="media-grid">${data.items.map(gridCard).join('')}</div>`;
  } else {
    html = `<div class="media-list">${data.items.map(listRow).join('')}</div>`;
  }

  // Pagination
  if (data.total > currentFilters.limit) {
    const pages = Math.ceil(data.total / currentFilters.limit);
    const cur = Math.floor(currentFilters.offset / currentFilters.limit) + 1;
    html += `
      <div class="pagination">
        <button class="btn btn-secondary btn-sm" id="prev-page" ${cur===1?'disabled':''}>← Prev</button>
        <span class="page-info">Page ${cur} of ${pages} (${data.total} items)</span>
        <button class="btn btn-secondary btn-sm" id="next-page" ${cur>=pages?'disabled':''}>Next →</button>
      </div>`;
  }

  content.innerHTML = html;

  // Card/row click → edit
  content.querySelectorAll('[data-item-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.card-menu') || e.target.closest('.list-actions')) return;
      openModal(parseInt(el.dataset.itemId));
    });
  });

  // Edit buttons
  content.querySelectorAll('[data-edit-id]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(parseInt(btn.dataset.editId));
      closeDropdown();
    });
  });

  // Delete buttons
  content.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this item?')) return;
      try {
        await api.deleteMedia(parseInt(btn.dataset.deleteId));
        showToast('Deleted successfully', 'success');
        bus.dispatchEvent(new Event('media-deleted'));
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  // Dropdown toggle
  content.querySelectorAll('.card-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = btn.nextElementSibling;
      const wasHidden = dd.classList.contains('hidden');
      closeDropdown();
      if (wasHidden) dd.classList.remove('hidden');
    });
  });

  document.addEventListener('click', closeDropdown, { once: true });

  // Pagination
  const prev = content.querySelector('#prev-page');
  const next = content.querySelector('#next-page');
  if (prev) prev.addEventListener('click', async () => {
    currentFilters.offset -= currentFilters.limit;
    await loadItems(container);
  });
  if (next) next.addEventListener('click', async () => {
    currentFilters.offset += currentFilters.limit;
    await loadItems(container);
  });
}

function closeDropdown() {
  document.querySelectorAll('.card-dropdown').forEach(d => d.classList.add('hidden'));
}

function getCoverAspectClass(item) {
  const name = (item.category_name || '').toLowerCase();
  if (name.includes('album') || name.includes('music')) return 'square';
  return 'portrait';
}

function getPrimaryCreator(item) {
  const m = item.metadata || {};
  return m.artist || m.author || m.director || m.developer || null;
}

function getSecondaryInfo(item) {
  const m = item.metadata || {};
  const parts = [];
  if (m.year) parts.push(m.year);
  const genre = Array.isArray(m.genre) ? m.genre[0] : m.genre;
  if (genre) parts.push(genre);
  return parts.join(' · ');
}

function gridCard(item) {
  const aspect = getCoverAspectClass(item);
  const cover = item.cover_image_url
    ? `<img class="card-cover card-cover--${aspect}" src="${item.cover_image_url}" alt="${esc(item.title)}"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  const creator = getPrimaryCreator(item);
  const secondary = getSecondaryInfo(item);
  const tagChips = item.tags && item.tags.length
    ? `<div class="card-tags">${item.tags.slice(0,3).map(t =>
        `<span class="tag-chip" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}55">${esc(t.name)}</span>`
      ).join('')}</div>`
    : '';
  return `
    <div class="media-card" data-item-id="${item.id}">
      ${cover}
      <div class="card-cover-placeholder card-cover--${aspect}" ${item.cover_image_url ? 'style="display:none"' : ''}>
        ${item.category_icon}
      </div>
      <div class="card-menu">
        <button class="card-menu-btn">⋯</button>
        <div class="card-dropdown hidden">
          <button class="card-dropdown-item" data-edit-id="${item.id}">✏️ Edit</button>
          <button class="card-dropdown-item danger" data-delete-id="${item.id}">🗑️ Delete</button>
        </div>
      </div>
      <div class="card-body">
        <div class="card-title">${esc(item.title)}</div>
        ${creator ? `<div class="card-creator">${esc(creator)}</div>` : ''}
        <div class="card-meta">
          <span class="badge badge-${item.status}">${STATUS_LABELS[item.status]}</span>
          ${item.rating ? renderStars(item.rating, true) : ''}
        </div>
        ${secondary ? `<div class="card-secondary">${esc(secondary)}</div>` : ''}
        ${tagChips}
      </div>
    </div>
  `;
}

function listRow(item) {
  const aspect = getCoverAspectClass(item);
  const thumbClass = `list-thumb list-thumb--${aspect}`;
  const thumb = item.cover_image_url
    ? `<div class="${thumbClass}"><img src="${item.cover_image_url}" alt="" onerror="this.parentNode.innerHTML='${item.category_icon}'"></div>`
    : `<div class="${thumbClass}">${item.category_icon}</div>`;
  const creator = getPrimaryCreator(item);
  const secondary = getSecondaryInfo(item);
  const subtitleParts = [item.category_name];
  if (creator) subtitleParts.push(creator);
  if (secondary) subtitleParts.push(secondary);
  const tagChips = item.tags && item.tags.length
    ? `<div class="card-tags" style="margin-top:3px">${item.tags.slice(0,3).map(t =>
        `<span class="tag-chip" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}55">${esc(t.name)}</span>`
      ).join('')}</div>`
    : '';
  return `
    <div class="list-item" data-item-id="${item.id}">
      ${thumb}
      <div>
        <div class="list-title">${esc(item.title)}</div>
        <div class="list-subtitle">${subtitleParts.map(esc).join(' · ')}</div>
        ${tagChips}
      </div>
      <span class="badge badge-${item.status}">${STATUS_LABELS[item.status]}</span>
      <div>${item.rating ? renderStars(item.rating, true) : '<span style="color:var(--text-muted);font-size:12px">–</span>'}</div>
      <div style="font-size:12px;color:var(--text-muted)">${item.created_at ? item.created_at.slice(0,10) : ''}</div>
      <div class="list-actions">
        <button class="btn btn-ghost btn-sm btn-icon" data-edit-id="${item.id}" title="Edit">✏️</button>
        <button class="btn btn-ghost btn-sm btn-icon" data-delete-id="${item.id}" title="Delete">🗑️</button>
      </div>
    </div>
  `;
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
