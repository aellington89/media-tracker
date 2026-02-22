const GRADES = ['F', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];

function gradeColor(grade) {
  if (!grade) return 'var(--text-muted)';
  if (grade === 'F')                    return '#ef4444';
  if (grade.startsWith('D'))            return '#f97316';
  if (grade.startsWith('C'))            return '#eab308';
  if (grade.startsWith('B'))            return '#22c55e';
  return '#6366f1'; // A grades
}

// Renders a grade badge (readonly) or a grade select (interactive).
export function renderGrade(rating, readonly = false) {
  if (readonly) {
    const display = rating || '—';
    return `<span class="grade-badge" style="color:${gradeColor(rating)}">${display}</span>`;
  }
  const options = GRADES.map(g =>
    `<option value="${g}" ${rating === g ? 'selected' : ''}>${g}</option>`
  ).join('');
  return `<select class="grade-select" id="grade-select">
    <option value="">— Grade —</option>
    ${options}
  </select>`;
}

// Backwards-compatible alias used by library.js
export function renderStars(rating, readonly = false) {
  return renderGrade(rating, readonly);
}

// Initialises the grade select in the modal form, calling onChange when changed.
export function initGradeWidget(container, initialRating, onChange) {
  const sel = container.querySelector('#grade-select');
  if (!sel) return;
  sel.addEventListener('change', () => {
    onChange(sel.value || null);
  });
}

// Backwards-compatible alias used by modal.js
export function initRatingWidget(container, initialRating, onChange) {
  return initGradeWidget(container, initialRating, onChange);
}
