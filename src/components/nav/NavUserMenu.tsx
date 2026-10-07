"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { CalendarUsage } from "@/components/nav/CalendarUsage";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { api } from "@/lib/api";
import { consumeOpenUserMenuRequest, OPEN_USER_MENU_EVENT } from "@/lib/browser";
import { ALL_VTUBERS_ORG } from "@/lib/consts";
import { useHostname } from "@/lib/hooks";
import { Check, Copy, DiscordIcon, GoogleIcon, LogIn, LogOut, Pencil, XIcon } from "@/lib/icons";
import { useAppState } from "@/lib/store";

const GOOGLE_CLIENT_ID = "275540829388-87s7f9v2ht3ih51ah0tjkqng8pd8bqo2.apps.googleusercontent.com";

type GoogleSignInButtonHandle = { triggerGoogleLogin: () => boolean };

const GoogleSignInButton = forwardRef<
  GoogleSignInButtonHandle,
  { onCredentialResponse: (value: any) => void }
>(function GoogleSignInButton({ onCredentialResponse }, ref) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const t = useTranslations();
  // Whether Google's button has rendered; a trigger before then is replayed once it has.
  const ready = useRef(false);
  const pendingTrigger = useRef(false);

  const triggerGoogleLogin = useCallback(() => {
    const root = divRef.current;
    if (!root) {
      pendingTrigger.current = true;
      return false;
    }
    const button = root.querySelector("div[role=button]");
    if (button) {
      (button as HTMLElement).click();
      return true;
    }
    if ((window as any).google?.accounts?.id?.prompt) {
      (window as any).google.accounts.id.prompt();
      return true;
    }
    pendingTrigger.current = !ready.current;
    return false;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const url = "https://accounts.google.com/gsi/client";
    const loadScript = () =>
      new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[src="${url}"]`)) return resolve();
        const s = document.createElement("script");
        s.src = url;
        s.onload = () => resolve();
        s.onerror = reject;
        document.head.appendChild(s);
      });
    loadScript()
      .then(() => {
        if (cancelled || !divRef.current || !(window as any).google?.accounts?.id) return;
        (window as any).google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (e: any) => onCredentialResponse(e),
        });
        (window as any).google.accounts.id.renderButton(divRef.current, {
          theme: "outline",
          size: "medium",
          text: t("views.login.with.0"),
          width: divRef.current.clientWidth,
          logo_alignment: "left",
        });
        ready.current = true;
        if (pendingTrigger.current) {
          pendingTrigger.current = false;
          triggerGoogleLogin();
        }
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [onCredentialResponse, t, triggerGoogleLogin]);

  useImperativeHandle(ref, () => ({ triggerGoogleLogin }), [triggerGoogleLogin]);

  return <div ref={divRef} className="mb-3 h-[30px] w-full max-w-[420px]" />;
});

const DISCORD_CLIENT_ID = "793619250115379262";

// Google's rendered button sits invisibly over a styled stand-in; off holodex.net (where the
// client ID is not authorised) a disabled stand-in explains why.
function GoogleLoginSlot({
  allowed,
  compact,
  label,
  unavailableTitle,
  onCredentialResponse,
}: {
  allowed: boolean;
  compact: boolean;
  label: string;
  unavailableTitle: string;
  onCredentialResponse: (value: any) => void;
}) {
  const icon = <GoogleIcon className={compact ? "size-3.5" : "size-4"} />;
  if (!allowed)
    return (
      <Button
        variant="outline"
        size={compact ? "sm" : undefined}
        className="w-full justify-center"
        disabled
        title={unavailableTitle}
      >
        {icon}
        <span>{label}</span>
      </Button>
    );
  return (
    <div className={compact ? "relative h-8 overflow-hidden" : "relative h-11 overflow-hidden"}>
      <Button
        nativeButton={false}
        render={<div />}
        variant="outline"
        size={compact ? "sm" : undefined}
        className="pointer-events-none w-full justify-center"
        aria-hidden="true"
      >
        {icon}
        <span>{label}</span>
      </Button>
      <div className="absolute inset-0 cursor-pointer overflow-hidden opacity-1 [&>*]:min-h-full [&>*]:min-w-full">
        <GoogleSignInButton onCredentialResponse={onCredentialResponse} />
      </div>
    </div>
  );
}

// Off holodex.net the Discord redirect can't come back here, so the user pastes it instead.
function ManualOAuthForm({
  url,
  onUrlChange,
  onSubmit,
  onCancel,
}: {
  url: string;
  onUrlChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="space-y-2 text-left" onClick={(e) => e.stopPropagation()}>
      <p className="text-xs text-muted-foreground">
        {t("component.userMenu.manualOAuthInstructions")}
      </p>
      <Input
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        placeholder={t("component.userMenu.pasteRedirectUrl")}
        className="font-mono text-xs"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) onSubmit();
        }}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={onSubmit}>
          {t("component.mainNav.login")}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          {t("views.library.deleteConfirmationCancel")}
        </Button>
      </div>
    </div>
  );
}

function LoginPanel({
  allowedOAuthHost,
  onGoogle,
  onDiscord,
  manualOAuth,
}: {
  allowedOAuthHost: boolean;
  onGoogle: (value: any) => void;
  onDiscord: () => void;
  manualOAuth: React.ComponentProps<typeof ManualOAuthForm> | null;
}) {
  const t = useTranslations();
  return (
    <div className="p-5 text-center">
      <h2 className="mb-5 text-base font-normal tracking-tight text-foreground">
        {t("component.mainNav.login")}
      </h2>
      <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
        <GoogleLoginSlot
          allowed={allowedOAuthHost}
          compact={false}
          label={t("views.login.with.0")}
          unavailableTitle={t("component.userMenu.googleSignInUnavailable")}
          onCredentialResponse={onGoogle}
        />
        <Button variant="outline" className="w-full justify-center" onClick={onDiscord}>
          <span className="flex items-center gap-2">
            <DiscordIcon className="size-4" />
            <span>{t("views.login.with.1")}</span>
          </span>
        </Button>
        {manualOAuth ? <ManualOAuthForm {...manualOAuth} /> : null}
      </div>
    </div>
  );
}

// Avatar, username (editable in place), points and the logout button.
function UserProfileRow({
  avatarUrl,
  userTag,
  userPts,
  editing,
  usernameInput,
  onUsernameInput,
  onStartEdit,
  onSave,
  onCancel,
  onLogout,
}: {
  avatarUrl: string;
  userTag: string;
  userPts: string;
  editing: boolean;
  usernameInput: string;
  onUsernameInput: (value: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onLogout: () => void;
}) {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={avatarUrl} alt={t("component.userMenu.userAvatar")} />
      </Avatar>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <Input
              value={usernameInput}
              onChange={(e) => onUsernameInput(e.target.value)}
              className="flex-1 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) onSave();
              }}
              onClick={(e) => e.stopPropagation()}
            />
            <Button size="icon-xs" aria-label={t("component.common.save")} onClick={onSave}>
              <Check className="size-3.5" />
            </Button>
            <Button
              variant="secondary"
              size="icon-xs"
              aria-label={t("views.library.deleteConfirmationCancel")}
              onClick={onCancel}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <div className="truncate text-sm font-normal text-foreground">{userTag}</div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartEdit();
                }}
              >
                <Pencil className="size-3.5" />
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">{userPts}</div>
          </>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon-xs"
        className="ml-auto shrink-0 self-start"
        title={t("component.mainNav.logout")}
        onClick={onLogout}
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}

function LinkedCheck() {
  return (
    <Badge variant="secondary" className="ml-auto">
      <Check className="size-3.5" />
    </Badge>
  );
}

// Which login services the account has, with links for the missing ones.
function LinkedAccounts({
  user,
  allowedOAuthHost,
  onGoogle,
  onDiscord,
}: {
  user: any;
  allowedOAuthHost: boolean;
  onGoogle: (value: any) => void;
  onDiscord: () => void;
}) {
  const t = useTranslations();
  return (
    <>
      <Label className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
        {t("component.userMenu.linkedAccounts")}
      </Label>
      <div className="grid grid-cols-2 gap-2 px-3 pb-2" onClick={(e) => e.stopPropagation()}>
        <Badge variant="outline" className="flex w-full justify-start gap-1.5">
          <GoogleIcon className="size-4" />
          <span>Google</span>
          {user.google_id ? (
            <LinkedCheck />
          ) : (
            <span className="ml-auto text-muted-foreground">-</span>
          )}
        </Badge>
        <Badge variant="outline" className="flex w-full justify-start gap-1.5">
          <DiscordIcon className="size-4" />
          <span>Discord</span>
          {user.discord_id ? (
            <LinkedCheck />
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="xs"
              className="ml-auto"
              onClick={(event) => {
                event.stopPropagation();
                onDiscord();
              }}
            >
              {t("component.userMenu.link")}
            </Button>
          )}
        </Badge>
      </div>
      {!user.google_id ? (
        <div className="px-3 pb-2" onClick={(e) => e.stopPropagation()}>
          <GoogleLoginSlot
            allowed={allowedOAuthHost}
            compact
            label={t("component.userMenu.linkGoogle")}
            unavailableTitle={t("component.userMenu.googleLinkUnavailable")}
            onCredentialResponse={onGoogle}
          />
        </div>
      ) : null}
    </>
  );
}

function ApiKeySection({
  apiKey,
  onCopy,
  onReset,
}: {
  apiKey: string;
  onCopy: () => void;
  onReset: () => void;
}) {
  const t = useTranslations();
  return (
    <>
      <Label className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
        {t("component.userMenu.apiKey")}
      </Label>
      <div className="space-y-2 px-3 pb-2" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("views.login.apikeyMsg")}
        </p>
        {apiKey ? (
          <div className="flex items-center gap-2">
            <Input value={apiKey} disabled className="flex-1 font-mono text-xs" />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="shrink-0"
              title={t("component.videoCard.copiedToClipboard")}
              onClick={onCopy}
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
        ) : null}
        <Button variant="secondary" size="sm" onClick={onReset}>
          {t("views.login.apikeyNew")}
        </Button>
      </div>
    </>
  );
}

function AccountPanel({
  user,
  profile,
  linked,
  apiKey,
  calendarQuery,
}: {
  user: any;
  profile: React.ComponentProps<typeof UserProfileRow>;
  linked: Omit<React.ComponentProps<typeof LinkedAccounts>, "user">;
  apiKey: React.ComponentProps<typeof ApiKeySection>;
  calendarQuery: any;
}) {
  const t = useTranslations();
  const app = useAppState();
  return (
    <>
      <UserProfileRow {...profile} />
      <Separator className="my-1" />
      <LinkedAccounts user={user} {...linked} />
      {user.yt_channel_key ? (
        <>
          <Separator className="my-1" />
          <Label className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
            {t("views.login.ownedYtChannel")}
          </Label>
          <div className="px-3 pb-2">
            <Input value={user.yt_channel_key} disabled className="text-xs" />
          </div>
        </>
      ) : null}
      <Separator className="my-1" />
      <ApiKeySection {...apiKey} />
      <Separator className="my-1" />
      <div className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <Toggle
          pressed={app.settings.useEnglishName}
          variant="outline"
          size="sm"
          className="w-full justify-start text-xs"
          aria-label={t("views.settings.useEnglishNameLabel")}
          onPressedChange={(pressed) => app.patchSettings({ useEnglishName: pressed })}
        >
          {t("views.settings.useEnglishNameLabel")}
        </Toggle>
      </div>
      <Separator className="my-1" />
      <Label className="px-3 py-1.5 text-xs font-medium text-muted-foreground">
        {t("component.userMenu.icalFeed")}
      </Label>
      <div className="px-3 pb-2" onClick={(e) => e.stopPropagation()}>
        <CalendarUsage initialQuery={calendarQuery} />
      </div>
    </>
  );
}

function isAllowedOAuthHost() {
  const hostname = window.location.hostname;
  return hostname === "localhost" || hostname.endsWith("holodex.net");
}

function resolveDiscordRedirectUri() {
  if (window.location.hostname === "localhost" && window.location.port !== "8080")
    return "http://localhost:8080/login?service=discord";
  if (!isAllowedOAuthHost()) return "http://localhost:8080/login?service=discord";
  return `${window.location.origin}/login?service=discord`;
}

// The iCal feed starts from the selected org (none for "All Vtubers").
function calendarQueryFor(orgName: string) {
  return orgName !== ALL_VTUBERS_ORG ? [{ type: "org", text: orgName, value: orgName }] : false;
}

// Login/account menu for the nav. Its state lives here, outside the popup, so an in-progress
// username edit or manual Discord login survives closing and reopening the menu.
export function useNavUserMenu() {
  const router = useRouter();
  const t = useTranslations();
  const app = useAppState();
  const user = app.userdata?.user;
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [showManualOAuth, setShowManualOAuth] = useState(false);
  const [manualOAuthUrl, setManualOAuthUrl] = useState("");
  const hostname = useHostname();
  const allowedOAuthHost = hostname === "localhost" || hostname.endsWith("holodex.net");
  const avatarUrl = `https://api.dicebear.com/7.x/shapes/svg?seed=${user?.id || "guest"}`;
  const apiKey = user?.api_key || "";

  useEffect(() => {
    if (consumeOpenUserMenuRequest()) setMenuOpen(true);
  }, []);

  useEffect(() => {
    function openMenu() {
      setMenuOpen(true);
    }
    window.addEventListener(OPEN_USER_MENU_EVENT, openMenu);
    return () => window.removeEventListener(OPEN_USER_MENU_EVENT, openMenu);
  }, []);

  function startUsernameEdit() {
    if (!user?.username) return;
    setUsernameInput(user.username);
    setEditingUsername(true);
  }
  function cancelUsernameEdit() {
    setEditingUsername(false);
    setUsernameInput(user?.username || "");
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
  async function loginDiscord() {
    const redirectUri = resolveDiscordRedirectUri();
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=identify`;
    if (isAllowedOAuthHost()) window.location.assign(authUrl);
    else {
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
      const params = new URLSearchParams(url.hash.substring(1));
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
      const res: any = await api.changeUsername(app.userdata.jwt, usernameInput);
      if (res?.status === 200) app.loginVerify();
    } catch (e) {
      console.error(e);
    }
  }
  function handleLogout() {
    setMenuOpen(false);
    app.logout();
    router.push("/");
  }

  const userTag = user?.username ?? "";
  const triggerContent = user ? (
    <Avatar className="block size-full">
      <AvatarImage src={avatarUrl} alt={t("component.userMenu.userAvatar")} />
    </Avatar>
  ) : (
    <LogIn className="size-4" aria-hidden="true" />
  );
  const content = (
    <PopoverContent
      align="end"
      sideOffset={8}
      className={
        user ? "max-h-[80dvh] w-[min(92vw,20rem)] overflow-y-auto p-0" : "w-[min(92vw,18rem)] p-0"
      }
    >
      {!user ? (
        <LoginPanel
          allowedOAuthHost={allowedOAuthHost}
          onGoogle={loginGoogle}
          onDiscord={loginDiscord}
          manualOAuth={
            showManualOAuth
              ? {
                  url: manualOAuthUrl,
                  onUrlChange: setManualOAuthUrl,
                  onSubmit: submitManualOAuth,
                  onCancel: () => {
                    setShowManualOAuth(false);
                    setManualOAuthUrl("");
                  },
                }
              : null
          }
        />
      ) : (
        <AccountPanel
          user={user}
          profile={{
            avatarUrl,
            userTag,
            userPts: `${user.contribution_count || 0} pts`,
            editing: editingUsername,
            usernameInput,
            onUsernameInput: setUsernameInput,
            onStartEdit: startUsernameEdit,
            onSave: saveUsername,
            onCancel: cancelUsernameEdit,
            onLogout: handleLogout,
          }}
          linked={{ allowedOAuthHost, onGoogle: loginGoogle, onDiscord: loginDiscord }}
          apiKey={{ apiKey, onCopy: copyApiKey, onReset: resetApiKey }}
          calendarQuery={calendarQueryFor(app.currentOrg.name)}
        />
      )}
    </PopoverContent>
  );

  return { menuOpen, setMenuOpen, triggerLabel: user ? userTag : "Login", triggerContent, content };
}

export function NavUserMenu() {
  const menu = useNavUserMenu();

  return (
    <Popover open={menu.menuOpen} onOpenChange={menu.setMenuOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon-lg"
            className="cursor-pointer overflow-hidden p-0"
            selected={menu.menuOpen}
            aria-label={menu.triggerLabel}
          />
        }
      >
        {menu.triggerContent}
      </PopoverTrigger>
      {menu.content}
    </Popover>
  );
}
