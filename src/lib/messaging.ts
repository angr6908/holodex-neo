import { companionExtensionId, MESSAGE_TYPES } from "@/lib/consts";
import { jwtDecode } from "jwt-decode";
declare const chrome: any;
export const sendTokenToExtension = (token: string | null): void => { try { if ((window as any).chrome && chrome.runtime?.sendMessage) chrome.runtime.sendMessage(companionExtensionId, { message: MESSAGE_TYPES.TOKEN, token }); } catch {} };
export const sendFavoritesToExtension = (favorites: any[]): void => { try { if ((window as any).chrome && chrome.runtime?.sendMessage) chrome.runtime.sendMessage(companionExtensionId, { message: MESSAGE_TYPES.FAVORITES, favorites }); } catch {} };
export const setCookieJWT = (jwt: string | null): void => {
  try {
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const domainAttr = isLocalhost ? "" : ";domain=.holodex.net";
    if (jwt) {
      const { exp } = jwtDecode<{ exp: number }>(jwt);
      document.cookie = `HOLODEX_JWT=${jwt};expires=${(new Date(exp * 1000)).toUTCString()}${domainAttr};path=/`;
    } else {
      document.cookie = `HOLODEX_JWT=;max-age=-1${domainAttr};path=/`;
    }
  } catch {
    // cookie clearing failed
  }
};
