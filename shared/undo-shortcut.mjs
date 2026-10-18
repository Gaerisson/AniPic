export function isUndoShortcut(event) {
  if (
    event.defaultPrevented ||
    event.repeat ||
    !(event.ctrlKey || event.metaKey) ||
    event.shiftKey ||
    event.altKey ||
    event.key?.toLowerCase() !== "z"
  )
    return false;
  const field = event.target?.closest?.(
    "input,textarea,select,[contenteditable]",
  );
  if (!field) return true;
  if (field.isContentEditable || field.tagName === "TEXTAREA") return false;
  // Checkboxes (including the photo selection), buttons and selects have no
  // text undo stack. Their focus must not swallow the application shortcut.
  return (
    field.tagName !== "INPUT" ||
    ["checkbox", "radio", "button", "submit", "reset", "file"].includes(
      field.type,
    )
  );
}
