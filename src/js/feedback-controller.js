// js/feedback-controller.js — wires the FeedbackWidget DOM to Firebase.

import { submitFeedback } from './firebase.js';
import { validateFeedbackMessage, buildFeedbackPayload } from './feedback-logic.js';
import { showToast, getParam, getDeviceId } from './ui.js';

/**
 * Binds the feedback modal. No-ops on pages that opt out of the widget
 * (admin, debug, tests), where the markup is absent.
 */
export function initFeedback() {
  const form = document.getElementById('feedback-form');
  if (!form) return;

  const messageEl = document.getElementById('feedback-message');
  const contactEl = document.getElementById('feedback-contact');
  const sendBtn   = document.getElementById('feedback-send');
  const modalEl   = document.getElementById('feedback-modal');

  const syncSendButton = () => {
    sendBtn.disabled = !validateFeedbackMessage(messageEl.value).valid;
  };

  messageEl.addEventListener('input', syncSendButton);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateFeedbackMessage(messageEl.value).valid) return;

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending…';

    try {
      const { feedback, contact } = buildFeedbackPayload({
        message:  messageEl.value,
        contact:  contactEl.value,
        page:     window.location.pathname + window.location.search,
        code:     getParam('code'),
        version:  form.dataset.version,
        theme:    document.documentElement.getAttribute('data-theme'),
        ua:       navigator.userAgent,
        deviceId: getDeviceId(),
      });

      await submitFeedback(feedback, contact);

      messageEl.value = '';
      contactEl.value = '';
      window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
      showToast('Thanks — we got it!', 'success');
    } catch (err) {
      // Leave the text in place so a retry costs the user nothing.
      console.error('[feedback] submit failed', err);
      showToast("Couldn't send — try again?", 'warning');
    } finally {
      sendBtn.textContent = 'Send';
      syncSendButton();
    }
  });
}
