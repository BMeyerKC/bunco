// tests/code-entry.test.js
import { normalizeCode, codeError, initCodeEntry } from '../src/js/code-entry.js';

describe('normalizeCode', () => {
  test('uppercases and strips spaces and punctuation', () => {
    expect(normalizeCode(' ab-c d ')).toBe('ABCD');
  });
  test('caps at four characters (pasting a longer string)', () => {
    expect(normalizeCode('wxyz99')).toBe('WXYZ');
  });
});

describe('codeError', () => {
  test('empty asks for the code', () => {
    expect(codeError('')).toMatch(/4-letter code/);
  });
  test('too short says how many were entered', () => {
    expect(codeError('AB')).toMatch(/entered 2/);
  });
  test('four characters is fine', () => {
    expect(codeError('ABCD')).toBeNull();
  });
});

describe('initCodeEntry', () => {
  function mount() {
    document.body.innerHTML = `
      <form>
        <div class="code-slots">
          <input id="c" />
          <span class="code-slot"></span><span class="code-slot"></span>
          <span class="code-slot"></span><span class="code-slot"></span>
        </div>
        <p class="field-error" hidden></p>
      </form>`;
    const form = document.querySelector('form');
    const onCode = jest.fn();
    initCodeEntry(form, onCode);
    return { form, onCode, input: form.querySelector('input'), error: form.querySelector('.field-error') };
  }

  test('mirrors typed characters into the slots', () => {
    const { input } = mount();
    input.value = 'xk';
    input.dispatchEvent(new Event('input'));
    const slots = [...document.querySelectorAll('.code-slot')].map(s => s.textContent);
    expect(slots).toEqual(['X', 'K', '', '']);
    expect(input.value).toBe('XK');
  });

  test('a short code shows an inline error instead of submitting', () => {
    const { form, onCode, input, error } = mount();
    input.value = 'AB';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(onCode).not.toHaveBeenCalled();
    expect(error.hidden).toBe(false);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  test('a full code is handed to the callback', () => {
    const { form, onCode, input } = mount();
    input.value = 'q7rt';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(onCode).toHaveBeenCalledWith('Q7RT');
  });
});
