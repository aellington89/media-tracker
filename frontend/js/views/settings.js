import * as api from '../api.js';
import { state } from '../state.js';
import { showToast } from '../components/toast.js';

// Human-readable labels for each field_type key
const FIELD_LABELS = {
  author:       'Authors',
  publisher:    'Publishers',
  format_book:  'Book Formats',
  director:     'Directors',
  studio:       'Studios',
  format_movie: 'Movie & TV Formats',
  developer:    'Developers',
  platform:     'Platforms',
  artist:       'Artists',
  label:        'Record Labels',
  format_game:  'Game Formats',
  format_album: 'Album Formats',
  cast:         'Cast',
};

// Currently selected list key — persists across refreshes
let activeKey = null;

export async function renderSettings(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Field Lists</div>
        <div class="page-subtitle">Select a list on the left to view and edit its values</div>
      </div>
    </div>
    <div class="settings-layout">
      <nav class="settings-nav" id="settings-nav">
        <div class="loading-spinner" style="height:80px">Loading…</div>
      </nav>
      <div class="settings-panel" id="settings-panel">
        <div class="settings-panel-empty">
          <div class="empty-state-icon">👈</div>
          <div class="empty-state-title">Select a list</div>
          <div class="empty-state-text">Choose a field list from the left to manage its values.</div>
        </div>
      </div>
    </div>
  `;

  await refreshNav(container);
}

// ── Build the list of all available field list keys ────────────────────────

function buildNavItems(cats) {
  const items = [];

  const movies  = cats.find(c => c.name === 'Movies');
  const tvShows = cats.find(c => c.name === 'TV Shows');
  const books   = cats.find(c => c.name === 'Books');
  const games   = cats.find(c => c.name === 'Games');
  const albums  = cats.find(c => c.name === 'Albums');

  // 1. Genre — one per category
  items.push({ group: 'Genre (per category)', items: cats.map(cat => ({
    key: `genre|${cat.id}`,
    label: `${cat.icon} ${cat.name}`,
    fieldType: 'genre',
    categoryId: cat.id,
  }))});

  // 2. Sub-Genre — Albums only
  if (albums) {
    items.push({ group: 'Sub-Genre', items: [{
      key: `sub_genre|${albums.id}`,
      label: `${albums.icon} ${albums.name}`,
      fieldType: 'sub_genre',
      categoryId: albums.id,
    }]});
  }

  // 3. Format — shared group, one item per category that uses a format list
  const formatItems = [];
  if (movies || tvShows) {
    formatItems.push({
      key: 'format_movie|null',
      label: `${movies?.icon ?? '🎬'}${tvShows?.icon ?? '📺'} Movies & TV Shows`,
      fieldType: 'format_movie',
      categoryId: null,
    });
  }
  if (books) {
    formatItems.push({
      key: 'format_book|null',
      label: `${books.icon} Books`,
      fieldType: 'format_book',
      categoryId: null,
    });
  }
  if (games) {
    formatItems.push({
      key: 'format_game|null',
      label: `${games.icon} Games`,
      fieldType: 'format_game',
      categoryId: null,
    });
  }
  if (albums) {
    formatItems.push({
      key: 'format_album|null',
      label: `${albums.icon} Albums`,
      fieldType: 'format_album',
      categoryId: null,
    });
  }
  if (formatItems.length) {
    items.push({ group: 'Format (shared)', items: formatItems });
  }

  // 4. Cast — shared between Movies and TV Shows
  const castItems = [];
  if (movies) {
    castItems.push({
      key: 'cast|null',
      label: `${movies.icon} Movies & TV Shows`,
      fieldType: 'cast',
      categoryId: null,
    });
  }
  if (castItems.length) {
    items.push({ group: 'Cast (shared)', items: castItems });
  }

  // 5. Unique Lists — per-category lists that aren't shared
  const uniqueItems = [];
  if (movies) {
    uniqueItems.push({
      key: 'director|null',
      label: `${movies.icon} Directors`,
      fieldType: 'director',
      categoryId: null,
    });
    uniqueItems.push({
      key: 'studio|null',
      label: `${movies.icon} Studios`,
      fieldType: 'studio',
      categoryId: null,
    });
  }
  if (books) {
    uniqueItems.push({
      key: 'author|null',
      label: `${books.icon} Authors`,
      fieldType: 'author',
      categoryId: null,
    });
  }
  // Publishers — Books and Games both use this shared list
  if (books || games) {
    uniqueItems.push({
      key: 'publisher|null',
      label: `${books?.icon ?? ''}${games?.icon ?? ''} Publishers`,
      fieldType: 'publisher',
      categoryId: null,
    });
  }
  if (games) {
    uniqueItems.push({
      key: 'developer|null',
      label: `${games.icon} Developers`,
      fieldType: 'developer',
      categoryId: null,
    });
    uniqueItems.push({
      key: 'platform|null',
      label: `${games.icon} Platforms`,
      fieldType: 'platform',
      categoryId: null,
    });
  }
  if (albums) {
    uniqueItems.push({
      key: 'artist|null',
      label: `${albums.icon} Artists`,
      fieldType: 'artist',
      categoryId: null,
    });
    uniqueItems.push({
      key: 'label|null',
      label: `${albums.icon} Record Labels`,
      fieldType: 'label',
      categoryId: null,
    });
  }
  if (uniqueItems.length) {
    items.push({ group: 'Unique Lists', items: uniqueItems });
  }

  return items;
}

// ── Refresh the nav sidebar ────────────────────────────────────────────────

async function refreshNav(container) {
  const cats = state.categories;
  const nav = container.querySelector('#settings-nav');
  const groups = buildNavItems(cats);

  nav.innerHTML = groups.map(g => `
    <div class="settings-nav-group">
      <div class="settings-nav-group-label">${esc(g.group)}</div>
      ${g.items.map(item => `
        <button class="settings-nav-item ${activeKey === item.key ? 'active' : ''}"
                data-key="${esc(item.key)}"
                data-field-type="${esc(item.fieldType)}"
                data-category-id="${item.categoryId === null ? '' : item.categoryId}">
          ${esc(item.label)}
        </button>
      `).join('')}
    </div>
  `).join('');

  nav.querySelectorAll('.settings-nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      activeKey = btn.dataset.key;
      // Update active highlight
      nav.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Load the panel
      const fieldType = btn.dataset.fieldType;
      const categoryId = btn.dataset.categoryId === '' ? null : parseInt(btn.dataset.categoryId);
      loadPanel(container, fieldType, categoryId, btn.textContent.trim());
    });
  });

  // If a list was already active, re-load its panel
  if (activeKey) {
    const activeBtn = nav.querySelector(`[data-key="${CSS.escape(activeKey)}"]`);
    if (activeBtn) {
      const fieldType = activeBtn.dataset.fieldType;
      const categoryId = activeBtn.dataset.categoryId === '' ? null : parseInt(activeBtn.dataset.categoryId);
      await loadPanel(container, fieldType, categoryId, activeBtn.textContent.trim());
    }
  }
}

// ── Load a single field list into the right panel ─────────────────────────

async function loadPanel(container, fieldType, categoryId, label) {
  const panel = container.querySelector('#settings-panel');
  panel.innerHTML = '<div class="loading-spinner" style="height:120px">Loading…</div>';

  try {
    const params = { field_type: fieldType, scoped: true };
    if (categoryId !== null) params.category_id = categoryId;
    const values = await api.getFieldValues(params);

    renderPanel(panel, fieldType, categoryId, label, values, container);
  } catch (err) {
    panel.innerHTML = `<div class="empty-state">
      <div class="empty-state-title">Failed to load</div>
      <div class="empty-state-text">${esc(err.message)}</div>
    </div>`;
  }
}

function renderPanel(panel, fieldType, categoryId, label, values, container) {
  const catIdAttr = categoryId === null ? '' : categoryId;

  const rows = values.map(fv => `
    <div class="settings-value-row" data-fv-id="${fv.id}">
      <span class="settings-value-display">${esc(fv.value)}</span>
      <input class="form-input settings-value-input hidden"
             value="${esc(fv.value)}"
             style="flex:1;padding:4px 8px;font-size:13px">
      <div class="settings-value-actions">
        <button class="btn btn-ghost btn-sm settings-rename-btn" data-fv-id="${fv.id}">✏️ Rename</button>
        <button class="btn btn-ghost btn-sm settings-save-rename-btn hidden" data-fv-id="${fv.id}">Save</button>
        <button class="btn btn-ghost btn-sm settings-cancel-rename-btn hidden" data-fv-id="${fv.id}">Cancel</button>
        <button class="btn btn-danger btn-sm settings-delete-btn"
                data-fv-id="${fv.id}"
                data-fv-value="${esc(fv.value)}">🗑️</button>
      </div>
    </div>
  `).join('');

  const emptyHint = values.length === 0
    ? `<div class="settings-empty-hint">No values yet — add one below.</div>`
    : '';

  panel.innerHTML = `
    <div class="settings-panel-header">
      <h3 class="settings-panel-title">${esc(label)}</h3>
      <span class="settings-value-count">${values.length} value${values.length !== 1 ? 's' : ''}</span>
    </div>
    <div class="settings-value-list" id="panel-value-list">
      ${emptyHint}
      ${rows}
    </div>
    <div class="settings-add-row">
      <input class="form-input settings-new-value-input"
             id="panel-add-input"
             placeholder="New value…"
             data-field-type="${esc(fieldType)}"
             data-category-id="${catIdAttr}">
      <button class="btn btn-primary btn-sm" id="panel-add-btn">Add</button>
    </div>
  `;

  // Add button
  panel.querySelector('#panel-add-btn').addEventListener('click', () => {
    handleAdd(panel, fieldType, categoryId, label, container);
  });
  panel.querySelector('#panel-add-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAdd(panel, fieldType, categoryId, label, container);
  });

  // Rename / Save / Cancel / Delete buttons
  panel.querySelectorAll('.settings-rename-btn').forEach(btn => {
    btn.addEventListener('click', () => handleRenameClick(btn));
  });
  panel.querySelectorAll('.settings-save-rename-btn').forEach(btn => {
    btn.addEventListener('click', () => handleSaveRename(btn, panel, fieldType, categoryId, label, container));
  });
  panel.querySelectorAll('.settings-cancel-rename-btn').forEach(btn => {
    btn.addEventListener('click', () => handleCancelRename(btn));
  });
  panel.querySelectorAll('.settings-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(btn, panel, fieldType, categoryId, label, container));
  });
}

// ── Action handlers ────────────────────────────────────────────────────────

async function handleAdd(panel, fieldType, categoryId, label, container) {
  const input = panel.querySelector('#panel-add-input');
  const value = input.value.trim();
  if (!value) return;

  try {
    await api.createFieldValue({ field_type: fieldType, category_id: categoryId, value, sort_order: 0 });
    showToast(`"${value}" added`, 'success');
    input.value = '';
    await reloadPanel(panel, fieldType, categoryId, label, container);
  } catch (err) {
    showToast(err.message || 'Failed to add value', 'error');
  }
}

async function handleDelete(btn, panel, fieldType, categoryId, label, container) {
  const fvId = parseInt(btn.dataset.fvId);
  const fvValue = btn.dataset.fvValue;
  if (!confirm(`Delete "${fvValue}"?`)) return;
  try {
    await api.deleteFieldValue(fvId);
    showToast(`"${fvValue}" deleted`, 'success');
    await reloadPanel(panel, fieldType, categoryId, label, container);
  } catch (err) {
    showToast(err.message || 'Failed to delete', 'error');
  }
}

function handleRenameClick(btn) {
  const row = btn.closest('.settings-value-row');
  row.querySelector('.settings-value-display').classList.add('hidden');
  row.querySelector('.settings-value-input').classList.remove('hidden');
  row.querySelector('.settings-rename-btn').classList.add('hidden');
  row.querySelector('.settings-save-rename-btn').classList.remove('hidden');
  row.querySelector('.settings-cancel-rename-btn').classList.remove('hidden');
  row.querySelector('.settings-delete-btn').classList.add('hidden');
  row.querySelector('.settings-value-input').focus();
}

function handleCancelRename(btn) {
  const row = btn.closest('.settings-value-row');
  const display = row.querySelector('.settings-value-display');
  row.querySelector('.settings-value-input').value = display.textContent.trim();
  row.querySelector('.settings-value-display').classList.remove('hidden');
  row.querySelector('.settings-value-input').classList.add('hidden');
  row.querySelector('.settings-rename-btn').classList.remove('hidden');
  row.querySelector('.settings-save-rename-btn').classList.add('hidden');
  row.querySelector('.settings-cancel-rename-btn').classList.add('hidden');
  row.querySelector('.settings-delete-btn').classList.remove('hidden');
}

async function handleSaveRename(btn, panel, fieldType, categoryId, label, container) {
  const fvId = parseInt(btn.dataset.fvId);
  const row = btn.closest('.settings-value-row');
  const newValue = row.querySelector('.settings-value-input').value.trim();
  if (!newValue) return;
  try {
    await api.updateFieldValue(fvId, { value: newValue });
    showToast('Renamed successfully', 'success');
    await reloadPanel(panel, fieldType, categoryId, label, container);
  } catch (err) {
    showToast(err.message || 'Failed to rename', 'error');
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function reloadPanel(panel, fieldType, categoryId, label, container) {
  try {
    const params = { field_type: fieldType, scoped: true };
    if (categoryId !== null) params.category_id = categoryId;
    const values = await api.getFieldValues(params);
    renderPanel(panel, fieldType, categoryId, label, values, container);
  } catch (err) {
    showToast('Failed to reload list', 'error');
  }
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
