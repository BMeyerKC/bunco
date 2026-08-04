import {
  validateFeedbackMessage,
  buildFeedbackPayload,
  MAX_MESSAGE_LENGTH,
  MAX_CONTACT_LENGTH,
} from '../src/js/feedback-logic.js';

const fullInput = {
  message:  '  The round counter confused me.  ',
  contact:  '  player@example.com  ',
  page:     '/game.html?code=AB2D',
  code:     'AB2D',
  version:  '1.4.0',
  theme:    'light',
  ua:       'Mozilla/5.0 (iPhone)',
  deviceId: 'k3j4h5g6',
};

describe('validateFeedbackMessage', () => {
  test('rejects an empty string', () => {
    expect(validateFeedbackMessage('')).toEqual({ valid: false, message: '' });
  });

  test('rejects whitespace-only input', () => {
    expect(validateFeedbackMessage('   \n\t  ')).toEqual({ valid: false, message: '' });
  });

  test('rejects a non-string', () => {
    expect(validateFeedbackMessage(undefined)).toEqual({ valid: false, message: '' });
  });

  test('trims surrounding whitespace', () => {
    expect(validateFeedbackMessage('  hello  ')).toEqual({ valid: true, message: 'hello' });
  });

  test('caps the message at MAX_MESSAGE_LENGTH', () => {
    const result = validateFeedbackMessage('x'.repeat(MAX_MESSAGE_LENGTH + 50));
    expect(result.valid).toBe(true);
    expect(result.message).toHaveLength(MAX_MESSAGE_LENGTH);
  });
});

describe('buildFeedbackPayload', () => {
  test('builds the documented feedback shape', () => {
    const { feedback } = buildFeedbackPayload(fullInput);
    expect(feedback).toEqual({
      message:  'The round counter confused me.',
      page:     '/game.html?code=AB2D',
      code:     'AB2D',
      version:  '1.4.0',
      theme:    'light',
      ua:       'Mozilla/5.0 (iPhone)',
      deviceId: 'k3j4h5g6',
    });
  });

  test('never puts contact information in the feedback payload', () => {
    const { feedback } = buildFeedbackPayload(fullInput);
    expect(JSON.stringify(feedback)).not.toContain('player@example.com');
  });

  test('returns the trimmed contact separately', () => {
    expect(buildFeedbackPayload(fullInput).contact).toBe('player@example.com');
  });

  test('returns null contact when the field is blank', () => {
    expect(buildFeedbackPayload({ ...fullInput, contact: '   ' }).contact).toBeNull();
  });

  test('returns null contact when the field is absent', () => {
    expect(buildFeedbackPayload({ message: 'hi' }).contact).toBeNull();
  });

  test('caps the contact at MAX_CONTACT_LENGTH', () => {
    const contact = 'a'.repeat(MAX_CONTACT_LENGTH + 50);
    expect(buildFeedbackPayload({ message: 'hi', contact }).contact)
      .toHaveLength(MAX_CONTACT_LENGTH);
  });

  test('normalises absent optional fields to null', () => {
    const { feedback } = buildFeedbackPayload({ message: 'hi' });
    expect(feedback).toEqual({
      message: 'hi', page: null, code: null,
      version: null, theme: null, ua: null, deviceId: null,
    });
  });

  test('truncates a very long user agent', () => {
    const { feedback } = buildFeedbackPayload({ message: 'hi', ua: 'u'.repeat(500) });
    expect(feedback.ua).toHaveLength(300);
  });

  test('truncates a very long page to 300 characters', () => {
    const { feedback } = buildFeedbackPayload({ message: 'hi', page: '/game.html?code=' + 'p'.repeat(500) });
    expect(feedback.page).toHaveLength(300);
  });

  test('truncates a very long code to 8 characters', () => {
    const { feedback } = buildFeedbackPayload({ message: 'hi', code: 'x'.repeat(50) });
    expect(feedback.code).toHaveLength(8);
  });

  test('truncates a very long version to 40 characters', () => {
    const { feedback } = buildFeedbackPayload({ message: 'hi', version: 'v'.repeat(60) });
    expect(feedback.version).toHaveLength(40);
  });

  test('truncates a very long theme to 10 characters', () => {
    const { feedback } = buildFeedbackPayload({ message: 'hi', theme: 't'.repeat(20) });
    expect(feedback.theme).toHaveLength(10);
  });

  test('truncates a very long deviceId to 40 characters', () => {
    const { feedback } = buildFeedbackPayload({ message: 'hi', deviceId: 'd'.repeat(60) });
    expect(feedback.deviceId).toHaveLength(40);
  });

  test('leaves normal page and code values untouched', () => {
    const { feedback } = buildFeedbackPayload({ message: 'hi', page: '/game.html?code=AB2D', code: 'AB2D' });
    expect(feedback.page).toBe('/game.html?code=AB2D');
    expect(feedback.code).toBe('AB2D');
  });

  test('throws when the message is empty', () => {
    expect(() => buildFeedbackPayload({ message: '   ' })).toThrow('feedback-message-empty');
  });

  test('does not set createdAt - that is firebase.js job', () => {
    const { feedback } = buildFeedbackPayload(fullInput);
    expect(feedback.createdAt).toBeUndefined();
  });
});
