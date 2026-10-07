// js/dialogs.js — tiny wiring for native <dialog> sheets.
//
//   <button data-dialog-open="feedback-modal">   opens #feedback-modal
//   <button data-dialog-close>                   closes the dialog it sits in
//
// Clicking the backdrop closes too. Escape is handled natively by <dialog>.

export function openDialog(id) {
  const el = document.getElementById(id);
  if (!el || el.hasAttribute('open')) return;
  // Safari before 15.4 has no showModal(); the open attribute still shows it.
  if (typeof el.showModal === 'function') el.showModal();
  else el.setAttribute('open', '');
}

export function closeDialog(id) {
  const el = document.getElementById(id);
  if (!el?.hasAttribute('open')) return;
  if (typeof el.close === 'function') el.close();
  else el.removeAttribute('open');
}

export function initDialogs(root = document) {
  root.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-dialog-open]');
    if (opener) {
      openDialog(opener.dataset.dialogOpen);
      return;
    }
    const closer = e.target.closest('[data-dialog-close]');
    if (closer) {
      const dlg = closer.closest('dialog');
      if (dlg) closeDialog(dlg.id);
      return;
    }
    // A click whose target is the <dialog> itself landed on the backdrop.
    if (e.target.tagName === 'DIALOG' && e.target.hasAttribute('open')) {
      const r = e.target.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) closeDialog(e.target.id);
    }
  });
}
