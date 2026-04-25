"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

const googleUrl = "https://accounts.google.com/gsi/client";
const GOOGLE_CLIENT_ID = "275540829388-87s7f9v2ht3ih51ah0tjkqng8pd8bqo2.apps.googleusercontent.com";

function loadScript(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = url;
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export type GoogleSignInButtonHandle = {
  triggerGoogleLogin: () => boolean;
};

export const GoogleSignInButton = forwardRef<GoogleSignInButtonHandle, { onCredentialResponse: (value: any) => void }>(
  function GoogleSignInButton({ onCredentialResponse }, ref) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const pendingTrigger = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function initGoogleButton() {
      try {
        await loadScript(googleUrl);
        if (cancelled || !divRef.current || !(window as any).google?.accounts?.id) return;
        (window as any).google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (e: any) => onCredentialResponse(e) });
        (window as any).google.accounts.id.renderButton(divRef.current, { theme: "outline", size: "medium", text: t("views.login.with.0"), width: divRef.current.clientWidth, logo_alignment: "left" });
        setReady(true);
        if (pendingTrigger.current) {
          pendingTrigger.current = false;
          triggerGoogleLogin();
        }
      } catch (e) { console.error(e); }
    }
    initGoogleButton();
    return () => { cancelled = true; };
  }, [onCredentialResponse, t]);

  function triggerGoogleLogin() {
    const root = divRef.current;
    if (!root) { pendingTrigger.current = true; return false; }
    const button = root.querySelector("div[role=button]");
    if (button) { (button as HTMLElement).click(); return true; }
    if ((window as any).google?.accounts?.id?.prompt) { (window as any).google.accounts.id.prompt(); return true; }
    pendingTrigger.current = !ready;
    return false;
  }

  useImperativeHandle(ref, () => ({ triggerGoogleLogin }), [ready]);

  return <div ref={divRef} className="mb-3" style={{ height: 30, maxWidth: 420, width: "100%" }} />;
});
