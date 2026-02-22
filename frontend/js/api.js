const BASE = 'http://127.0.0.1:8765/api';

async function request(method, path, body = undefined) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || `HTTP ${res.status}`);
  return json;
}

// ── Media ──────────────────────────────────────────────────────────────────
export function getMedia(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') qs.set(k, v);
  }
  const q = qs.toString();
  return request('GET', `/media${q ? '?' + q : ''}`);
}

export function getMediaItem(id)        { return request('GET',    `/media/${id}`); }
export function createMedia(data)       { return request('POST',   '/media', data); }
export function updateMedia(id, data)   { return request('PUT',    `/media/${id}`, data); }
export function deleteMedia(id)         { return request('DELETE', `/media/${id}`); }
export function setMediaTags(id, tagIds){ return request('POST',   `/media/${id}/tags`, tagIds); }

// ── Categories ─────────────────────────────────────────────────────────────
export function getCategories()           { return request('GET',    '/categories'); }
export function createCategory(data)      { return request('POST',   '/categories', data); }
export function updateCategory(id, data)  { return request('PUT',    `/categories/${id}`, data); }
export function deleteCategory(id)        { return request('DELETE', `/categories/${id}`); }

// ── Tags ───────────────────────────────────────────────────────────────────
export function getTags()             { return request('GET',    '/tags'); }
export function createTag(data)       { return request('POST',   '/tags', data); }
export function updateTag(id, data)   { return request('PUT',    `/tags/${id}`, data); }
export function deleteTag(id)         { return request('DELETE', `/tags/${id}`); }

// ── Stats ──────────────────────────────────────────────────────────────────
export function getStats()  { return request('GET', '/stats/overview'); }
export function getRecent() { return request('GET', '/stats/recent'); }

// ── Field Values ────────────────────────────────────────────────────────────
export function getFieldValues(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '') qs.set(k, v);
  }
  const q = qs.toString();
  return request('GET', `/field-values${q ? '?' + q : ''}`);
}
export function createFieldValue(data)      { return request('POST',   '/field-values', data); }
export function updateFieldValue(id, data)  { return request('PUT',    `/field-values/${id}`, data); }
export function deleteFieldValue(id)        { return request('DELETE', `/field-values/${id}`); }

// ── Cover Upload ─────────────────────────────────────────────────────────────
export async function uploadCoverImage(file) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE}/upload/cover`, { method: 'POST', body: form });
  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || `HTTP ${res.status}`);
  return json; // { url: '/uploads/...' }
}
