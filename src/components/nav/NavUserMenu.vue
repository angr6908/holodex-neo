<template>
  <DropdownMenu v-model:open="menuOpen" :modal="false">
    <DropdownMenuTrigger as-child>
      <button
        :class="user ? 'nav-user-trigger' : 'nav-user-trigger nav-user-trigger--ghost'"
        :aria-label="user ? userTag : 'Login'"
      >
        <img v-if="user" :src="avatarUrl" alt="User avatar" class="nav-user-avatar">
        <svg v-else viewBox="0 0 24 24" class="menu-theme-icon h-5 w-5 fill-current">
          <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.418 0-8 2.239-8 5v1h16v-1c0-2.761-3.582-5-8-5z" />
        </svg>
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="end" :side-offset="8" :class-name="user ? 'w-80 max-h-[80vh] overflow-y-auto' : 'w-72'">
      <!-- Not logged in -->
      <template v-if="!user">
        <div class="p-5 text-center">
          <h2 class="mb-5 text-base font-semibold tracking-tight text-[color:var(--color-foreground)]">
            Login
          </h2>
          <div class="space-y-3" @click.stop>
            <!-- Google: GIS on allowed hosts, manual OAuth otherwise -->
            <template v-if="allowedOAuthHost">
              <div class="nav-user-google-wrapper">
                <div class="nav-user-provider-btn nav-user-provider-google" aria-hidden="true">
                  <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  <span>Sign in with Google</span>
                </div>
                <div class="nav-user-google-overlay">
                  <google-sign-in-button @onCredentialResponse="loginGoogle" />
                </div>
              </div>
            </template>
            <button
              v-else
              class="nav-user-provider-btn nav-user-provider-google"
              disabled
              title="Google sign-in is only available on localhost or holodex.net"
              style="opacity: 0.4; cursor: not-allowed;"
            >
              <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              <span>Sign in with Google</span>
            </button>

            <UiButton variant="outline" class-name="nav-user-provider-btn nav-user-provider-discord" @click="loginDiscord">
              <span class="flex items-center gap-2">
                <UiIcon :icon="mdiDiscord" size="sm" />
                <span>{{ $t("views.login.with.1") }}</span>
              </span>
            </UiButton>

            <div v-if="showManualOAuth" class="space-y-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-base)] p-3 text-left" @click.stop>
              <p class="text-xs text-[color:var(--color-muted-foreground)]">
                After authorizing, copy the full URL from your browser and paste it here:
              </p>
              <UiInput
                v-model="manualOAuthUrl"
                placeholder="Paste redirect URL here..."
                class-name="font-mono text-xs"
                @keydown.enter.prevent="submitManualOAuth"
              />
              <div class="flex gap-2">
                <UiButton size="sm" @click="submitManualOAuth">
                  Login
                </UiButton>
                <UiButton variant="secondary" size="sm" @click="showManualOAuth = false; manualOAuthUrl = ''">
                  Cancel
                </UiButton>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- Logged in -->
      <template v-else>
        <!-- Profile header with logout -->
        <div class="flex items-center gap-3 px-3 py-3">
          <img :src="avatarUrl" alt="User avatar" class="h-10 w-10 shrink-0 rounded-full border border-[color:var(--color-border)]">
          <div class="min-w-0 flex-1">
            <template v-if="editingUsername">
              <div class="flex items-center gap-1.5">
                <UiInput
                  v-model="usernameInput"
                  class-name="h-7 flex-1 text-xs"
                  @keydown.enter.prevent="saveUsername"
                  @click.stop
                />
                <UiButton size="icon" class-name="h-6 w-6 shrink-0 rounded-md" @click.stop="saveUsername">
                  <UiIcon :icon="mdiCheck" size="xs" />
                </UiButton>
                <UiButton variant="secondary" size="icon" class-name="h-6 w-6 shrink-0 rounded-md" @click.stop="cancelUsernameEdit">
                  <UiIcon :icon="mdiClose" size="xs" />
                </UiButton>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center gap-1">
                <div class="truncate text-sm font-semibold text-[color:var(--color-foreground)]">
                  {{ userTag }}
                </div>
                <button class="inline-flex h-5 w-5 items-center justify-center rounded opacity-60 hover:opacity-100" @click.stop="startUsernameEdit">
                  <UiIcon :icon="mdiPencil" size="xs" />
                </button>
              </div>
              <div class="text-xs text-[color:var(--color-muted-foreground)]">
                {{ userPts }}
              </div>
            </template>
          </div>
          <button
            class="ml-auto flex h-7 w-7 shrink-0 items-center justify-center self-start rounded-lg text-red-400 opacity-70 transition-opacity hover:opacity-100"
            :title="$t('component.mainNav.logout')"
            @click="handleLogout"
          >
            <UiIcon :icon="mdiLogout" size="sm" />
          </button>
        </div>

        <DropdownMenuSeparator />

        <!-- Linked accounts -->
        <DropdownMenuLabel>Linked Accounts</DropdownMenuLabel>
        <div class="grid grid-cols-2 gap-2 px-3 pb-2" @click.stop>
          <div class="nav-user-status-chip">
            <UiIcon :icon="mdiGoogle" size="sm" />
            <span>Google</span>
            <UiBadge
              v-if="user.google_id"
              variant="secondary"
              class-name="ml-auto border-[color:var(--color-bold)] bg-[color:var(--color-base)] text-[color:var(--color-foreground)]"
            >
              <UiIcon :icon="mdiCheck" size="xs" />
            </UiBadge>
            <span v-else class="ml-auto text-[10px] text-[color:var(--color-muted-foreground)]">—</span>
          </div>
          <div class="nav-user-status-chip">
            <UiIcon :icon="mdiDiscord" size="sm" />
            <span>Discord</span>
            <UiBadge
              v-if="user.discord_id"
              variant="secondary"
              class-name="ml-auto border-[color:var(--color-bold)] bg-[color:var(--color-base)] text-[color:var(--color-foreground)]"
            >
              <UiIcon :icon="mdiCheck" size="xs" />
            </UiBadge>
            <UiBadge
              v-else
              variant="secondary"
              class-name="ml-auto cursor-pointer border-[color:var(--color-bold)] bg-[color:var(--color-base)] text-[color:var(--color-muted-foreground)] text-[9px] tracking-normal px-2.5 py-0.5 font-extrabold hover:bg-[color:var(--color-bold)]"
              @click.stop="loginDiscord"
            >
              LINK
            </UiBadge>
          </div>
        </div>

        <!-- Google link button (if not linked) -->
        <div v-if="!user.google_id" class="px-3 pb-2" @click.stop>
          <template v-if="allowedOAuthHost">
            <div class="nav-user-google-wrapper nav-user-google-wrapper--sm">
              <div class="nav-user-provider-btn nav-user-provider-google nav-user-provider-btn--sm" aria-hidden="true">
                <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>Link Google</span>
              </div>
              <div class="nav-user-google-overlay">
                <google-sign-in-button @onCredentialResponse="loginGoogle" />
              </div>
            </div>
          </template>
          <button
            v-else
            class="nav-user-provider-btn nav-user-provider-google nav-user-provider-btn--sm"
            disabled
            title="Google link is only available on localhost or holodex.net"
            style="opacity: 0.4; cursor: not-allowed;"
          >
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 shrink-0">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            <span>Link Google</span>
          </button>
        </div>

        <!-- YouTube channel -->
        <template v-if="user.yt_channel_key">
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{{ $t("views.login.ownedYtChannel") }}</DropdownMenuLabel>
          <div class="px-3 pb-2">
            <UiInput :model-value="user.yt_channel_key" disabled class-name="text-xs" />
          </div>
        </template>

        <DropdownMenuSeparator />

        <!-- API Key -->
        <DropdownMenuLabel>API Key</DropdownMenuLabel>
        <div class="space-y-2 px-3 pb-2" @click.stop>
          <p class="text-[10px] leading-relaxed text-[color:var(--color-muted-foreground)]">
            {{ $t("views.login.apikeyMsg") }}
          </p>
          <div v-if="apiKey" class="flex items-center gap-2">
            <UiInput :model-value="apiKey" disabled class-name="flex-1 font-mono text-[10px]" />
            <button
              type="button"
              class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[color:var(--color-muted-foreground)] transition-colors hover:bg-[color:var(--surface-soft)] hover:text-[color:var(--color-foreground)]"
              :title="$t('component.videoCard.copiedToClipboard')"
              @click="copyApiKey"
            >
              <UiIcon :icon="mdiContentCopy" size="xs" />
            </button>
          </div>
          <UiButton variant="secondary" size="sm" class-name="h-7 text-xs" @click="resetApiKey">
            {{ $t("views.login.apikeyNew") }}
          </UiButton>
        </div>

        <DropdownMenuSeparator />

        <!-- Preferences -->
        <div class="px-3 py-2" @click.stop>
          <label class="inline-flex cursor-pointer items-center gap-2 text-xs text-[color:var(--color-foreground)]">
            <input
              v-model="preferEnglishName"
              type="checkbox"
              class="h-3.5 w-3.5 rounded border-[color:var(--color-border)] bg-[color:var(--color-card)]"
            >
            <span>{{ $t("views.settings.useEnglishNameLabel") }}</span>
          </label>
        </div>

        <DropdownMenuSeparator />

        <!-- iCal Feed -->
        <DropdownMenuLabel>iCal Feed</DropdownMenuLabel>
        <div class="px-3 pb-2" @click.stop>
          <CalendarUsage :initial-query="initialQueryForCalendar" />
        </div>

      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { ref, computed, getCurrentInstance } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { mdiCheck, mdiClose, mdiPencil, mdiGoogle, mdiContentCopy, mdiLogout } from "@mdi/js";
import { mdiDiscord } from "@/utils/icons";
import api from "@/utils/backend-api";
import { useAppStore } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";
import { useFavoritesStore } from "@/stores/favorites";
import GoogleSignInButton from "@/components/common/GoogleSignInButton.vue";
import CalendarUsage from "@/components/calendar/CalendarUsage.vue";
import DropdownMenu from "@/components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuTrigger from "@/components/ui/dropdown-menu/DropdownMenuTrigger.vue";
import DropdownMenuContent from "@/components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuSeparator from "@/components/ui/dropdown-menu/DropdownMenuSeparator.vue";
import DropdownMenuLabel from "@/components/ui/dropdown-menu/DropdownMenuLabel.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiInput from "@/components/ui/input/Input.vue";
import UiBadge from "@/components/ui/badge/Badge.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";

const DISCORD_CLIENT_ID = "793619250115379262";


const router = useRouter();
const { t } = useI18n();
const { proxy } = getCurrentInstance()!;
const appStore = useAppStore();
const settingsStore = useSettingsStore();
const favoritesStore = useFavoritesStore();

const menuOpen = ref(false);

// Template refs (no longer needed — Google button rendered directly)

// Reactive state
const editingUsername = ref(false);
const editUsernameInput = ref("");
const apiKey = computed(() => user.value?.api_key || "");
const initialQueryForCalendar = ref<false | object[]>(false);
const showManualOAuth = ref(false);
const manualOAuthUrl = ref("");
const allowedOAuthHost = computed(() => {
  const hostname = window.location.hostname;
  return hostname === "localhost" || hostname.endsWith("holodex.net");
});

// Computed
const user = computed(() => appStore.userdata?.user);

const avatarUrl = computed(() => {
  const seed = user.value?.id || "guest";
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${seed}`;
});

const userTag = computed(() => {
  if (!user.value) return "";
  return `${user.value.username}`;
});

const userPts = computed(() => {
  const points = user.value?.contribution_count || 0;
  return `${points} pts`;
});

const preferEnglishName = computed({
  get: () => settingsStore.useEnName,
  set: (val: boolean) => settingsStore.setUseEnName(val),
});

const usernameInput = computed({
  get: () =>
    editingUsername.value
      ? editUsernameInput.value
      : user.value?.username,
  set: (val: string) => {
    editUsernameInput.value = val;
  },
});

// Initialize calendar query
if (appStore.currentOrg.name !== "All Vtubers") {
  initialQueryForCalendar.value = [
    {
      type: "org",
      text: appStore.currentOrg.name,
      value: appStore.currentOrg.name,
    },
  ];
}

// Methods
function isAllowedOAuthHost(): boolean {
  const hostname = window.location.hostname;
  return hostname === "localhost" || hostname.endsWith("holodex.net");
}

function resolveDiscordRedirectUri() {
  const override = import.meta.env.VITE_DISCORD_REDIRECT_URI;
  if (override) return override;
  if (!isAllowedOAuthHost()) {
    return "http://localhost:8080/login?service=discord";
  }
  return window.location.origin + "/login?service=discord";
}

function startUsernameEdit() {
  if (!user.value?.username) return;
  editUsernameInput.value = user.value.username;
  editingUsername.value = true;
}

function cancelUsernameEdit() {
  editingUsername.value = false;
  editUsernameInput.value = user.value?.username || "";
}

async function resetApiKey() {
  if (!apiKey.value || confirm(t("views.login.apikeyResetConfirm1"))) {
    if (apiKey.value && !confirm(t("views.login.apikeyResetConfirm2"))) {
      alert(t("views.login.apikeyResetNvm"));
      return;
    }
    try {
      await api.resetAPIKey(appStore.userdata.jwt);
      await appStore.loginVerify();
    } catch (e) {
      console.error("Failed to reset API key:", e);
    }
  }
}

async function copyApiKey() {
  if (apiKey.value) {
    await navigator.clipboard.writeText(apiKey.value);
  }
}

async function loginGoogle({ credential }: { credential: string }) {
  const resp = await api.login(
    appStore.userdata.jwt,
    credential,
    "google",
  );
  appStore.setUser(resp.data);
  proxy?.$gtag?.event("login", {
    event_label: "google",
  });
  favoritesStore.resetFavorites();
}

async function loginDiscord() {
  const redirectUri = resolveDiscordRedirectUri();
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&response_type=token&scope=identify`;

  if (isAllowedOAuthHost()) {
    window.location.assign(authUrl);
  } else {
    window.open(authUrl, "_blank");
    showManualOAuth.value = true;
    manualOAuthUrl.value = "";
  }
}

async function submitManualOAuth() {
  const callbackUrl = manualOAuthUrl.value.trim();
  if (!callbackUrl) return;
  try {
    const url = new URL(callbackUrl);
    const hash = url.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    if (accessToken) {
      const resp = await api.login(appStore.userdata.jwt, accessToken, "discord");
      appStore.setUser(resp.data);
      proxy?.$gtag?.event("login", { event_label: "discord" });
      favoritesStore.resetFavorites();
    }
  } catch (e) {
    console.error("Login failed:", e);
  }
  showManualOAuth.value = false;
  manualOAuthUrl.value = "";
}

async function saveUsername() {
  if (!editingUsername.value) return;
  editingUsername.value = false;
  try {
    const res = await api.changeUsername(
      appStore.userdata.jwt,
      editUsernameInput.value,
    );
    if (res && res.status === 200) {
      appStore.loginVerify();
    }
  } catch (e) {
    console.error(e);
  }
}

function handleLogout() {
  menuOpen.value = false;
  appStore.logout();
  router.push("/");
}
</script>

<style>
.nav-user-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid var(--color-border);
  background: var(--color-card);
  transition: border-color 150ms ease, background-color 150ms ease;
  padding: 0;
}

.nav-user-trigger:hover {
  border-color: var(--color-foreground);
}

/* Ghost mode: looks like the other nav icon buttons */
.nav-user-trigger--ghost {
  border: none;
  border-radius: 0.5rem;
  background: transparent;
  width: 2.25rem;
  height: 2.25rem;
  color: var(--color-muted-foreground);
}

.nav-user-trigger--ghost:hover {
  background: var(--surface-soft);
  color: var(--color-foreground);
}

.nav-user-avatar {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.nav-user-avatar-placeholder {
  width: 1.25rem;
  height: 1.25rem;
  fill: var(--color-muted-foreground);
}

.nav-user-provider-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  height: 2.75rem;
  border-radius: 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease;
}

.nav-user-google-wrapper {
  position: relative;
  overflow: hidden;
  border-radius: 0.75rem;
  height: 2.75rem;
}

.nav-user-google-wrapper--sm {
  height: 2rem;
  border-radius: 0.5rem;
}

.nav-user-google-overlay {
  position: absolute;
  inset: 0;
  opacity: 0.01;
  cursor: pointer;
  overflow: hidden;
}

.nav-user-google-overlay > * {
  min-width: 100%;
  min-height: 100%;
}

.nav-user-google-wrapper .nav-user-provider-google {
  border: 1px solid var(--color-border);
  background: var(--color-card);
  color: var(--color-foreground);
  pointer-events: none;
}

.nav-user-provider-google {
  border: 1px solid var(--color-border);
  background: var(--color-card);
  color: var(--color-foreground);
}

.nav-user-provider-google:hover {
  border-color: #e91e8c;
  background: color-mix(in srgb, #e91e8c 18%, var(--color-card));
}

.nav-user-google-wrapper:hover .nav-user-provider-google {
  border-color: #e91e8c;
  background: color-mix(in srgb, #e91e8c 18%, var(--color-card));
}

.nav-user-provider-btn--sm {
  height: 2rem;
  font-size: 0.75rem;
  border-radius: 0.5rem;
}

.nav-user-provider-discord {
  border: 1px solid var(--color-border) !important;
  background: var(--color-card) !important;
  color: var(--color-foreground) !important;
}

.nav-user-provider-discord:hover {
  border-color: #5865F2 !important;
  background: color-mix(in srgb, #5865F2 18%, var(--color-card)) !important;
  color: var(--color-foreground) !important;
}

.nav-user-status-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 0.65rem;
  background: var(--color-card);
  padding: 0.35rem 0.5rem;
  font-size: 0.72rem;
  color: var(--color-muted-foreground);
}
</style>
