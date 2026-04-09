import { companionExtensionId, MESSAGE_TYPES } from "@/utils/consts";
import { jwtDecode } from "jwt-decode";

export const sendTokenToExtension = (token: string | null): void => {
    if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(companionExtensionId, { message: MESSAGE_TYPES.TOKEN, token });
    }
};

export const sendFavoritesToExtension = (favorites: any[]): void => {
    if (window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(companionExtensionId, { message: MESSAGE_TYPES.FAVORITES, favorites });
    }
};

export const setCookieJWT = (jwt: string) => {
    try {
        const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
        const domainAttr = isLocalhost ? "" : ";domain=.holodex.net";
        if (jwt) {
            const { exp } = jwtDecode(jwt) as any;
            document.cookie = `HOLODEX_JWT=${jwt};expires=${(new Date(exp * 1000)).toUTCString()}${domainAttr};path=/`;
        } else {
            document.cookie = `HOLODEX_JWT=;max-age=-1${domainAttr};path=/`;
        }
    } catch {
        // cookie clearing failed
    }
};
