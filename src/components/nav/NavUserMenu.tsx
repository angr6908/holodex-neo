"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { mdiCheck, mdiClose, mdiContentCopy, mdiGoogle, mdiLogout, mdiPencil } from "@mdi/js";
import { LoginSvgIcon } from "@/components/nav/NavSvgIcons";
import { mdiDiscord } from "@/lib/icons";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { GoogleSignInButton } from "@/components/common/GoogleSignInButton";
import { CalendarUsage } from "@/components/calendar/CalendarUsage";
import { cn } from "@/lib/cn";
import { POPOVER_MOTION_CLASS, useAnimatedPresence } from "@/lib/useAnimatedPresence";
import { consumeOpenUserMenuRequest, OPEN_USER_MENU_EVENT } from "@/lib/navigation-events";

const DISCORD_CLIENT_ID = "793619250115379262";

export function NavUserMenu() {
  const router = useRouter();
  const { t } = useI18n();
  const app = useAppState();
  const user = app.userdata?.user;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuPresence = useAnimatedPresence(menuOpen, 180);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [showManualOAuth, setShowManualOAuth] = useState(false);
  const [manualOAuthUrl, setManualOAuthUrl] = useState("");
  const root = useRef<HTMLDivElement | null>(null);
  const allowedOAuthHost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname.endsWith("holodex.net"));
  const avatarUrl = `https://api.dicebear.com/7.x/shapes/svg?seed=${user?.id || "guest"}`;
  const userTag = user?.username ?? "";
  const userPts = `${user?.contribution_count || 0} pts`;
  const apiKey = user?.api_key || "";
  const initialQueryForCalendar = app.currentOrg.name !== "All Vtubers" ? [{ type: "org", text: app.currentOrg.name, value: app.currentOrg.name }] : false;

  useEffect(() => {
    if (consumeOpenUserMenuRequest()) setMenuOpen(true);
  }, []);

  useEffect(() => {
    function openMenu() { setMenuOpen(true); }
    window.addEventListener(OPEN_USER_MENU_EVENT, openMenu);
    return () => window.removeEventListener(OPEN_USER_MENU_EVENT, openMenu);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(event: MouseEvent) { if (!root.current?.contains(event.target as Node)) setMenuOpen(false); }
    function onKey(event: KeyboardEvent) { if (event.key === "Escape") setMenuOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

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

  return <div ref={root} className="relative">
    <button className={user ? "nav-user-trigger" : "nav-user-trigger nav-user-trigger--ghost"} aria-label={user ? userTag : "Login"} onClick={() => setMenuOpen((v) => !v)}>
      {user ? <img src={avatarUrl} alt="User avatar" className="nav-user-avatar" /> : <LoginSvgIcon className="menu-theme-icon h-5 w-5" aria-hidden="true" />}
    </button>
    {menuPresence.present ? <div data-state={menuPresence.state} data-side="bottom" className={cn("popover-content absolute right-0 top-[calc(100%+0.5rem)] z-[160] overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--surface-nav-solid)] p-0 shadow-2xl", POPOVER_MOTION_CLASS, menuPresence.state === "closed" && "pointer-events-none", user ? "max-h-[80vh] w-80 overflow-y-auto" : "w-72")} onAnimationEnd={menuPresence.onAnimationEnd}>
      {!user ? <div className="p-5 text-center"><h2 className="mb-5 text-base font-semibold tracking-tight text-[color:var(--color-foreground)]">Login</h2><div className="space-y-3" onClick={(e) => e.stopPropagation()}>
        {allowedOAuthHost ? <div className="nav-user-google-wrapper"><div className="nav-user-provider-btn nav-user-provider-google" aria-hidden="true"><GoogleLogo /><span>Sign in with Google</span></div><div className="nav-user-google-overlay"><GoogleSignInButton onCredentialResponse={loginGoogle} /></div></div> : <button className="nav-user-provider-btn nav-user-provider-google" disabled title="Google sign-in is only available on localhost or holodex.net" style={{ opacity: 0.4, cursor: "not-allowed" }}><GoogleLogo /><span>Sign in with Google</span></button>}
        <Button variant="outline" className="nav-user-provider-btn nav-user-provider-discord" onClick={loginDiscord}><span className="flex items-center gap-2"><Icon icon={mdiDiscord} size="sm" /><span>{t("views.login.with.1")}</span></span></Button>
        {showManualOAuth ? <ManualOAuth value={manualOAuthUrl} setValue={setManualOAuthUrl} submit={submitManualOAuth} cancel={() => { setShowManualOAuth(false); setManualOAuthUrl(""); }} /> : null}
      </div></div> : <>
        <div className="flex items-center gap-3 px-3 py-3"><img src={avatarUrl} alt="User avatar" className="h-10 w-10 shrink-0 rounded-full border border-[color:var(--color-border)]" /><div className="min-w-0 flex-1">{editingUsername ? <div className="flex items-center gap-1.5"><Input value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)} className="h-7 flex-1 text-xs" onKeyDown={(e) => { if (e.key === "Enter") saveUsername(); }} onClick={(e) => e.stopPropagation()} /><Button size="icon" className="h-6 w-6 shrink-0 rounded-md" onClick={saveUsername}><Icon icon={mdiCheck} size="xs" /></Button><Button variant="secondary" size="icon" className="h-6 w-6 shrink-0 rounded-md" onClick={cancelUsernameEdit}><Icon icon={mdiClose} size="xs" /></Button></div> : <><div className="flex items-center gap-1"><div className="truncate text-sm font-semibold text-[color:var(--color-foreground)]">{userTag}</div><button className="inline-flex h-5 w-5 items-center justify-center rounded opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); startUsernameEdit(); }}><Icon icon={mdiPencil} size="xs" /></button></div><div className="text-xs text-[color:var(--color-muted-foreground)]">{userPts}</div></>}</div><button className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center self-start rounded-lg text-red-400 opacity-70 transition-opacity hover:opacity-100" title={t("component.mainNav.logout")} onClick={handleLogout}><Icon icon={mdiLogout} size="sm" /></button></div>
        <Separator /><Label>Linked Accounts</Label><div className="grid grid-cols-2 gap-2 px-3 pb-2" onClick={(e) => e.stopPropagation()}><StatusChip icon={mdiGoogle} label="Google" ok={!!user.google_id} /><StatusChip icon={mdiDiscord} label="Discord" ok={!!user.discord_id} onLink={loginDiscord} /></div>
        {!user.google_id ? <div className="px-3 pb-2" onClick={(e) => e.stopPropagation()}>{allowedOAuthHost ? <div className="nav-user-google-wrapper nav-user-google-wrapper--sm"><div className="nav-user-provider-btn nav-user-provider-google nav-user-provider-btn--sm" aria-hidden="true"><GoogleLogo small /><span>Link Google</span></div><div className="nav-user-google-overlay"><GoogleSignInButton onCredentialResponse={loginGoogle} /></div></div> : <button className="nav-user-provider-btn nav-user-provider-google nav-user-provider-btn--sm" disabled title="Google link is only available on localhost or holodex.net" style={{ opacity: 0.4, cursor: "not-allowed" }}><GoogleLogo small /><span>Link Google</span></button>}</div> : null}
        {user.yt_channel_key ? <><Separator /><Label>{t("views.login.ownedYtChannel")}</Label><div className="px-3 pb-2"><Input value={user.yt_channel_key} disabled className="text-xs" /></div></> : null}
        <Separator /><Label>API Key</Label><div className="space-y-2 px-3 pb-2" onClick={(e) => e.stopPropagation()}><p className="text-[10px] leading-relaxed text-[color:var(--color-muted-foreground)]">{t("views.login.apikeyMsg")}</p>{apiKey ? <div className="flex items-center gap-2"><Input value={apiKey} disabled className="flex-1 font-mono text-[10px]" /><button type="button" className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--color-foreground)]" title={t("component.videoCard.copiedToClipboard")} onClick={copyApiKey}><Icon icon={mdiContentCopy} size="xs" /></button></div> : null}<Button variant="secondary" size="sm" className="h-7 text-xs" onClick={resetApiKey}>{t("views.login.apikeyNew")}</Button></div>
        <Separator /><div className="px-3 py-2" onClick={(e) => e.stopPropagation()}><label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[color:var(--color-foreground)]"><input checked={app.settings.useEnglishName} type="checkbox" className="h-3.5 w-3.5 rounded border-[color:var(--color-border)] bg-[color:var(--color-card)]" onChange={(e) => app.patchSettings({ useEnglishName: e.target.checked })} /><span>{t("views.settings.useEnglishNameLabel")}</span></label></div>
        <Separator /><Label>iCal Feed</Label><div className="px-3 pb-2" onClick={(e) => e.stopPropagation()}><CalendarUsage initialQuery={initialQueryForCalendar as any} /></div>
      </>}
    </div> : null}
  </div>;
}

function Separator() { return <div className="my-1 border-t border-[color:var(--color-border)]" />; }
function Label({ children }: { children: React.ReactNode }) { return <div className="px-3 py-1.5 text-xs font-medium text-[color:var(--color-muted-foreground)]">{children}</div>; }
function StatusChip({ icon, label, ok, onLink }: { icon: string; label: string; ok: boolean; onLink?: () => void }) { return <div className="nav-user-status-chip"><Icon icon={icon} size="sm" /><span>{label}</span>{ok ? <Badge variant="secondary" className="ml-auto border-[color:var(--color-bold)] bg-[color:var(--color-base)] text-[color:var(--color-foreground)]"><Icon icon={mdiCheck} size="xs" /></Badge> : onLink ? <Badge variant="secondary" className="ml-auto cursor-pointer border-[color:var(--color-bold)] bg-[color:var(--color-base)] text-[color:var(--color-muted-foreground)] text-[9px] tracking-normal px-2.5 py-0.5 font-extrabold hover:bg-[color:var(--color-bold)]" onClick={onLink as any}>LINK</Badge> : <span className="ml-auto text-[10px] text-[color:var(--color-muted-foreground)]">—</span>}</div>; }
function ManualOAuth({ value, setValue, submit, cancel }: { value: string; setValue: (value: string) => void; submit: () => void; cancel: () => void }) { return <div className="space-y-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-base)] p-3 text-left" onClick={(e) => e.stopPropagation()}><p className="text-xs text-[color:var(--color-muted-foreground)]">After authorizing, copy the full URL from your browser and paste it here:</p><Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Paste redirect URL here..." className="font-mono text-xs" onKeyDown={(e) => { if (e.key === "Enter") submit(); }} /><div className="flex gap-2"><Button size="sm" onClick={submit}>Login</Button><Button variant="secondary" size="sm" onClick={cancel}>Cancel</Button></div></div>; }
function GoogleLogo({ small = false }: { small?: boolean }) { return <svg viewBox="0 0 24 24" className={`${small ? "h-3.5 w-3.5" : "h-4 w-4"} shrink-0`}><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>; }
