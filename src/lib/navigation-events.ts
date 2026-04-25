export const OPEN_USER_MENU_EVENT = "holodex-open-user-menu";
const OPEN_USER_MENU_STORAGE_KEY = "holodex-open-user-menu";

export function openUserMenu() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(OPEN_USER_MENU_STORAGE_KEY, "1");
  } catch {}
  window.dispatchEvent(new CustomEvent(OPEN_USER_MENU_EVENT));
}

export function consumeOpenUserMenuRequest() {
  if (typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(OPEN_USER_MENU_STORAGE_KEY) !== "1") return false;
    sessionStorage.removeItem(OPEN_USER_MENU_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
