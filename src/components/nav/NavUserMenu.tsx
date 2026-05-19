"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, XIcon, Copy, GoogleIcon, LogOut, Pencil, DiscordIcon, LogIn } from "@/lib/icons";
import { api } from "@/lib/api";
import { ALL_VTUBERS_ORG } from "@/lib/consts";
import { useAppState } from "@/lib/store";
import { useTranslations } from "next-intl";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { CalendarUsage } from "@/components/nav/CalendarUsage";
import { consumeOpenUserMenuRequest, OPEN_USER_MENU_EVENT } from "@/lib/browser";
const GOOGLE_CLIENT_ID = "275540829388-87s7f9v2ht3ih51ah0tjkqng8pd8bqo2.apps.googleusercontent.com";

type GoogleSignInButtonHandle = { triggerGoogleLogin: () => boolean };

const GoogleSignInButton = forwardRef<GoogleSignInButtonHandle, { onCredentialResponse: (value: any) => void }>(
  function GoogleSignInButton({ onCredentialResponse }, ref) {
    const divRef = useRef<HTMLDivElement | null>(null);
    const t = useTranslations();
    const [ready, setReady] = useState(false);
    const pendingTrigger = useRef(false);

    function triggerGoogleLogin() {
      const root = divRef.current;
      if (!root) { pendingTrigger.current = true; return false; }
      const button = root.querySelector("div[role=button]");
      if (button) { (button as HTMLElement).click(); return true; }
      if ((window as any).google?.accounts?.id?.prompt) { (window as any).google.accounts.id.prompt(); return true; }
      pendingTrigger.current = !ready;
      return false;
    }

    useEffect(() => {
      let cancelled = false;
      const url = "https://accounts.google.com/gsi/client";
      const loadScript = () => new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[src="${url}"]`)) return resolve();
        const s = document.createElement("script");
        s.src = url; s.onload = () => resolve(); s.onerror = reject;
        document.head.appendChild(s);
      });
      loadScript().then(() => {
        if (cancelled || !divRef.current || !(window as any).google?.accounts?.id) return;
        (window as any).google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (e: any) => onCredentialResponse(e) });
        (window as any).google.accounts.id.renderButton(divRef.current, { theme: "outline", size: "medium", text: t("views.login.with.0"), width: divRef.current.clientWidth, logo_alignment: "left" });
        setReady(true);
        if (pendingTrigger.current) { pendingTrigger.current = false; triggerGoogleLogin(); }
      }).catch(console.error);
      return () => { cancelled = true; };
    }, [onCredentialResponse, t]);

    useImperativeHandle(ref, () => ({ triggerGoogleLogin }), [ready]);

    return <div ref={divRef} className="mb-3 h-[30px] w-full max-w-[420px]" />;
  },
);

const DISCORD_CLIENT_ID = "793619250115379262";

export function NavUserMenu() {
  const router = useRouter();
  const t = useTranslations();
  const app = useAppState();
  const user = app.userdata?.user;
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [showManualOAuth, setShowManualOAuth] = useState(false);
  const [manualOAuthUrl, setManualOAuthUrl] = useState("");
  const allowedOAuthHost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname.endsWith("holodex.net"));
  const avatarUrl = `https://api.dicebear.com/7.x/shapes/svg?seed=${user?.id || "guest"}`;
  const userTag = user?.username ?? "";
  const userPts = `${user?.contribution_count || 0} pts`;
  const apiKey = user?.api_key || "";
  const initialQueryForCalendar = app.currentOrg.name !== ALL_VTUBERS_ORG ? [{ type: "org", text: app.currentOrg.name, value: app.currentOrg.name }] : false;

  useEffect(() => {
    if (consumeOpenUserMenuRequest()) setMenuOpen(true);
  }, []);

  useEffect(() => {
    function openMenu() { setMenuOpen(true); }
    window.addEventListener(OPEN_USER_MENU_EVENT, openMenu);
    return () => window.removeEventListener(OPEN_USER_MENU_EVENT, openMenu);
  }, []);

  function isAllowedOAuthHost() { const hostname = window.location.hostname; return hostname === "localhost" || hostname.endsWith("holodex.net"); }
  function resolveDiscordRedirectUri() {
    if (window.location.hostname === "localhost" && window.location.port !== "8080") return "http://localhost:8080/login?service=discord";
    if (!isAllowedOAuthHost()) return "http://localhost:8080/login?service=discord";
    return window.location.origin + "/login?service=discord";
  }
  function startUsernameEdit() { if (!user?.username) return; setUsernameInput(user.username); setEditingUsername(true); }
  function cancelUsernameEdit() { setEditingUsername(false); setUsernameInput(user?.username || ""); }
  async function resetApiKey() {
    if (!apiKey || confirm(t("views.login.apikeyResetConfirm1"))) {
      if (apiKey && !confirm(t("views.login.apikeyResetConfirm2"))) { alert(t("views.login.apikeyResetNvm")); return; }
      try { await api.resetAPIKey(app.userdata.jwt); await app.loginVerify(); } catch (e) { console.error("Failed to reset API key:", e); }
    }
  }
  async function copyApiKey() { if (apiKey) await navigator.clipboard.writeText(apiKey); }
  async function loginGoogle({ credential }: { credential: string }) {
    const resp = await api.login(app.userdata.jwt, credential, "google");
    app.setUser(resp.data);
    app.resetFavorites();
  }
  async function loginDiscord() {
    const redirectUri = resolveDiscordRedirectUri();
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=identify`;
    if (isAllowedOAuthHost()) window.location.assign(authUrl);
    else { window.open(authUrl, "_blank"); setShowManualOAuth(true); setManualOAuthUrl(""); }
  }
  async function submitManualOAuth() {
    const callbackUrl = manualOAuthUrl.trim();
    if (!callbackUrl) return;
    try {
      const url = new URL(callbackUrl);
      const params = new URLSearchParams(url.hash.substring(1));
      const accessToken = params.get("access_token");
      if (accessToken) { const resp = await api.login(app.userdata.jwt, accessToken, "discord"); app.setUser(resp.data); app.resetFavorites(); }
    } catch (e) { console.error("Login failed:", e); }
    setShowManualOAuth(false); setManualOAuthUrl("");
  }
  async function saveUsername() {
    if (!editingUsername) return;
    setEditingUsername(false);
    try { const res: any = await api.changeUsername(app.userdata.jwt, usernameInput); if (res?.status === 200) app.loginVerify(); } catch (e) { console.error(e); }
  }
  function handleLogout() { setMenuOpen(false); app.logout(); router.push("/"); }

  return <Popover open={menuOpen} onOpenChange={setMenuOpen}>
    <PopoverTrigger
      render={
        <Button variant="ghost" size="icon" className="cursor-pointer overflow-hidden p-0" aria-label={user ? userTag : "Login"} />
      }
    >
      {user ? <Avatar className="block size-full"><AvatarImage src={avatarUrl} alt={t("component.userMenu.userAvatar")} /></Avatar> : <LogIn className="h-5 w-5" aria-hidden="true" />}
    </PopoverTrigger>
    <PopoverContent align="end" sideOffset={8} className={user ? "max-h-[80dvh] w-[min(92vw,20rem)] overflow-y-auto p-0" : "w-[min(92vw,18rem)] p-0"}>
      {!user ? <div className="p-5 text-center"><h2 className="mb-5 text-base font-normal tracking-tight text-foreground">{t("component.mainNav.login")}</h2><div className="space-y-3" onClick={(e) => e.stopPropagation()}>
        {allowedOAuthHost ? <div className="relative h-11 overflow-hidden"><Button nativeButton={false} render={<div />} variant="outline" className="pointer-events-none w-full justify-center" aria-hidden="true"><GoogleIcon className="size-4" /><span>{t("views.login.with.0")}</span></Button><div className="absolute inset-0 cursor-pointer overflow-hidden opacity-[0.01] [&>*]:min-h-full [&>*]:min-w-full"><GoogleSignInButton onCredentialResponse={loginGoogle} /></div></div> : <Button variant="outline" className="w-full justify-center" disabled title={t("component.userMenu.googleSignInUnavailable")}><GoogleIcon className="size-4" /><span>{t("views.login.with.0")}</span></Button>}
        <Button variant="outline" className="w-full justify-center" onClick={loginDiscord}><span className="flex items-center gap-2"><DiscordIcon className="size-4" /><span>{t("views.login.with.1")}</span></span></Button>
        {showManualOAuth ? (
          <div className="space-y-2 text-left" onClick={(e) => e.stopPropagation()}>
            <p className="text-xs text-muted-foreground">{t("component.userMenu.manualOAuthInstructions")}</p>
            <Input value={manualOAuthUrl} onChange={(e) => setManualOAuthUrl(e.target.value)} placeholder={t("component.userMenu.pasteRedirectUrl")} className="font-mono text-xs" onKeyDown={(e) => { if (e.key === "Enter") submitManualOAuth(); }} />
            <div className="flex gap-2">
              <Button size="sm" onClick={submitManualOAuth}>{t("component.mainNav.login")}</Button>
              <Button variant="secondary" size="sm" onClick={() => { setShowManualOAuth(false); setManualOAuthUrl(""); }}>{t("views.library.deleteConfirmationCancel")}</Button>
            </div>
          </div>
        ) : null}
      </div></div> : <>
        <div className="flex items-center gap-3 px-3 py-3"><Avatar className="h-10 w-10 shrink-0"><AvatarImage src={avatarUrl} alt={t("component.userMenu.userAvatar")} /></Avatar><div className="min-w-0 flex-1">{editingUsername ? <div className="flex items-center gap-1.5"><Input value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} className="flex-1 text-xs" onKeyDown={(e) => { if (e.key === "Enter") saveUsername(); }} onClick={(e) => e.stopPropagation()} /><Button size="icon-xs" onClick={saveUsername}><Check className="size-3.5" /></Button><Button variant="secondary" size="icon-xs" onClick={cancelUsernameEdit}><XIcon className="size-3.5" /></Button></div> : <><div className="flex items-center gap-1"><div className="truncate text-sm font-normal text-foreground">{userTag}</div><Button variant="ghost" size="icon-xs" onClick={(e) => { e.stopPropagation(); startUsernameEdit(); }}><Pencil className="size-3.5" /></Button></div><div className="text-xs text-muted-foreground">{userPts}</div></>}</div><Button variant="ghost" size="icon-xs" className="ml-auto shrink-0 self-start" title={t("component.mainNav.logout")} onClick={handleLogout}><LogOut className="size-4" /></Button></div>
        <Separator className="my-1" /><Label className="px-3 py-1.5 text-xs font-medium text-muted-foreground">{t("component.userMenu.linkedAccounts")}</Label><div className="grid grid-cols-2 gap-2 px-3 pb-2" onClick={(e) => e.stopPropagation()}>
          <Badge variant="outline" className="flex w-full justify-start gap-1.5"><GoogleIcon className="size-4" /><span>Google</span>{user.google_id ? <Badge variant="secondary" className="ml-auto"><Check className="size-3.5" /></Badge> : <span className="ml-auto text-muted-foreground">-</span>}</Badge>
          <Badge variant="outline" className="flex w-full justify-start gap-1.5"><DiscordIcon className="size-4" /><span>Discord</span>{user.discord_id ? <Badge variant="secondary" className="ml-auto"><Check className="size-3.5" /></Badge> : <Button type="button" variant="secondary" size="xs" className="ml-auto" onClick={(event) => { event.stopPropagation(); loginDiscord(); }}>{t("component.userMenu.link")}</Button>}</Badge>
        </div>
        {!user.google_id ? <div className="px-3 pb-2" onClick={(e) => e.stopPropagation()}>{allowedOAuthHost ? <div className="relative h-8 overflow-hidden"><Button nativeButton={false} render={<div />} variant="outline" size="sm" className="pointer-events-none w-full justify-center" aria-hidden="true"><GoogleIcon className="size-3.5" /><span>{t("component.userMenu.linkGoogle")}</span></Button><div className="absolute inset-0 cursor-pointer overflow-hidden opacity-[0.01] [&>*]:min-h-full [&>*]:min-w-full"><GoogleSignInButton onCredentialResponse={loginGoogle} /></div></div> : <Button variant="outline" size="sm" className="w-full justify-center" disabled title={t("component.userMenu.googleLinkUnavailable")}><GoogleIcon className="size-3.5" /><span>{t("component.userMenu.linkGoogle")}</span></Button>}</div> : null}
        {user.yt_channel_key ? <><Separator className="my-1" /><Label className="px-3 py-1.5 text-xs font-medium text-muted-foreground">{t("views.login.ownedYtChannel")}</Label><div className="px-3 pb-2"><Input value={user.yt_channel_key} disabled className="text-xs" /></div></> : null}
        <Separator className="my-1" /><Label className="px-3 py-1.5 text-xs font-medium text-muted-foreground">{t("component.userMenu.apiKey")}</Label><div className="space-y-2 px-3 pb-2" onClick={(e) => e.stopPropagation()}><p className="text-xs leading-relaxed text-muted-foreground">{t("views.login.apikeyMsg")}</p>{apiKey ? <div className="flex items-center gap-2"><Input value={apiKey} disabled className="flex-1 font-mono text-xs" /><Button type="button" variant="ghost" size="icon-xs" className="shrink-0" title={t("component.videoCard.copiedToClipboard")} onClick={copyApiKey}><Copy className="size-3.5" /></Button></div> : null}<Button variant="secondary" size="sm" onClick={resetApiKey}>{t("views.login.apikeyNew")}</Button></div>
        <Separator className="my-1" /><div className="px-3 py-2" onClick={(e) => e.stopPropagation()}><Toggle pressed={app.settings.useEnglishName} variant="outline" size="sm" className="w-full justify-start text-xs" aria-label={t("views.settings.useEnglishNameLabel")} onPressedChange={(pressed) => app.patchSettings({ useEnglishName: pressed })}>{t("views.settings.useEnglishNameLabel")}</Toggle></div>
        <Separator className="my-1" /><Label className="px-3 py-1.5 text-xs font-medium text-muted-foreground">{t("component.userMenu.icalFeed")}</Label><div className="px-3 pb-2" onClick={(e) => e.stopPropagation()}><CalendarUsage initialQuery={initialQueryForCalendar as any} /></div>
      </>}
    </PopoverContent>
  </Popover>;
}
