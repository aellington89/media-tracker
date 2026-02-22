// Shared application state, event bus, and modal helper.
// Kept in its own module to prevent circular import issues between app.js and views.

export const state = {
  categories: [],
  tags: [],
};

export const bus = new EventTarget();

// closeModal is here (not in app.js) so that modal.js can import it
// without creating a circular dependency with app.js.
export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}
