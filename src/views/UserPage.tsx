"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mdiCheck, mdiClose, mdiContentCopy, mdiGoogle, mdiPencil } from "@mdi/js";
import { mdiDiscord } from "@/lib/icons";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { GoogleSignInButton, type GoogleSignInButtonHandle } from "@/components/common/GoogleSignInButton";
import { CalendarUsage } from "@/components/calendar/CalendarUsage";

const DISCORD_CLIENT_ID = "793619250115379262";
const GOOGLE_CLIENT_ID = "275540829388-87s7f9v2ht3ih51ah0tjkqng8pd8bqo2.apps.googleusercontent.com";

export function UserPage() {
  const app = useAppState();
  const { t } = useI18n();
  const userdata = app.userdata;
  const user = userdata?.user;
  const [editingUsername, setEditingUsername] = useState(false);
  const [editUsernameInput, setEditUsernameInput] = useState("");
  const [showManualOAuth, setShowManualOAuth] = useState(false);
  const [manualOAuthUrl, setManualOAuthUrl] = useState("");
  const googleSignInBtn = useRef<GoogleSignInButtonHandle | null>(null);
  const googleSignInProxy = useRef<GoogleSignInButtonHandle | null>(null);
  const allowedOAuthHost = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname.endsWith("holodex.net"));
  const apiKey = user?.api_key || "";
  const avatarUrl = `https://api.dicebear.com/7.x/shapes/svg?seed=${user?.id || "guest"}`;
  const userTag = user ? `${user.username}` : "";
  const userPts = `${user?.contribution_count || 0} pts`;
  const usernameInput = editingUsername ? editUsernameInput : (user?.username || "");
  const initialQueryForCalendar = useMemo(() => app.currentOrg.name !== "All Vtubers" ? [{ type: "org", text: app.currentOrg.name, value: app.currentOrg.name }] : false, []);

  useEffect(() => { document.title = "Account - Holodex"; }, []);
  useEffect(() => {
    const params = new URL(window.location.href).searchParams;
    const service = params.get("service");
    async function runDiscordCallback() {
      if (service !== "discord" || !window.location.hash) return;
      try {
        const hash = window.location.hash.substring(1);
        const discordAuthParams = new URLSearchParams(hash);
        const accessToken = discordAuthParams.get("access_token");
        const resp = await api.login(app.userdata.jwt, accessToken, "discord");
        app.setUser(resp.data);
        app.resetFavorites();
      } catch (e) {
        console.error("Discord login failed:", e);
      }
    }
    void runDiscordCallback();
    if (window.location.hash) {
      const hash = window.location.hash;
      setTimeout(() => { window.location.hash = hash; }, 1);
    }
  }, []);

  function isAllowedOAuthHost(): boolean {
    const hostname = window.location.hostname;
    return hostname === "localhost" || hostname.endsWith("holodex.net");
  }

  function resolveDiscordRedirectUri() {
    if (window.location.hostname === "localhost" && window.location.port !== "8080") return "http://localhost:8080/login?service=discord";
    if (!isAllowedOAuthHost()) return "http://localhost:8080/login?service=discord";
    return window.location.origin + "/login?service=discord";
  }

  function startUsernameEdit() {
    if (!user?.username) return;
    setEditUsernameInput(user.username);
    setEditingUsername(true);
  }

  function cancelUsernameEdit() {
    setEditingUsername(false);
    setEditUsernameInput(user?.username || "");
  }

  async function resetApiKey() {
    if (!apiKey || confirm(t("views.login.apikeyResetConfirm1"))) {
      if (apiKey && !confirm(t("views.login.apikeyResetConfirm2"))) {
        alert(t("views.login.apikeyResetNvm"));
        return;
      }
      try {
        await api.resetAPIKey(app.userdata.jwt);
        await app.loginVerify();
      } catch (e) {
        console.error("Failed to reset API key:", e);
      }
    }
  }

  async function copyApiKey() {
    if (apiKey) await navigator.clipboard.writeText(apiKey);
  }

  async function loginGoogle({ credential }: { credential: string }) {
    const resp = await api.login(app.userdata.jwt, credential, "google");
    app.setUser(resp.data);
    app.resetFavorites();
  }

  function triggerGoogleLink() {
    const proxyRef = googleSignInProxy.current;
    if (proxyRef?.triggerGoogleLogin) {
      proxyRef.triggerGoogleLogin();
      return;
    }
    setTimeout(() => {
      googleSignInProxy.current?.triggerGoogleLogin?.();
    }, 0);
  }

  function triggerGoogleLogin() {
    const btnRef = googleSignInBtn.current;
    if (btnRef?.triggerGoogleLogin?.()) return;
    if ((window as any).google?.accounts?.id) {
      (window as any).google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (e: any) => loginGoogle(e),
      });
      (window as any).google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          btnRef?.triggerGoogleLogin?.();
        }
      });
    }
  }

  async function loginDiscord() {
    const redirectUri = resolveDiscordRedirectUri();
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=identify`;
    if (isAllowedOAuthHost()) {
      window.location.assign(authUrl);
    } else {
      window.open(authUrl, "_blank");
      setShowManualOAuth(true);
      setManualOAuthUrl("");
    }
  }

  async function submitManualOAuth() {
    const callbackUrl = manualOAuthUrl.trim();
    if (!callbackUrl) return;
    try {
      const url = new URL(callbackUrl);
      const hash = url.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      if (accessToken) {
        const resp = await api.login(app.userdata.jwt, accessToken, "discord");
        app.setUser(resp.data);
        app.resetFavorites();
      }
    } catch (e) {
      console.error("Login failed:", e);
    }
    setShowManualOAuth(false);
    setManualOAuthUrl("");
  }

  async function saveUsername() {
    if (!editingUsername) return;
    setEditingUsername(false);
    try {
      const res: any = await api.changeUsername(userdata.jwt, editUsernameInput);
      if (res && res.status === 200) app.loginVerify();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <section className="user-page mx-auto max-w-6xl">
      {!user ? (
        <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">
          <div className="w-full max-w-sm">
            <Card className="overflow-hidden border-[color:var(--color-border)] bg-[color:var(--color-card)] p-0">
              <div className="px-6 py-7 text-center">
                <h1 className="mb-6 text-xl font-semibold tracking-tight text-[color:var(--color-foreground)]">Login</h1>
                <div className="space-y-3">
                  {allowedOAuthHost ? <><div className="login-google-proxy" aria-hidden="true"><GoogleSignInButton ref={googleSignInBtn} onCredentialResponse={loginGoogle} /></div><button className="login-provider-btn login-provider-google" onClick={triggerGoogleLogin}><GoogleLogo /><span>Sign in with Google</span></button></> : <button className="login-provider-btn login-provider-google" disabled title="Google sign-in is only available on localhost or holodex.net" style={{ opacity: 0.4, cursor: "not-allowed" }}><GoogleLogo /><span>Sign in with Google</span></button>}
                  <Button variant="outline" className="login-provider-btn login-provider-discord" onClick={loginDiscord}><span className="flex items-center gap-2"><Icon icon={mdiDiscord} size="sm" /><span>{t("views.login.with.1")}</span></span></Button>
                  {showManualOAuth ? <ManualOAuth value={manualOAuthUrl} setValue={setManualOAuthUrl} submit={submitManualOAuth} cancel={() => { setShowManualOAuth(false); setManualOAuthUrl(""); }} /> : null}
                </div>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <Card className="overflow-hidden border-[color:var(--color-border)] bg-[color:var(--color-card)] p-0">
          <div className="grid divide-y divide-[color:var(--color-border)] lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:divide-x lg:divide-y-0">
            <div className="divide-y divide-[color:var(--color-border)]">
              <div className="space-y-3 px-5 py-5 sm:px-6 sm:py-6">
                <div className="flex flex-wrap items-center gap-3">
                  <img src={avatarUrl} alt="User avatar" className="h-12 w-12 rounded-full border border-[color:var(--color-border)]" />
                  <div className="min-w-0 flex-1">
                    {editingUsername ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <Input value={usernameInput} className="h-9 w-full sm:max-w-sm" onChange={(e) => setEditUsernameInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void saveUsername(); } }} />
                        <div className="flex items-center gap-2">
                          <Button size="icon" className="h-8 w-8 rounded-md" onClick={saveUsername}><Icon icon={mdiCheck} size="xs" /><span className="sr-only">{t("views.login.usernameBtn.2")}</span></Button>
                          <Button variant="secondary" size="icon" className="h-8 w-8 rounded-md" onClick={cancelUsernameEdit}><Icon icon={mdiClose} size="xs" /><span className="sr-only">Cancel</span></Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <div className="truncate text-lg font-semibold text-[color:var(--color-foreground)]">{userTag}</div>
                          <Button variant="secondary" size="icon" className="h-7 w-7 rounded-md" onClick={startUsernameEdit}><Icon icon={mdiPencil} size="xs" /><span className="sr-only">{t("views.login.usernameBtn.0")}</span></Button>
                        </div>
                        <div className="text-sm text-[color:var(--color-muted-foreground)]">{userPts}</div>
                      </>
                    )}
                  </div>
                </div>
                <div className="grid max-w-md gap-2 sm:grid-cols-2">
                  <div className="login-status-chip"><Icon icon={mdiGoogle} size="sm" /><span>Google</span>{user.google_id ? <Badge variant="secondary" className="ml-auto border-[color:var(--color-bold)] bg-[color:var(--color-base)] text-[color:var(--color-foreground)]">Linked</Badge> : <Button variant="secondary" size="sm" className="ml-auto h-6 rounded-md px-2 text-[11px]" onClick={allowedOAuthHost ? triggerGoogleLink : undefined} disabled={!allowedOAuthHost} title={allowedOAuthHost ? "" : "Google link is only available on localhost or holodex.net"} style={allowedOAuthHost ? undefined : { opacity: 0.4, cursor: "not-allowed" }}>Unlinked</Button>}</div>
                  <div className="login-status-chip"><Icon icon={mdiDiscord} size="sm" /><span>Discord</span>{user.discord_id ? <Badge variant="secondary" className="ml-auto border-[color:var(--color-bold)] bg-[color:var(--color-base)] text-[color:var(--color-foreground)]">Linked</Badge> : <Button variant="secondary" size="sm" className="ml-auto h-6 rounded-md px-2 text-[11px]" onClick={loginDiscord}>Unlinked</Button>}</div>
                </div>
                {allowedOAuthHost && !user.google_id ? <div className="login-google-proxy" aria-hidden="true"><GoogleSignInButton ref={googleSignInProxy} onCredentialResponse={loginGoogle} /></div> : null}
              </div>

              <div className="space-y-3 px-5 py-5 sm:px-6 sm:py-6">
                {user.yt_channel_key ? <div className="space-y-2"><div className="text-sm font-semibold text-[color:var(--color-foreground)]">{t("views.login.ownedYtChannel")}</div><Input value={user.yt_channel_key || "None on file"} disabled /><p className="text-xs text-[color:var(--color-muted-foreground)]">{t("views.login.futureYtcOwnerMessage")}</p></div> : null}
                {user.yt_channel_key ? <div className="border-t border-[color:var(--color-border)]" /> : null}
              </div>

              <div className="space-y-3 px-5 py-5 sm:px-6 sm:py-6">
                <div className="text-sm font-semibold text-[color:var(--color-foreground)]">API Key</div>
                <p className="text-xs text-[color:var(--color-muted-foreground)]">{t("views.login.apikeyMsg")}</p>
                {apiKey ? <div className="flex items-center gap-2"><Input value={apiKey} disabled className="flex-1 font-mono text-xs" /><Button variant="secondary" size="icon" className="h-9 w-9 shrink-0" title={t("component.videoCard.copiedToClipboard")} onClick={copyApiKey}><Icon icon={mdiContentCopy} size="xs" /></Button></div> : null}
                <Button variant="secondary" size="sm" onClick={resetApiKey}>{t("views.login.apikeyNew")}</Button>
              </div>
            </div>

            <div id="calendar" className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
              <label className="inline-flex items-center gap-3 text-sm text-[color:var(--color-foreground)]">
                <input checked={app.settings.useEnglishName} type="checkbox" className="h-4 w-4 rounded border-[color:var(--color-border)] bg-[color:var(--color-card)]" onChange={(e) => app.patchSettings({ useEnglishName: e.target.checked })} />
                <span>{t("views.settings.useEnglishNameLabel")}</span>
              </label>
              <div className="space-y-3"><div className="text-lg font-semibold text-[color:var(--color-foreground)]">iCal Feed</div><CalendarUsage initialQuery={initialQueryForCalendar as any} /></div>
            </div>
          </div>
        </Card>
      )}
    </section>
  );
}

function ManualOAuth({ value, setValue, submit, cancel }: { value: string; setValue: (value: string) => void; submit: () => void; cancel: () => void }) {
  return <div className="space-y-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-base)] p-3 text-left"><p className="text-xs text-[color:var(--color-muted-foreground)]">After authorizing, copy the full URL from your browser and paste it here:</p><Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Paste redirect URL here..." className="font-mono text-xs" onKeyDown={(e) => { if (e.key === "Enter") submit(); }} /><div className="flex gap-2"><Button size="sm" onClick={submit}>Login</Button><Button variant="secondary" size="sm" onClick={cancel}>Cancel</Button></div></div>;
}

function GoogleLogo() {
  return <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>;
}
