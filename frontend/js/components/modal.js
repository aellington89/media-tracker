import * as api from '../api.js';
import { state, bus, closeModal } from '../state.js';
import { renderGrade, initGradeWidget } from './rating.js';
import { showToast } from './toast.js';

// Fields per category.
// listType     → backed by a user-defined field-value list
// useCategory  → list is scoped to the specific category (genre, sub_genre)
// multiSelect  → renders a <select multiple> for multi-value fields (cast)
// type:'number'→ plain number input
// (no listType)→ plain text input
const CATEGORY_FIELDS = {
  'Books': [
    { key: 'author',    label: 'Author',    listType: 'author' },
    { key: 'publisher', label: 'Publisher', listType: 'publisher' },
    { key: 'format',    label: 'Format',    listType: 'format_book' },
    { key: 'year',      label: 'Year',      type: 'number' },
    { key: 'isbn',      label: 'ISBN' },
    { key: 'genre',     label: 'Genre',     listType: 'genre', useCategory: true },
  ],
  'Movies': [
    { key: 'director',  label: 'Director',  listType: 'director' },
    { key: 'studio',    label: 'Studio',    listType: 'studio' },
    { key: 'format',    label: 'Format',    listType: 'format_movie' },
    { key: 'year',      label: 'Year',      type: 'number' },
    { key: 'runtime',   label: 'Runtime (min)', type: 'number' },
    { key: 'genre',     label: 'Genre',     listType: 'genre', useCategory: true },
    { key: 'cast',      label: 'Cast',      listType: 'cast', multiSelect: true },
  ],
  'Games': [
    { key: 'developer', label: 'Developer', listType: 'developer' },
    { key: 'publisher', label: 'Publisher', listType: 'publisher' },
    { key: 'year',      label: 'Year',      type: 'number' },
    { key: 'platform',  label: 'Platform',  listType: 'platform' },
    { key: 'genre',     label: 'Genre',     listType: 'genre', useCategory: true },
    { key: 'format',    label: 'Format',    listType: 'format_game' },
  ],
  'Albums': [
    { key: 'artist',     label: 'Artist',     listType: 'artist' },
    { key: 'label',      label: 'Label',      listType: 'label' },
    { key: 'year',       label: 'Year',       type: 'number' },
    { key: 'genre',      label: 'Genre',      listType: 'genre',     useCategory: true },
    { key: 'sub_genre',  label: 'Sub-Genre',  listType: 'sub_genre', useCategory: true },
    { key: 'format',     label: 'Format',     listType: 'format_album' },
    { key: 'label_code', label: 'Label Code' },
  ],
  'TV Shows': [
    { key: 'format',    label: 'Format',    listType: 'format_movie' },
    { key: 'year',      label: 'Year',      type: 'number' },
    { key: 'genre',     label: 'Genre',     listType: 'genre', useCategory: true },
    { key: 'cast',      label: 'Cast',      listType: 'cast', multiSelect: true },
  ],
};

const STATUS_OPTIONS = [
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'owned',    label: 'Owned' },
];

let formState = {};
let selectedTagIds = [];
let allTags = [];
// Cache of field values: key = "fieldType|categoryId" → array of value strings
let fieldValueCache = {};

export async function openModal(itemId, defaultCategoryId = null) {
  const overlay = document.getElementById('modal-overlay');
  const title   = document.getElementById('modal-title');
  const body    = document.getElementById('modal-body');

  // Load tags and all field values fresh
  [allTags] = await Promise.all([
    api.getTags(),
    loadFieldValueCache(),
  ]);

  let item = null;
  if (itemId) {
    item = await api.getMediaItem(itemId);
    title.textContent = 'Edit Media';
  } else {
    title.textContent = 'Add Media';
  }

  formState = {
    id: item?.id || null,
    title: item?.title || '',
    category_id: item?.category_id || defaultCategoryId || (state.categories[0]?.id || null),
    status: item?.status || 'wishlist',
    rating: item?.rating || null,
    notes: item?.notes || '',
    cover_image_url: item?.cover_image_url || null,
    metadata: item?.metadata || {},
  };

  selectedTagIds = item ? item.tags.map(t => t.id) : [];

  body.innerHTML = buildForm();

  overlay.classList.remove('hidden');

  // Focus title
  document.getElementById('field-title')?.focus();

  // Grade widget
  initGradeWidget(body, formState.rating, (val) => { formState.rating = val; });

  // Cover image preview and upload handler
  initCoverUpload(body);

  // Status buttons
  body.querySelectorAll('.status-option').forEach(btn => {
    btn.addEventListener('click', () => {
      formState.status = btn.dataset.status;
      body.querySelectorAll('.status-option').forEach(b => b.className = `status-option`);
      btn.className = `status-option selected-${formState.status}`;
    });
  });

  // Category change → update metadata fields
  body.querySelector('#field-category')?.addEventListener('change', (e) => {
    formState.category_id = parseInt(e.target.value);
    renderMetaFields(body);
  });

  // Tag input
  initTagInput(body);

  // Remove existing footer if any, then add
  const existingFooter = document.querySelector('.modal-footer');
  if (existingFooter) existingFooter.remove();

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  footer.innerHTML = `
    <button class="btn btn-secondary" id="modal-cancel-btn">Cancel</button>
    <button class="btn btn-primary" id="modal-save-btn">
      ${item ? 'Save Changes' : 'Add Media'}
    </button>
  `;
  document.querySelector('.modal').appendChild(footer);

  document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);
  document.getElementById('modal-save-btn').addEventListener('click', () => saveForm(itemId));
}

async function loadFieldValueCache() {
  try {
    const allValues = await api.getFieldValues();
    fieldValueCache = {};
    for (const fv of allValues) {
      const key = `${fv.field_type}|${fv.category_id ?? 'null'}`;
      if (!fieldValueCache[key]) fieldValueCache[key] = [];
      fieldValueCache[key].push(fv.value);
    }
  } catch (e) {
    fieldValueCache = {};
  }
}

function getFieldOptions(listType, categoryId, useCategory) {
  if (useCategory) {
    const key = `${listType}|${categoryId ?? 'null'}`;
    return fieldValueCache[key] || [];
  }
  // Global / shared list (category_id = null)
  const key = `${listType}|null`;
  return fieldValueCache[key] || [];
}

function buildForm() {
  const cats = state.categories;

  return `
    <div class="form-group">
      <label class="form-label">Title *</label>
      <input type="text" class="form-input" id="field-title"
             value="${esc(formState.title)}" placeholder="Enter title…">
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-select" id="field-category">
          ${cats.map(c => `<option value="${c.id}" ${c.id === formState.category_id ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Rating</label>
        ${renderGrade(formState.rating)}
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Status</label>
      <div class="status-grid">
        ${STATUS_OPTIONS.map(s => `
          <button class="status-option ${formState.status === s.value ? 'selected-' + s.value : ''}"
                  data-status="${s.value}">${s.label}</button>
        `).join('')}
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Cover Image</label>
      <div class="cover-upload-group">
        ${formState.cover_image_url
          ? `<img class="cover-preview" id="cover-preview" src="${esc(formState.cover_image_url)}" alt="Cover">`
          : `<img class="cover-preview hidden" id="cover-preview" alt="Cover">`
        }
        <div class="cover-upload-controls">
          <label class="btn btn-secondary cover-upload-btn">
            📁 Choose Image
            <input type="file" id="field-cover-file"
                   accept="image/jpeg,image/png,image/gif,image/webp" hidden>
          </label>
          <span class="cover-filename" id="cover-filename">
            ${formState.cover_image_url ? formState.cover_image_url.split('/').pop() : 'No file chosen'}
          </span>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Tags</label>
      <div class="tag-input-container" id="tag-container" style="position:relative">
        <div id="tag-chips">${renderTagChips()}</div>
        <input type="text" class="tag-text-input" id="tag-text" placeholder="Add tag…">
        <div class="tag-suggestions hidden" id="tag-suggestions"></div>
      </div>
    </div>

    <div id="meta-fields">
      ${buildMetaFields(state.categories.find(c => c.id === formState.category_id))}
    </div>

    <div class="form-group">
      <label class="form-label">Notes / Review</label>
      <textarea class="form-textarea" id="field-notes" rows="3"
                placeholder="Your thoughts…">${esc(formState.notes)}</textarea>
    </div>
  `;
}

function initCoverUpload(body) {
  const fileInput = body.querySelector('#field-cover-file');
  const preview   = body.querySelector('#cover-preview');
  const filename  = body.querySelector('#cover-filename');

  if (!fileInput) return;

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    filename.textContent = 'Uploading…';
    try {
      const result = await api.uploadCoverImage(file);
      formState.cover_image_url = result.url;
      preview.src = result.url;
      preview.classList.remove('hidden');
      filename.textContent = file.name;
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
      filename.textContent = 'Upload failed';
    }
  });
}

function buildMetaFields(cat) {
  if (!cat) return '';
  const fields = CATEGORY_FIELDS[cat.name] || [];
  if (!fields.length) return '';
  return `
    <div class="form-group">
      <label class="form-label">Details (${esc(cat.name)})</label>
      <div class="form-row" style="flex-wrap:wrap">
        ${fields.map(f => buildMetaField(f, cat.id)).join('')}
      </div>
    </div>
  `;
}

function buildMetaField(f, categoryId) {
  const currentVal = formState.metadata[f.key];

  if (f.listType && f.multiSelect) {
    const options = getFieldOptions(f.listType, categoryId, f.useCategory);
    const selectedArr = Array.isArray(currentVal) ? currentVal : [];
    const hint = options.length === 0
      ? ` title="No values yet — add some in Settings"`
      : '';
    const optionsHtml = options.map(v =>
      `<option value="${esc(v)}" ${selectedArr.includes(v) ? 'selected' : ''}>${esc(v)}</option>`
    ).join('');
    return `
      <div class="form-group" style="margin-bottom:8px;width:100%">
        <label class="form-label" style="font-size:11px">${esc(f.label)}</label>
        <select class="form-select meta-field cast-select" data-key="${f.key}" multiple size="4"${hint}>
          ${optionsHtml}
        </select>
        <div class="cast-hint">Hold Ctrl / Cmd to select multiple</div>
      </div>`;
  }

  if (f.listType) {
    const options = getFieldOptions(f.listType, categoryId, f.useCategory);
    const optionsHtml = options.map(v =>
      `<option value="${esc(v)}" ${currentVal === v ? 'selected' : ''}>${esc(v)}</option>`
    ).join('');
    const hint = options.length === 0
      ? ` title="No values yet — add some in Settings"`
      : '';
    return `
      <div class="form-group" style="margin-bottom:8px">
        <label class="form-label" style="font-size:11px">${esc(f.label)}</label>
        <select class="form-select meta-field" data-key="${f.key}"${hint}>
          <option value="">— Select ${esc(f.label)} —</option>
          ${optionsHtml}
        </select>
      </div>`;
  }

  // Plain input (number or text)
  return `
    <div class="form-group" style="margin-bottom:8px">
      <label class="form-label" style="font-size:11px">${esc(f.label)}</label>
      <input type="${f.type || 'text'}" class="form-input meta-field"
             data-key="${f.key}"
             value="${esc(currentVal || '')}"
             placeholder="${esc(f.label)}">
    </div>`;
}

function renderMetaFields(body) {
  const cat = state.categories.find(c => c.id === formState.category_id);
  const container = body.querySelector('#meta-fields');
  if (container) container.innerHTML = buildMetaFields(cat);
}

function renderTagChips() {
  return selectedTagIds.map(id => {
    const tag = allTags.find(t => t.id === id);
    if (!tag) return '';
    return `<span class="tag-chip" data-tag-id="${id}">
      ${esc(tag.name)}
      <button class="tag-chip-remove" data-remove-tag="${id}">×</button>
    </span>`;
  }).join('');
}

function initTagInput(body) {
  const container  = body.querySelector('#tag-container');
  const textInput  = body.querySelector('#tag-text');
  const suggestions = body.querySelector('#tag-suggestions');
  const chipsEl    = body.querySelector('#tag-chips');

  if (!textInput) return;

  // Remove tag on chip click
  chipsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-tag]');
    if (!btn) return;
    const id = parseInt(btn.dataset.removeTag);
    selectedTagIds = selectedTagIds.filter(t => t !== id);
    chipsEl.innerHTML = renderTagChips();
    initTagInput(body);
  });

  textInput.addEventListener('input', () => {
    const q = textInput.value.toLowerCase();
    const matches = allTags.filter(t =>
      t.name.toLowerCase().includes(q) && !selectedTagIds.includes(t.id)
    );
    if (!q && !matches.length) {
      suggestions.classList.add('hidden');
      return;
    }
    const html = matches.slice(0, 8).map(t =>
      `<div class="tag-suggestion" data-tag-id="${t.id}">
         <span style="width:8px;height:8px;border-radius:50%;background:${t.color};display:inline-block"></span>
         ${esc(t.name)}
       </div>`
    ).join('');

    const createHtml = q && !allTags.some(t => t.name.toLowerCase() === q)
      ? `<div class="tag-suggestion" data-create-tag="${esc(q)}">+ Create "${esc(q)}"</div>`
      : '';

    suggestions.innerHTML = html + createHtml;
    suggestions.classList.toggle('hidden', !html && !createHtml);
  });

  suggestions.addEventListener('click', async (e) => {
    const item = e.target.closest('[data-tag-id]');
    const create = e.target.closest('[data-create-tag]');

    if (item) {
      const id = parseInt(item.dataset.tagId);
      if (!selectedTagIds.includes(id)) selectedTagIds.push(id);
      textInput.value = '';
      suggestions.classList.add('hidden');
      chipsEl.innerHTML = renderTagChips();
      initTagInput(body);
    } else if (create) {
      const name = create.dataset.createTag;
      try {
        const newTag = await api.createTag({ name });
        allTags.push(newTag);
        selectedTagIds.push(newTag.id);
        textInput.value = '';
        suggestions.classList.add('hidden');
        chipsEl.innerHTML = renderTagChips();
        initTagInput(body);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  // Hide on outside click
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) suggestions.classList.add('hidden');
  }, { capture: true, once: false });
}

async function saveForm(itemId) {
  const body = document.getElementById('modal-body');

  // Collect form values
  const title = document.getElementById('field-title')?.value.trim();
  if (!title) { showToast('Title is required', 'error'); return; }

  const category_id = parseInt(document.getElementById('field-category')?.value);
  const notes = document.getElementById('field-notes')?.value.trim();

  // Collect metadata from dynamic fields (selects, multi-selects, and inputs)
  const metadata = {};
  body.querySelectorAll('.meta-field').forEach(el => {
    if (el.tagName === 'SELECT' && el.multiple) {
      const vals = Array.from(el.selectedOptions).map(o => o.value).filter(Boolean);
      if (vals.length) metadata[el.dataset.key] = vals;
    } else if (el.value) {
      metadata[el.dataset.key] = el.value;
    }
  });

  const data = {
    title,
    category_id,
    status: formState.status,
    rating: formState.rating || null,
    notes: notes || null,
    cover_image_url: formState.cover_image_url || null,
    metadata,
    tag_ids: selectedTagIds,
  };

  try {
    const saveBtn = document.getElementById('modal-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    if (itemId) {
      await api.updateMedia(itemId, data);
      showToast('Updated successfully', 'success');
    } else {
      await api.createMedia(data);
      showToast('Added successfully', 'success');
    }

    closeModal();
    bus.dispatchEvent(new Event('media-saved'));
  } catch (err) {
    showToast(err.message, 'error');
    const saveBtn = document.getElementById('modal-save-btn');
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = itemId ? 'Save Changes' : 'Add Media'; }
  }
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
