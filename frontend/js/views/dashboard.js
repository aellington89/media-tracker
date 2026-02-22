import * as api from '../api.js';
import { renderStars } from '../components/rating.js';
import { openModal } from '../components/modal.js';

const STATUS_LABELS = {
  wishlist: 'Wishlist',
  owned:    'Owned',
};

const STATUS_COLORS = {
  wishlist: '#818cf8',
  owned:    '#4ade80',
};

export async function renderDashboard(container) {
  const [stats, recent] = await Promise.all([api.getStats(), api.getRecent()]);

  const maxCat = Math.max(1, ...stats.by_category.map(c => c.count));

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Dashboard</div>
        <div class="page-subtitle">${stats.total_items} items tracked</div>
      </div>
    </div>

    <div class="dashboard">
      <div class="stat-cards">
        ${Object.entries(stats.by_status).map(([s, n]) => `
          <div class="stat-card">
            <div class="stat-card-label">${STATUS_LABELS[s]}</div>
            <div class="stat-card-value" style="color:${STATUS_COLORS[s]}">${n}</div>
            <div class="stat-card-sub">${stats.total_items > 0 ? Math.round(n / stats.total_items * 100) : 0}% of total</div>
          </div>
        `).join('')}
      </div>

      ${stats.by_category.some(c => c.count > 0) ? `
      <div class="dashboard-section">
        <h2>By Category</h2>
        ${stats.by_category.map(c => `
          <div class="category-bar-row">
            <div class="category-bar-label">
              <span>${c.icon}</span>
              <span>${c.name}</span>
            </div>
            <div class="category-bar-track">
              <div class="category-bar-fill"
                   style="width:${Math.round(c.count / maxCat * 100)}%; background:${c.color}">
              </div>
            </div>
            <div class="category-bar-count">${c.count}</div>
          </div>
        `).join('')}
      </div>
      ` : ''}

      ${stats.avg_rating > 0 ? `
      <div class="dashboard-section">
        <h2>Ratings Overview</h2>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          <span style="font-size:28px;font-weight:800;color:var(--text-primary)">${stats.avg_rating}</span>
          <div>${renderStars(Math.round(stats.avg_rating))}</div>
          <span style="font-size:12px;color:var(--text-muted)">average</span>
        </div>
        ${Object.entries(stats.rating_distribution).reverse().map(([r, n]) => {
          const total = Object.values(stats.rating_distribution).reduce((a, b) => a + b, 0);
          const pct = total > 0 ? Math.round(n / total * 100) : 0;
          return `
          <div class="category-bar-row">
            <div class="category-bar-label" style="width:60px">
              ${'★'.repeat(parseInt(r))}
            </div>
            <div class="category-bar-track">
              <div class="category-bar-fill" style="width:${pct}%; background:#f59e0b"></div>
            </div>
            <div class="category-bar-count">${n}</div>
          </div>`;
        }).join('')}
      </div>
      ` : ''}

      ${recent.length > 0 ? `
      <div class="dashboard-section">
        <h2>Recently Owned</h2>
        <div class="recent-grid">
          ${recent.map(item => recentCard(item)).join('')}
        </div>
      </div>
      ` : ''}

      ${stats.total_items === 0 ? `
      <div class="empty-state" style="padding:60px 0">
        <div class="empty-state-icon">🗂️</div>
        <div class="empty-state-title">No media yet</div>
        <div class="empty-state-text">Click "Add Media" in the sidebar to start tracking your books, movies, games, albums, and more.</div>
      </div>
      ` : ''}
    </div>
  `;

  // Attach click handlers for recent cards
  container.querySelectorAll('[data-item-id]').forEach(el => {
    el.addEventListener('click', () => openModal(parseInt(el.dataset.itemId)));
  });
}

function recentCard(item) {
  const cover = item.cover_image_url
    ? `<img class="card-cover" src="${item.cover_image_url}" alt="${esc(item.title)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
    : '';
  return `
    <div class="media-card" data-item-id="${item.id}" style="cursor:pointer">
      ${cover}
      <div class="card-cover-placeholder" ${item.cover_image_url ? 'style="display:none"' : ''}>
        ${item.category_icon}
      </div>
      <div class="card-body">
        <div class="card-title">${esc(item.title)}</div>
        <div>${renderStars(item.rating || 0, true)}</div>
      </div>
    </div>
  `;
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
