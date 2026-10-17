export const themes = ["sage", "spa", "night", "amber"];
export function browserTheme(storage) {
  try {
    const value = (storage ?? globalThis.localStorage)?.getItem("anipic-theme");
    return themes.includes(value) ? value : null;
  } catch {
    return null;
  }
}
export function rememberTheme(value, storage) {
  if (!themes.includes(value)) return false;
  try {
    (storage ?? globalThis.localStorage)?.setItem("anipic-theme", value);
    return true;
  } catch {
    return false;
  }
}
