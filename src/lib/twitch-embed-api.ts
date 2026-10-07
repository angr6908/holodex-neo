"use client";

const TWITCH_EMBED_SRC = "https://player.twitch.tv/js/embed/v1.js";

let twitchScriptPromise: Promise<void> | null = null;

// Loads the Twitch embed script (window.Twitch.Player) once.
export function loadTwitchEmbedApi(): Promise<void> {
  if (twitchScriptPromise) return twitchScriptPromise;
  twitchScriptPromise = new Promise((resolve, reject) => {
    if ((window as any).Twitch?.Player) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${TWITCH_EMBED_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = TWITCH_EMBED_SRC;
    s.onload = () => resolve();
    s.onerror = (e) => {
      twitchScriptPromise = null;
      reject(e);
    };
    document.head.appendChild(s);
  });
  return twitchScriptPromise;
}
