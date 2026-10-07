// js/dialogs.js — tiny wiring for native <dialog> sheets.
//
//   <button data-dialog-open="feedback-modal">   opens #feedback-modal
//   <button data-dialog-close>                   closes the dialog it sits in
//
// Clicking the backdrop closes too. Escape is handled natively by <dialog>.

export function openDialog(id) {
  const el = document.getElementById(id);
  if (el && !el.open) el.showModal();
}

export function closeDialog(id) {
  const el = document.getElementById(id);
  if (el?.open) el.close();
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
      closer.closest('dialog')?.close();
      return;
    }
    // A click whose target is the <dialog> itself landed on the backdrop.
    if (e.target instanceof HTMLDialogElement && e.target.open) {
      const r = e.target.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) e.target.close();
    }
  });
}
