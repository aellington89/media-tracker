import * as api from '../api.js';
import { bus } from '../state.js';
import { showToast } from '../components/toast.js';

export async function renderCategories(container) {
  const cats = await api.getCategories();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Manage Categories</div>
        <div class="page-subtitle">Built-in categories cannot be deleted</div>
      </div>
    </div>

    <div class="categories-page">
      <div class="category-list" id="cat-list">
        ${cats.map(c => categoryRow(c)).join('')}
      </div>

      <div style="margin-top:20px">
        <button class="btn btn-secondary" id="show-add-form-btn">+ New Category</button>
      </div>

      <div class="add-category-form hidden" id="add-cat-form">
        <h3>Add Category</h3>
        <div class="form-row" style="margin-bottom:12px">
          <div class="form-group" style="margin:0">
            <label class="form-label">Name</label>
            <input type="text" class="form-input" id="new-cat-name" placeholder="e.g. Podcasts">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Icon (emoji)</label>
            <input type="text" class="form-input" id="new-cat-icon" placeholder="🎙️" maxlength="4">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Color</label>
          <input type="color" class="color-input" id="new-cat-color" value="#6366f1">
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn btn-primary" id="save-cat-btn">Save Category</button>
          <button class="btn btn-secondary" id="cancel-cat-btn">Cancel</button>
        </div>
      </div>
    </div>
  `;

  // Show/hide add form
  container.querySelector('#show-add-form-btn').addEventListener('click', () => {
    container.querySelector('#add-cat-form').classList.remove('hidden');
    container.querySelector('#show-add-form-btn').classList.add('hidden');
  });

  container.querySelector('#cancel-cat-btn').addEventListener('click', () => {
    container.querySelector('#add-cat-form').classList.add('hidden');
    container.querySelector('#show-add-form-btn').classList.remove('hidden');
  });

  // Save new category
  container.querySelector('#save-cat-btn').addEventListener('click', async () => {
    const name = container.querySelector('#new-cat-name').value.trim();
    const icon = container.querySelector('#new-cat-icon').value.trim() || '📁';
    const color = container.querySelector('#new-cat-color').value;

    if (!name) { showToast('Name is required', 'error'); return; }

    try {
      await api.createCategory({ name, icon, color });
      showToast(`Category "${name}" created`, 'success');
      bus.dispatchEvent(new Event('categories-changed'));
      await renderCategories(container);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Delete handlers
  container.querySelectorAll('[data-delete-cat]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.deleteCat);
      const name = btn.dataset.catName;
      if (!confirm(`Delete category "${name}"? This will fail if it has items.`)) return;
      try {
        await api.deleteCategory(id);
        showToast(`Category "${name}" deleted`, 'success');
        bus.dispatchEvent(new Event('categories-changed'));
        await renderCategories(container);
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

function categoryRow(c) {
  return `
    <div class="category-row">
      <div class="category-icon-preview">${c.icon}</div>
      <div class="category-color-dot" style="background:${c.color}"></div>
      <div class="category-name">${esc(c.name)}</div>
      <div class="category-count">${c.item_count} items</div>
      ${c.is_system
        ? '<span class="system-badge">Built-in</span>'
        : `<button class="btn btn-danger btn-sm"
                  data-delete-cat="${c.id}"
                  data-cat-name="${esc(c.name)}">Delete</button>`
      }
    </div>
  `;
}

function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
