// js/feedback-logic.js — pure feedback validation and payload construction.
// No Firebase, no DOM, no clock. Mirrors the game-logic.js pattern.

export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_CONTACT_LENGTH = 200;
const MAX_UA_LENGTH = 300;
const MAX_PAGE_LENGTH = 300;
const MAX_CODE_LENGTH = 8;
const MAX_VERSION_LENGTH = 40;
const MAX_THEME_LENGTH = 10;
const MAX_DEVICE_ID_LENGTH = 40;

/**
 * Validates and normalises a raw feedback message.
 * @param {string} raw
 * @returns {{ valid: boolean, message: string }}
 */
export function validateFeedbackMessage(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  if (!trimmed) return { valid: false, message: '' };
  return { valid: true, message: trimmed.slice(0, MAX_MESSAGE_LENGTH) };
}

/**
 * Splits raw form input into the two payloads that get written to
 * separate database nodes. The feedback payload is world-readable, so
 * contact information must never appear in it.
 * @param {object} input
 * @returns {{ feedback: object, contact: string|null }}
 * @throws {Error} 'feedback-message-empty' when the message is blank
 */
export function buildFeedbackPayload(input = {}) {
  const { valid, message } = validateFeedbackMessage(input.message);
  if (!valid) throw new Error('feedback-message-empty');

  const contact = typeof input.contact === 'string' ? input.contact.trim() : '';

  return {
    feedback: {
      message,
      page:     input.page     ? String(input.page).slice(0, MAX_PAGE_LENGTH)         : null,
      code:     input.code     ? String(input.code).slice(0, MAX_CODE_LENGTH)         : null,
      version:  input.version  ? String(input.version).slice(0, MAX_VERSION_LENGTH)   : null,
      theme:    input.theme    ? String(input.theme).slice(0, MAX_THEME_LENGTH)       : null,
      ua:       input.ua ? String(input.ua).slice(0, MAX_UA_LENGTH) : null,
      deviceId: input.deviceId ? String(input.deviceId).slice(0, MAX_DEVICE_ID_LENGTH) : null,
    },
    contact: contact ? contact.slice(0, MAX_CONTACT_LENGTH) : null,
  };
}
