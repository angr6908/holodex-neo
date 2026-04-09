<template>
  <section class="user-page mx-auto max-w-6xl">
    <!-- Not logged in: minimal centered card -->
    <div v-if="!userdata.user" class="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div class="w-full max-w-sm">
        <UiCard class-name="overflow-hidden border-[color:var(--color-border)] bg-[color:var(--color-card)] p-0">
          <div class="px-6 py-7 text-center">
            <h1 class="mb-6 text-xl font-semibold tracking-tight text-[color:var(--color-foreground)]">
              Login
            </h1>

            <div class="space-y-3">
              <!-- Hidden Google sign-in proxy for API initialization -->
              <div class="login-google-proxy" aria-hidden="true">
                <google-sign-in-button ref="googleSignInBtn" @onCredentialResponse="loginGoogle" />
              </div>

              <button
                class="login-provider-btn login-provider-google"
                @click="triggerGoogleLogin"
              >
                <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span>Sign in with Google</span>
              </button>

              <UiButton
                variant="outline"
                class-name="login-provider-btn login-provider-discord"
                @click="loginDiscord"
              >
                <span class="flex items-center gap-2">
                  <UiIcon :icon="icons.mdiDiscord" size="sm" />
                  <span>{{ $t("views.login.with.1") }}</span>
                </span>
              </UiButton>
            </div>
          </div>
        </UiCard>
      </div>
    </div>

    <!-- Logged in: full account management -->
    <UiCard v-if="userdata.user" class-name="overflow-hidden border-[color:var(--color-border)] bg-[color:var(--color-card)] p-0">
      <div class="grid divide-y divide-[color:var(--color-border)] lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:divide-x lg:divide-y-0">
        <div class="divide-y divide-[color:var(--color-border)]">
          <div class="space-y-3 px-5 py-5 sm:px-6 sm:py-6">
            <div class="flex flex-wrap items-center gap-3">
              <img
                :src="avatarUrl"
                alt="User avatar"
                class="h-12 w-12 rounded-full border border-[color:var(--color-border)]"
              >
              <div class="min-w-0 flex-1">
                <template v-if="editingUsername">
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <UiInput
                      v-model="usernameInput"
                      class-name="h-9 w-full sm:max-w-sm"
                      @keydown.enter.prevent="saveUsername"
                    />
                    <div class="flex items-center gap-2">
                      <UiButton size="icon" class-name="h-8 w-8 rounded-md" @click="saveUsername">
                        <UiIcon :icon="mdiCheck" size="xs" />
                        <span class="sr-only">{{ $t("views.login.usernameBtn.2") }}</span>
                      </UiButton>
                      <UiButton
                        variant="secondary"
                        size="icon"
                        class-name="h-8 w-8 rounded-md"
                        @click="cancelUsernameEdit"
                      >
                        <UiIcon :icon="mdiClose" size="xs" />
                        <span class="sr-only">Cancel</span>
                      </UiButton>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <div class="flex items-center gap-2">
                    <div class="truncate text-lg font-semibold text-[color:var(--color-foreground)]">
                      {{ userTag }}
                    </div>
                    <UiButton
                      variant="secondary"
                      size="icon"
                      class-name="h-7 w-7 rounded-md"
                      @click="startUsernameEdit"
                    >
                      <UiIcon :icon="mdiPencil" size="xs" />
                      <span class="sr-only">{{ $t("views.login.usernameBtn.0") }}</span>
                    </UiButton>
                  </div>
                </template>
                <div class="text-sm text-[color:var(--color-muted-foreground)]">
                  {{ userPts }}
                </div>
              </div>
            </div>

            <div class="grid max-w-md gap-2 sm:grid-cols-2">
              <div class="login-status-chip">
                <UiIcon :icon="icons.mdiGoogle" size="sm" />
                <span>Google</span>
                <UiBadge
                  v-if="userdata.user.google_id"
                  variant="secondary"
                  class-name="ml-auto border-[color:var(--color-bold)] bg-[color:var(--color-base)] text-[color:var(--color-foreground)]"
                >
                  Linked
                </UiBadge>
                <UiButton
                  v-else
                  variant="secondary"
                  size="sm"
                  class-name="ml-auto h-6 rounded-md px-2 text-[11px]"
                  @click="triggerGoogleLink"
                >
                  Unlinked
                </UiButton>
              </div>
              <div class="login-status-chip">
                <UiIcon :icon="icons.mdiDiscord" size="sm" />
                <span>Discord</span>
                <UiBadge
                  v-if="userdata.user.discord_id"
                  variant="secondary"
                  class-name="ml-auto border-[color:var(--color-bold)] bg-[color:var(--color-base)] text-[color:var(--color-foreground)]"
                >
                  Linked
                </UiBadge>
                <UiButton
                  v-else
                  variant="secondary"
                  size="sm"
                  class-name="ml-auto h-6 rounded-md px-2 text-[11px]"
                  @click="loginDiscord"
                >
                  Unlinked
                </UiButton>
              </div>
            </div>

            <div v-if="!userdata.user.google_id" class="login-google-proxy" aria-hidden="true">
              <google-sign-in-button ref="googleSignInProxy" @onCredentialResponse="loginGoogle" />
            </div>
          </div>

          <div class="space-y-3 px-5 py-5 sm:px-6 sm:py-6">
            <div v-if="userdata.user.yt_channel_key" class="space-y-2">
              <div class="text-sm font-semibold text-[color:var(--color-foreground)]">
                {{ $t("views.login.ownedYtChannel") }}
              </div>
              <UiInput
                :model-value="userdata.user.yt_channel_key || 'None on file'"
                disabled
              />
              <p class="text-xs text-[color:var(--color-muted-foreground)]">
                {{ $t("views.login.futureYtcOwnerMessage") }}
              </p>
            </div>

            <UiSeparator v-if="userdata.user.yt_channel_key" />
          </div>
        </div>

        <div id="calendar" class="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
          <label class="inline-flex items-center gap-3 text-sm text-[color:var(--color-foreground)]">
            <input
              v-model="preferEnglishName"
              type="checkbox"
              class="h-4 w-4 rounded border-[color:var(--color-border)] bg-[color:var(--color-card)]"
            >
            <span>{{ $t("views.settings.useEnglishNameLabel") }}</span>
          </label>

          <div class="space-y-3">
            <div class="text-lg font-semibold text-[color:var(--color-foreground)]">
              iCal Feed
            </div>
            <calendar-usage :initial-query="initialQueryForCalendar" />
          </div>
        </div>
      </div>
    </UiCard>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, getCurrentInstance } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { mdiCheck, mdiClose, mdiPencil, mdiGoogle } from "@mdi/js";
import { mdiDiscord } from "@/utils/icons";
import api from "@/utils/backend-api";
import { useMetaTitle } from "@/composables/useMetaTitle";
import { useAppStore } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";
import { useFavoritesStore } from "@/stores/favorites";
import GoogleSignInButton from "@/components/common/GoogleSignInButton.vue";
import CalendarUsage from "@/components/calendar/CalendarUsage.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiInput from "@/components/ui/input/Input.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiBadge from "@/components/ui/badge/Badge.vue";
import UiSeparator from "@/components/ui/separator/Separator.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID || "793619250115379262";

const route = useRoute();
const { t } = useI18n();
const { proxy } = getCurrentInstance()!;
const appStore = useAppStore();
const settingsStore = useSettingsStore();
const favoritesStore = useFavoritesStore();

useMetaTitle("Account - Holodex");

const icons = { mdiGoogle, mdiDiscord };

// Template refs
const googleSignInBtn = ref<InstanceType<typeof GoogleSignInButton> | null>(null);
const googleSignInProxy = ref<InstanceType<typeof GoogleSignInButton> | null>(null);

// Reactive state
const editingUsername = ref(false);
const editUsernameInput = ref("");
const initialQueryForCalendar = ref<false | object[]>(false);

// Computed
const userdata = computed(() => appStore.userdata);

const avatarUrl = computed(() => {
  const seed = appStore.userdata?.user?.id || "guest";
  return `https://api.dicebear.com/7.x/shapes/svg?seed=${seed}`;
});

const userTag = computed(() => {
  const user = appStore.userdata?.user;
  if (!user) return "";
  return `${user.username}`;
});

const userPts = computed(() => {
  const points = appStore.userdata?.user?.contribution_count || 0;
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
      : userdata.value?.user?.username,
  set: (val: string) => {
    editUsernameInput.value = val;
  },
});

// Methods
function resolveDiscordRedirectUri() {
  const override = import.meta.env.VITE_DISCORD_REDIRECT_URI;
  if (override) return override;
  // Always use current origin for OAuth redirect (works for any self-hosted instance).
  return window.location.origin + "/user?service=discord";
}

function scrollFix(hashbang: string) {
  window.location.hash = hashbang;
}

function startUsernameEdit() {
  if (!userdata.value?.user?.username) return;
  editUsernameInput.value = userdata.value.user.username;
  editingUsername.value = true;
}

function cancelUsernameEdit() {
  editingUsername.value = false;
  editUsernameInput.value = userdata.value?.user?.username || "";
}

async function loginGoogle({ credential }: { credential: string }) {
  const resp = await api.login(
    appStore.userdata.jwt,
    credential,
    "google",
  );
  appStore.setUser(resp.data);
  proxy!.$gtag.event("login", {
    event_label: "google",
  });
  favoritesStore.resetFavorites();
}

function triggerGoogleLink() {
  const proxyRef = Array.isArray(googleSignInProxy.value)
    ? googleSignInProxy.value[0]
    : googleSignInProxy.value;
  if (proxyRef?.triggerGoogleLogin) {
    proxyRef.triggerGoogleLogin();
    return;
  }
  nextTick(() => {
    const nextRef = Array.isArray(googleSignInProxy.value)
      ? googleSignInProxy.value[0]
      : googleSignInProxy.value;
    nextRef?.triggerGoogleLogin?.();
  });
}

function triggerGoogleLogin() {
  // First try the hidden button's programmatic click
  const btnRef = Array.isArray(googleSignInBtn.value)
    ? googleSignInBtn.value[0]
    : googleSignInBtn.value;
  if (btnRef?.triggerGoogleLogin?.()) {
    return;
  }
  // Fallback: initialize Google Identity and show One Tap prompt
  const GOOGLE_CLIENT_ID = "275540829388-87s7f9v2ht3ih51ah0tjkqng8pd8bqo2.apps.googleusercontent.com";
  if ((window as any).google?.accounts?.id) {
    (window as any).google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (e: any) => loginGoogle(e),
    });
    (window as any).google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // One Tap not available, try the hidden button again
        btnRef?.triggerGoogleLogin?.();
      }
    });
  }
}

async function loginDiscord() {
  const redirectUri = resolveDiscordRedirectUri();
  const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    redirectUri,
  )}&response_type=token&scope=identify`;
  // Use same-tab redirect to avoid popup blockers in local testing.
  window.location.assign(authUrl);
}

async function forceUserUpdate() {
  appStore.loginVerify();
}

async function saveUsername() {
  if (!editingUsername.value) return;
  editingUsername.value = false;
  try {
    const res = await api.changeUsername(
      userdata.value.jwt,
      editUsernameInput.value,
    );
    if (res && res.status === 200) {
      forceUserUpdate();
    }
  } catch (e) {
    console.error(e);
  }
}

// Created logic (runs synchronously during setup)
if (appStore.currentOrg.name !== "All Vtubers") {
  initialQueryForCalendar.value = [
    {
      type: "org",
      text: appStore.currentOrg.name,
      value: appStore.currentOrg.name,
    },
  ];
}

// Mounted logic
onMounted(async () => {
  const params = new URL(window.location.href).searchParams;
  const service = params.get("service");
  if (service === "discord" && window.location.hash) {
    const hash = window.location.hash.substring(1);
    const discordAuthParams = new URLSearchParams(hash);
    const accessToken = discordAuthParams.get("access_token");
    const resp = await api.login(
      appStore.userdata.jwt,
      accessToken,
      "discord",
    );
    appStore.setUser(resp.data);
    proxy!.$gtag.event("login", {
      event_label: "discord",
    });
    favoritesStore.resetFavorites();
  }
  if (route.hash) setTimeout(() => scrollFix(route.hash), 1);
});
</script>

<style>
#calendar:target {
  border: 1px solid rgb(248 113 113 / 0.5);
}

.login-provider-btn {
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

.login-provider-google {
  border: 1px solid var(--color-border);
  background: var(--color-card);
  color: var(--color-foreground);
}

.login-provider-google:hover {
  border-color: #e91e8c;
  background: color-mix(in srgb, #e91e8c 18%, var(--color-card));
}

.login-provider-discord {
  border: 1px solid var(--color-border) !important;
  background: var(--color-card) !important;
  color: var(--color-foreground) !important;
}

.login-provider-discord:hover {
  border-color: #5865F2 !important;
  background: color-mix(in srgb, #5865F2 18%, var(--color-card)) !important;
  color: var(--color-foreground) !important;
}

.login-google-proxy {
  position: fixed;
  left: -9999px;
  top: -9999px;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
  overflow: hidden;
}

.login-status-chip {
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
