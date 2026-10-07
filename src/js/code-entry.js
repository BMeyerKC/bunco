// js/code-entry.js — the four-slot game code field.
//
// One real <input> sits over four decorative slots, so typing, pasting,
// autofill and screen readers all see an ordinary text field. The slots just
// mirror its value.
//
// Markup:
//   <form data-code-form>
//     <div class="code-slots"><input ...><span class="code-slot"></span>×4</div>
//     <p class="field-error" hidden></p>
//   </form>

export const CODE_LENGTH = 4;

/** Uppercases and strips anything that can't be part of a game code. */
export function normalizeCode(raw) {
  return String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
}

/** @returns {string|null} an error message, or null when the code is usable */
export function codeError(code) {
  if (code.length === 0) return 'Enter the 4-letter code from your host.';
  if (code.length < CODE_LENGTH) return `Game codes have 4 characters. You've entered ${code.length}.`;
  return null;
}

/**
 * @param {HTMLFormElement} form
 * @param {(code: string) => void} onCode - called with a valid code on submit
 */
export function initCodeEntry(form, onCode) {
  const input = form.querySelector('input');
  const slots = [...form.querySelectorAll('.code-slot')];
  const error = form.querySelector('.field-error');

  const render = () => {
    const value = normalizeCode(input.value);
    if (input.value !== value) input.value = value;
    slots.forEach((slot, i) => {
      slot.textContent = value[i] ?? '';
      slot.classList.toggle('is-filled', i < value.length);
      slot.classList.toggle('is-next', i === Math.min(value.length, CODE_LENGTH - 1));
    });
  };

  const setError = (msg) => {
    error.textContent = msg ?? '';
    error.hidden = !msg;
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };

  input.addEventListener('input', () => { render(); setError(null); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = normalizeCode(input.value);
    const msg = codeError(code);
    if (msg) { setError(msg); input.focus(); return; }
    onCode(code);
  });

  render();
}
