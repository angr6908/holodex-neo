<template>
  <section class="flex h-screen max-h-screen flex-col gap-4 px-3 py-3">
    <UiCard class-name="flex flex-wrap items-center gap-2 p-3">
      <UiButton
        as="router-link"
        size="sm"
        variant="outline"
        to="/"
      >
        <UiIcon :icon="mdiHome" size="sm" />
        {{ $t("component.mainNav.home") }}
      </UiButton>
      <UiButton size="sm" variant="outline" @click="modalMode = 3; modalNexus = true">
        {{ $t("views.tlClient.menu.setting") }}
      </UiButton>
      <UiButton
        as="router-link"
        size="sm"
        variant="outline"
        :to="`/scripteditor?video=${video.id ? `YT_${video.id}` : mainStreamLink}`"
      >
        {{ $t("component.videoCard.openScriptEditor") }}
      </UiButton>
      <div class="mx-auto hidden md:block" />
      <UiButton
        v-if="!vidPlayer"
        size="sm"
        variant="outline"
        @click="loadVideo()"
      >
        {{ $t("views.tlClient.menu.loadVideo") }}
      </UiButton>
      <UiButton
        v-else
        size="sm"
        variant="outline"
        @click="unloadVideo()"
      >
        {{ $t("views.tlClient.menu.unloadVideo") }}
      </UiButton>
      <UiButton
        size="sm"
        variant="outline"
        @click="modalMode = 4; modalNexus = true; activeURLStream = ''"
      >
        {{ $t("views.tlClient.menu.loadChat") }}
      </UiButton>
      <UiButton size="sm" variant="outline" @click="modalMode = 5; modalNexus = true">
        {{ $t("views.tlClient.menu.unloadChat") }}
      </UiButton>
    </UiCard>

    <div
      class="flex min-h-0 flex-1 items-stretch gap-3"
      @click="menuBool = false"
      @mousemove="resizeMouseMove($event)"
      @mouseleave="resizeMouseLeave(1)"
      @mouseup="resizeMouseUp()"
    >
      <div
        class="glass-panel relative flex min-h-0 flex-col overflow-hidden rounded-[calc(var(--radius)+6px)]"
        :style="{ width: activeChat.length < 2 ? videoPanelWidth1 + '%' : videoPanelWidth2 + '%' }"
        @mouseleave="resizeMouseLeave(0)"
      >
        <div v-if="resizeActive" class="absolute inset-0 z-10 bg-transparent" />

        <div
          v-if="vidPlayer && getVideoIDFromUrl(mainStreamLink)"
          class="min-h-0 flex-1 overflow-hidden border-b border-white/10"
        >
          <div id="player" class="h-full w-full">
            <youtube-player
              v-if="getVideoIDFromUrl(mainStreamLink).type !== 'twitch'"
              :video-id="getVideoIDFromUrl(mainStreamLink).id"
            />
            <twitch-player
              v-else
              :channel="getVideoIDFromUrl(mainStreamLink).id"
              style="width: 100%; height: 100%"
            />
          </div>
        </div>

        <button
          v-if="vidPlayer"
          type="button"
          class="flex h-2 cursor-s-resize items-center justify-center bg-white/6"
          @mousedown="resizeMouseDown($event, 0)"
        >
          <span class="h-[3px] min-w-10 rounded-full bg-white/30" />
        </button>

        <LiveTranslations
          v-if="!isLoading"
          :tl-lang="TLLang.value"
          :tl-client="true"
          :video="mainLinkIsCustom ? { id: mainStreamLink, isCustom: true } : video"
          :class="{
            'stick-bottom': liveTlStickBottom,
            'tl-full-height': false,
          }"
          :style="{ height: vidPlayer ? tlChatHeight + 'px' : '100%' }"
          :use-local-subtitle-toggle="false"
        />

        <div
          v-if="profileDisplay && activeChat.length > 1"
          class="ProfileListCard glass-panel flex flex-col gap-1 rounded-xl px-3 py-2 text-xs text-slate-200"
        >
          <span
            v-for="(prf, index) in profile"
            :key="'profilecard' + index"
            :class="index === profileIdx ? 'font-medium text-sky-300' : ''"
          ><span v-if="index === profileIdx">> </span>
            <kbd v-if="index > 0">Ctrl-{{ index }}</kbd>
            <kbd v-if="index == 0">Ctrl-{{ index }} | Shift⇧-Tab↹</kbd>
            {{ " " + prf.Name }}
          </span>
        </div>
      </div>

      <button
        v-if="activeChat.length > 0"
        type="button"
        class="flex w-[7px] cursor-e-resize items-center justify-center"
        @mousedown="resizeMouseDown($event, 1)"
      >
        <span class="my-auto h-[10%] min-h-10 w-[3px] rounded-full bg-white/30" />
      </button>

      <div
        v-if="activeChat.length > 0"
        class="ChatPanelContainer glass-panel relative grid min-h-0 flex-1 overflow-hidden rounded-[calc(var(--radius)+6px)]"
        :style="activeChatGridRow"
      >
        <div v-if="resizeActive" class="absolute inset-0 z-10 bg-transparent" />
        <div
          v-for="(ChatURL, index) in activeChat"
          :key="ChatURL.text"
          class="flex min-h-0 flex-col border-b border-white/8 last:border-b-0"
        >
          <div class="flex items-center justify-between px-3 py-2 text-sm text-slate-200">
            <span>{{ ChatURL.text }}</span>
            <button type="button" class="text-slate-400 hover:text-white" @click="closeActiveChat(index)">
              <UiIcon :icon="mdiCloseCircle" size="sm" />
            </button>
          </div>
          <iframe
            class="activeChatIFrame min-h-0 flex-1"
            :src="URLExtender(ChatURL.text)"
            frameborder="0"
            @load="IFrameLoaded($event, ChatURL.text)"
          />
        </div>

        <div
          v-if="profileDisplay && activeChat.length < 2"
          class="ProfileListCard glass-panel flex flex-col gap-1 rounded-xl px-3 py-2 text-xs text-slate-200"
        >
          <span
            v-for="(prf, index) in profile"
            :key="'profilecard' + index"
            :class="index === profileIdx ? 'font-medium text-sky-300' : ''"
          ><span v-if="index === profileIdx">> </span>
            <kbd v-if="index > 0">Ctrl-{{ index }}</kbd>
            <kbd v-if="index == 0">Ctrl-{{ index }} | Shift⇧-Tab↹</kbd>
            <kbd v-if="index === Math.max(1, (profileIdx + 1) % profile.length)" class="ml-1">Tab↹</kbd>
            {{ " " + prf.Name }}
          </span>
        </div>
      </div>
    </div>

    <UiCard
      class-name="p-3"
      @keydown.up.exact="profileUp()"
      @keydown.down.exact="profileDown(false)"
      @keydown.tab.exact.prevent="profileDown(true)"
      @keydown.shift.tab.exact.prevent="profileJumpToDefault()"
      @keydown.ctrl.0.exact.prevent="profileJump(0)"
      @keydown.ctrl.1.exact.prevent="profileJump(1)"
      @keydown.ctrl.2.exact.prevent="profileJump(2)"
      @keydown.ctrl.3.exact.prevent="profileJump(3)"
      @keydown.ctrl.4.exact.prevent="profileJump(4)"
      @keydown.ctrl.5.exact.prevent="profileJump(5)"
      @keydown.ctrl.6.exact.prevent="profileJump(6)"
      @keydown.ctrl.7.exact.prevent="profileJump(7)"
      @keydown.ctrl.8.exact.prevent="profileJump(8)"
      @keydown.ctrl.9.exact.prevent="profileJump(9)"
    >
      <div class="flex flex-col gap-3 lg:flex-row">
        <div class="flex flex-1 items-center gap-2 rounded-xl border border-white/10 bg-white/4 px-3 py-2">
          <span class="shrink-0 text-sm text-slate-400">{{ profile[profileIdx].Prefix }}</span>
          <UiInput
            v-model="inputString"
            class-name="border-0 bg-transparent px-0 shadow-none focus:ring-0"
            placeholder="Type TL Here <Enter key to send>"
            @keypress.enter="addEntry()"
          />
          <span class="shrink-0 text-sm text-slate-400">{{ profile[profileIdx].Suffix }}</span>
        </div>
        <UiButton class-name="lg:self-start" @click="addEntry()">
          {{ $t("views.tlClient.tlControl.enterBtn") }}
        </UiButton>
        <UiButton variant="outline" class-name="lg:self-start" @click="TLSetting = !TLSetting">
          {{
            TLSetting
              ? $t("views.tlClient.tlControl.hideSetting")
              : $t("views.tlClient.tlControl.showSetting")
          }}
          <UiIcon :icon="TLSetting ? mdiCogOff : mdiCog" size="sm" />
        </UiButton>
      </div>

      <div v-if="TLSetting" class="mt-3 rounded-[calc(var(--radius)+6px)] border border-white/10 bg-white/4 p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="text-sm font-medium text-white">
              Current Profile [{{ profile[profileIdx].Name }}] Settings
            </div>
            <div class="mt-2 space-y-1 text-xs text-slate-400">
              <div>While typing in TL box</div>
              <div><kbd>Up⇧</kbd> or <kbd>Down⇩</kbd> to change Profiles</div>
              <div><kbd>Ctrl+[0~9]</kbd> to quick switch to Profile 0-9</div>
              <div><kbd>Tab↹</kbd> to quick switch between Profiles 1-9 (0 is special)</div>
              <div><kbd>Shift⇧-Tab↹</kbd> to quick switch to Profile 0</div>
            </div>
          </div>
          <button type="button" class="text-slate-400 hover:text-white" @click="TLSetting = false">
            <UiIcon :icon="mdiClose" size="sm" />
          </button>
        </div>

        <div class="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
          <label class="space-y-2">
            <span class="block text-sm font-medium text-slate-300">{{ $t('views.tlClient.tlControl.prefix') }}</span>
            <UiInput v-model="profile[profileIdx].Prefix" />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-medium text-slate-300">{{ $t('views.tlClient.tlControl.suffix') }}</span>
            <UiInput v-model="profile[profileIdx].Suffix" />
          </label>
          <label class="space-y-2">
            <span class="block text-sm font-medium text-slate-300">{{ $t('views.tlClient.tlControl.localPrefix') }}</span>
            <UiInput v-model="localPrefix" />
          </label>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <UiButton
            variant="secondary"
            @click="modalMode = 1; modalNexus = true; addProfileNameString = 'Profile ' + profile.length"
          >
            {{ $t("views.tlClient.tlControl.addProfile") }}
          </UiButton>
          <UiButton variant="secondary" @click="modalMode = 2; modalNexus = true">
            {{ $t("views.tlClient.tlControl.removeProfile") }} ({{ profile[profileIdx].Name }})
          </UiButton>
          <UiButton variant="secondary" @click="shiftProfileUp()">
            {{ $t("views.tlClient.tlControl.shiftUp") }}
          </UiButton>
          <UiButton variant="secondary" @click="shiftProfileDown()">
            {{ $t("views.tlClient.tlControl.shiftDown") }}
          </UiButton>
        </div>
      </div>
    </UiCard>

    <UiDialog :open="modalNexus" class-name="max-w-[600px]" @update:open="handleModalOpen">
      <div v-if="modalMode === 1" class="space-y-5 p-6">
        <h2 class="text-lg font-semibold text-white">
          {{ $t("views.tlClient.addProfilePanel.title") }}
        </h2>
        <UiInput
          v-model="addProfileNameString"
          :placeholder="$t('views.tlClient.addProfilePanel.inputLabel')"
        />
        <div class="flex items-center gap-3">
          <UiButton variant="ghost" @click="modalNexus = false">
            {{ $t("views.tlClient.cancelBtn") }}
          </UiButton>
          <UiButton class-name="ml-auto" @click="addProfile()">
            {{ $t("views.tlClient.okBtn") }}
          </UiButton>
        </div>
      </div>

      <div v-else-if="modalMode === 2" class="space-y-5 p-6">
        <h2 class="text-lg font-semibold text-white">
          {{ $t("views.tlClient.removeProfileTitle") + " " + profile[profileIdx].Name }}.
        </h2>
        <div class="flex items-center gap-3">
          <UiButton variant="ghost" @click="modalNexus = false">
            {{ $t("views.tlClient.cancelBtn") }}
          </UiButton>
          <UiButton class-name="ml-auto" @click="deleteProfile()">
            {{ $t("views.tlClient.okBtn") }}
          </UiButton>
        </div>
      </div>

      <div v-else-if="modalMode === 3" class="space-y-5 p-6">
        <div>
          <h2 class="text-lg font-semibold text-white">
            {{ $t("views.tlClient.settingPanel.title") }}
          </h2>
          <p class="mt-2 text-sm text-slate-400">
            {{ $t("views.watch.uploadPanel.usernameText") + " : " + userdata.user.username + " " }}
            <a class="underline underline-offset-4 hover:text-sky-300" @click="changeUsernameClick()">{{ $t("views.watch.uploadPanel.usernameChange") }}</a>
          </p>
        </div>

        <label class="block space-y-2">
          <span class="text-sm font-medium text-slate-300">{{ $t('views.watch.uploadPanel.tlLang') }}</span>
          <select
            v-model="TLLang"
            class="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
            @change="localPrefix = '[' + TLLang.value + '] '"
          >
            <option
              v-for="item in TL_LANGS"
              :key="item.value"
              :value="item"
              class="bg-slate-950"
            >
              {{ item.text + ' (' + item.value + ')' }}
            </option>
          </select>
        </label>

        <div class="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label class="flex-1 space-y-2">
            <span class="block text-sm font-medium text-slate-300">{{ $t('views.tlClient.settingPanel.mainStreamLink') }}</span>
            <UiInput v-model="mainStreamLink" placeholder="https://..." />
          </label>
          <span class="text-sm text-slate-500">or</span>
          <UiButton variant="secondary" @click="videoSelectDialog = true">
            Find Video
          </UiButton>
        </div>

        <div class="space-y-3">
          <div class="text-sm font-medium text-slate-300">
            {{ $t("views.tlClient.settingPanel.collabLink") }}
          </div>
          <div v-for="(AuxLink, index) in collabLinks" :key="index" class="flex gap-2">
            <UiButton variant="outline" size="icon" @click="deleteAuxLink(index)">
              <UiIcon :icon="mdiMinusCircle" size="sm" />
            </UiButton>
            <UiInput v-model="collabLinks[index]" class-name="flex-1" />
            <UiButton variant="outline" size="icon" @click="collabLinks.push('')">
              <UiIcon :icon="mdiPlusCircle" size="sm" />
            </UiButton>
          </div>
        </div>

        <div class="flex justify-center">
          <UiButton @click="settingOKClick()">
            {{ $t("views.tlClient.okBtn") }}
          </UiButton>
        </div>
      </div>

      <div v-else-if="modalMode === 4" class="space-y-5 p-6">
        <h2 class="text-lg font-semibold text-white">
          {{ $t("views.tlClient.loadChatPanel.title") }}
        </h2>
        <UiInput v-model="activeURLStream" :placeholder="$t('views.tlClient.loadChatPanel.inputLabel')" />
        <div class="flex items-center gap-3">
          <UiButton variant="ghost" @click="modalNexus = false">
            {{ $t("views.tlClient.cancelBtn") }}
          </UiButton>
          <UiButton class-name="ml-auto" @click="loadChat(activeURLStream); modalNexus = false">
            {{ $t("views.tlClient.okBtn") }}
          </UiButton>
        </div>
      </div>

      <div v-else-if="modalMode === 5" class="space-y-5 p-6">
        <h2 class="text-lg font-semibold text-white">
          {{ $t("views.tlClient.unloadChatTitle") }}
        </h2>
        <div class="flex items-center gap-3">
          <UiButton variant="ghost" @click="modalNexus = false">
            {{ $t("views.tlClient.cancelBtn") }}
          </UiButton>
          <UiButton class-name="ml-auto" @click="unloadAll(); modalNexus = false">
            {{ $t("views.tlClient.okBtn") }}
          </UiButton>
        </div>
      </div>
    </UiDialog>

    <UiDialog :open="videoSelectDialog" class-name="max-w-[95vw]" @update:open="videoSelectDialog = $event">
      <div class="bg-slate-950">
        <video-selector @videoClicked="handleVideoClicked" />
      </div>
    </UiDialog>

    <div
      v-if="errorMessage && showErrorAlert"
      class="fixed bottom-4 right-4 z-[120] rounded-2xl border border-rose-400/30 bg-rose-500/90 px-4 py-3 text-sm text-white shadow-2xl"
    >
      <div class="flex items-center gap-3">
        <span>{{ errorMessage }}</span>
        <button type="button" class="text-white/80 hover:text-white" @click="showErrorAlert = false">
          <UiIcon :icon="mdiClose" size="sm" />
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiDialog from "@/components/ui/dialog/Dialog.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";
import LiveTranslations from "@/components/chat/LiveTranslations.vue";
import VideoSelector from "@/components/multiview/VideoSelector.vue";
import { TL_LANGS, VIDEO_URL_REGEX } from "@/utils/consts";
import {
  mdiPlusCircle,
  mdiMinusCircle,
  mdiCloseCircle,
  mdiCog,
  mdiCogOff,
  mdiHome,
  mdiClose,
} from "@mdi/js";
import { getVideoIDFromUrl } from "@/utils/functions";
import backendApi from "@/utils/backend-api";
import { useTlclientStore } from "@/stores/tlclient";
import { useAppStore } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";
import YoutubePlayer from "@/components/player/YoutubePlayer.vue";
import TwitchPlayer from "@/components/player/TwitchPlayer.vue";
import { useStorage } from "@vueuse/core";
import { useMetaTitle } from "@/composables/useMetaTitle";

useMetaTitle(() => "TLClient - Holodex");

const route = useRoute();
const router = useRouter();

// --- Persistent storage ---
const profile = useStorage("tldex-profiles", [
  {
    Name: "Default",
    Prefix: "",
    Suffix: "",
    useCC: false,
    CC: "#000000",
    useOC: false,
    OC: "#000000",
  },
]);
const mainStreamLink = useStorage("tldex-lastlink", "");

// --- Reactive state ---
const TLSetting = ref(true);
const firstLoad = ref(true);
// Profiles
const profileIdx = ref(0);
const profileDisplay = ref(false);
const profileDisplayTimer = ref<ReturnType<typeof setInterval> | undefined>(undefined);
const inputString = ref("");
const localPrefix = ref(`[${TL_LANGS[0].value}] `);
// Modal
const modalNexus = ref(true);
const modalMode = ref(3);
const addProfileNameString = ref("");
// Settings
const TLLang = ref(TL_LANGS[0]);
const collabLinks = ref<string[]>([""]);
const videoSelectDialog = ref(false);
// Active chat
const activeChat = ref<Array<{ text: string; IFrameEle?: HTMLIFrameElement | null }>>([]);
const activeURLStream = ref("");
// Active video
const vidPlayer = ref(false);
// Layout
const tlChatHeight = ref(200);
const videoPanelWidth1 = ref(60);
const videoPanelWidth2 = ref(40);
const resizeActive = ref(false);
const resizeMode = ref(0);
const resizePos = ref(0);
// Error
const showErrorAlert = ref(false);
const errorMessage = ref<string | false>(false);
// Menu
const menuBool = ref(false);

// --- Store state ---
const tlclientStore = useTlclientStore();
const video = computed(() => tlclientStore.video);
const isLoading = computed(() => tlclientStore.isLoading);

// --- Computed ---
const mainLinkIsCustom = computed(() => !video.value?.id);

const activeChatGridRow = computed(() => {
  if (activeChat.value.length < 4) {
    return { "grid-template-rows": "1fr" };
  }
  return { "grid-template-rows": "1fr 1fr" };
});

const userdata = computed(() => useAppStore().userdata);
const liveTlStickBottom = computed(() => useSettingsStore().liveTlStickBottom);

// --- Watchers ---
watch(
  () => route.query.video,
  () => {
    if (route.name === "tlclient" && route.query.video) {
      init();
    }
  },
);

watch(mainStreamLink, () => {
  if (
    route.query.video
    && mainStreamLink.value !== route.query.video
  ) {
    router.replace({ path: "/tlclient", query: {} });
  }
});

// --- Lifecycle ---
onMounted(() => {
  init();
  if (localStorage.getItem("Holodex-TLClient")) {
    const defaultSetting = JSON.parse(
      localStorage.getItem("Holodex-TLClient")!,
    );
    if (defaultSetting.tlChatHeight) {
      tlChatHeight.value = defaultSetting.tlChatHeight;
    }
    if (defaultSetting.videoPanelWidth1) {
      videoPanelWidth1.value = defaultSetting.videoPanelWidth1;
    }
    if (defaultSetting.videoPanelWidth2) {
      videoPanelWidth2.value = defaultSetting.videoPanelWidth2;
    }
  }
});

// --- Methods ---
function handleModalOpen(open: boolean) {
  if (!open) {
    modalNexusOutsideClick();
  } else {
    modalNexus.value = true;
  }
}

function init() {
  firstLoad.value = true;
  modalNexus.value = true;
  modalMode.value = 3;
  collabLinks.value = [];
  unloadVideo();
  unloadAll();
  checkLoginValidity();
}

function IFrameLoaded(event: Event, target: string) {
  for (let i = 0; i < activeChat.value.length; i += 1) {
    if (activeChat.value[i].text === target) {
      activeChat.value[i].IFrameEle = (event.target as HTMLIFrameElement);
      switch (target.slice(0, 3)) {
        case "YT_": {
          if ((event.target as HTMLIFrameElement).contentWindow) {
            const eventWindow = (event.target as HTMLIFrameElement).contentWindow;
            setTimeout(() => {
              eventWindow!.postMessage(
                { n: "HolodexSync", d: "Initiate" },
                "https://www.youtube.com",
              );
            }, 5000);
          } else {
            let trial = 0;
            const id = setInterval(() => {
              if ((event.target as HTMLIFrameElement).contentWindow) {
                (event.target as HTMLIFrameElement).contentWindow?.postMessage(
                  { n: "HolodexSync", d: "Initiate" },
                  "https://www.youtube.com",
                );
                clearInterval(id);
                return;
              }
              trial += 1;
              if (trial === 10) {
                clearInterval(id);
              }
            }, 1000);
          }
          break;
        }

        case "TW_": {
          if ((event.target as HTMLIFrameElement).contentWindow) {
            (event.target as HTMLIFrameElement).contentWindow!.postMessage(
              { n: "HolodexSync", d: "Initiate" },
              "https://www.twitch.tv",
            );
          } else {
            let trial = 0;
            const id = setInterval(() => {
              if ((event.target as HTMLIFrameElement).contentWindow) {
                (event.target as HTMLIFrameElement).contentWindow?.postMessage(
                  { n: "HolodexSync", d: "Initiate" },
                  "https://www.twitch.tv",
                );
                clearInterval(id);
                return;
              }
              trial += 1;
              if (trial === 10) {
                clearInterval(id);
              }
            }, 1000);
          }
          break;
        }

        default:
          break;
      }
    }
  }
}

function addEntry() {
  activeChat.value.forEach((e) => {
    switch (e.text.slice(0, 3)) {
      case "YT_":
        e.IFrameEle?.contentWindow?.postMessage(
          {
            n: "HolodexSync",
            d:
              localPrefix.value
              + profile.value[profileIdx.value].Prefix
              + inputString.value
              + profile.value[profileIdx.value].Suffix,
          },
          "https://www.youtube.com",
        );
        break;

      case "TW_":
        e.IFrameEle?.contentWindow?.postMessage(
          {
            n: "HolodexSync",
            d:
              localPrefix.value
              + profile.value[profileIdx.value].Prefix
              + inputString.value
              + profile.value[profileIdx.value].Suffix,
          },
          "https://www.twitch.tv",
        );
        break;

      default:
        break;
    }
  });

  const bodydt = {
    name: userdata.value.user.username,
    message:
      profile.value[profileIdx.value].Prefix
      + inputString.value
      + profile.value[profileIdx.value].Suffix,
    cc: profile.value[profileIdx.value].useCC
      ? profile.value[profileIdx.value].CC
      : "",
    oc: profile.value[profileIdx.value].useOC
      ? profile.value[profileIdx.value].OC
      : "",
    source: "user",
  };

  backendApi
    .postTL({
      videoId: video.value?.id || "custom",
      jwt: userdata.value.jwt,
      lang: TLLang.value.value,
      ...(!video.value?.id && { custom_video_id: mainStreamLink.value }),
      body: bodydt,
    })
    .then(({ status, data }: { status: number; data: any }) => {
      if (status !== 200) {
        console.error(data);
      }
    })
    .catch((err: any) => {
      console.error(err);
    });

  collabLinks.value.forEach((link) => {
    if (!link) return;
    const ytVideoId = link.match(VIDEO_URL_REGEX)?.groups?.id;
    backendApi
      .postTL({
        videoId: ytVideoId || "custom",
        jwt: userdata.value.jwt,
        lang: TLLang.value.value,
        ...(!ytVideoId && { custom_video_id: link }),
        body: bodydt,
      })
      .then(({ status, data }: { status: number; data: any }) => {
        if (status !== 200) {
          console.error(data);
          errorMessage.value = data;
          showErrorAlert.value = true;
        }
      })
      .catch((err: any) => {
        console.error(err);
        errorMessage.value = err;
        showErrorAlert.value = true;
      });
  });

  inputString.value = "";
}

function deleteAuxLink(idx: number) {
  if (collabLinks.value.length !== 1) {
    collabLinks.value.splice(idx, 1);
  }
}

function modalNexusOutsideClick() {
  if (modalMode.value !== 3) {
    modalNexus.value = false;
  }
}

function settingOKClick() {
  const ytId = mainStreamLink.value.match(VIDEO_URL_REGEX)?.groups?.id || mainStreamLink.value;
  useTlclientStore().$reset();
  useTlclientStore().setId(ytId);
  useTlclientStore().fetchVideo();

  localPrefix.value = `[${TLLang.value.value}] `;
  modalNexus.value = false;
  if (firstLoad.value) {
    loadChat(mainStreamLink.value);
    loadVideo();
    collabLinks.value.forEach((e) => {
      loadChat(e);
    });
    firstLoad.value = false;
  }
}

// Profile controller
function shiftProfileUp() {
  if (profileIdx.value > 1) {
    const profileContainer = JSON.parse(
      JSON.stringify(profile.value[profileIdx.value - 1]),
    );
    profile.value[profileIdx.value - 1] = profile.value[profileIdx.value];
    profile.value[profileIdx.value] = profileContainer;
    profileIdx.value -= 1;
  }
  showProfileList();
}

function shiftProfileDown() {
  if (profileIdx.value !== 0 && profileIdx.value < profile.value.length - 1) {
    const profileContainer = JSON.parse(
      JSON.stringify(profile.value[profileIdx.value + 1]),
    );
    profile.value[profileIdx.value + 1] = profile.value[profileIdx.value];
    profile.value[profileIdx.value] = profileContainer;
    profileIdx.value += 1;
  }
  showProfileList();
}

function profileUp() {
  if (profileIdx.value === 0) {
    profileIdx.value = profile.value.length - 1;
  } else {
    profileIdx.value -= 1;
  }
  showProfileList();
}

function profileDown(isTab: boolean) {
  if (profileIdx.value === profile.value.length - 1) {
    profileIdx.value = isTab ? 1 : 0;
  } else {
    profileIdx.value += 1;
  }
  showProfileList();
}

function profileJump(idx: number) {
  if (idx < profile.value.length) {
    profileIdx.value = idx;
  }
  showProfileList();
}

function profileJumpToDefault() {
  profileIdx.value = 0;
  showProfileList();
}

function addProfile() {
  if (addProfileNameString.value.trim() === "") {
    addProfileNameString.value = `Profile ${profile.value.length}`;
  }
  profile.value.push({
    Name: addProfileNameString.value,
    Prefix: "",
    Suffix: "",
    useCC: false,
    CC: "#000000",
    useOC: false,
    OC: "#000000",
  });
  profileIdx.value = profile.value.length - 1;
  modalNexus.value = false;
  showProfileList();
}

function deleteProfile() {
  if (profileIdx.value !== 0) {
    profileIdx.value -= 1;
    profile.value.splice(profileIdx.value + 1, 1);
  }
  modalNexus.value = false;
  showProfileList();
}

function showProfileList() {
  if (!profileDisplay.value) {
    profileDisplay.value = true;
  }
  if (profileDisplayTimer.value) {
    clearInterval(profileDisplayTimer.value);
  }
  profileDisplayTimer.value = setInterval(() => {
    profileDisplay.value = false;
    clearInterval(profileDisplayTimer.value!);
  }, 3000);
}

// Active chat controller
function unloadAll() {
  activeChat.value = [];
}

function closeActiveChat(idx: number) {
  activeChat.value.splice(idx, 1);
}

function URLExtender(s: string) {
  switch (s.slice(0, 3)) {
    case "YT_":
      return `https://www.youtube.com/live_chat?v=${s.slice(
        3,
      )}&embed_domain=${window.location.hostname}`;

    case "TW_":
      return `https://www.twitch.tv/embed/${s.slice(3)}/chat?parent=${
        window.location.hostname
      }`;

    default:
      return "";
  }
}

function loadChat(s: string) {
  const StreamURL = getVideoIDFromUrl(s);
  if (StreamURL) {
    switch (StreamURL.type) {
      case "twitch": {
        activeChat.value.push({
          text: `TW_${StreamURL.id}`,
          IFrameEle: undefined,
        });
        break;
      }

      default: {
        activeChat.value.push({
          text: `YT_${StreamURL.id}`,
          IFrameEle: undefined,
        });
        break;
      }
    }
  }
}

// Video controller
function loadVideo() {
  vidPlayer.value = true;
}

function unloadVideo() {
  vidPlayer.value = false;
}

// Layout controller
function resizeMouseLeave(mode: number) {
  if (mode === resizeMode.value) {
    resizeActive.value = false;
    localStorage.setItem(
      "Holodex-TLClient",
      JSON.stringify({
        tlChatHeight: tlChatHeight.value,
        videoPanelWidth1: videoPanelWidth1.value,
        videoPanelWidth2: videoPanelWidth2.value,
      }),
    );
  }
}

function resizeMouseDown(event: MouseEvent, resizeSwitch: number) {
  if (!resizeActive.value) {
    resizeActive.value = true;
    resizeMode.value = resizeSwitch;
    if (resizeMode.value === 0) {
      resizePos.value = event.clientY;
    } else {
      resizePos.value = event.clientX;
    }
  }
}

function resizeMouseUp() {
  resizeActive.value = false;
  localStorage.setItem(
    "Holodex-TLClient",
    JSON.stringify({
      tlChatHeight: tlChatHeight.value,
      videoPanelWidth1: videoPanelWidth1.value,
      videoPanelWidth2: videoPanelWidth2.value,
    }),
  );
}

function resizeMouseMove(event: MouseEvent) {
  if (resizeActive.value) {
    if (resizeMode.value === 0) {
      const yChange = event.clientY - resizePos.value;
      resizePos.value = event.clientY;
      if (tlChatHeight.value - yChange < 100) {
        return;
      }
      tlChatHeight.value -= yChange;
    } else {
      const xChange = ((event.clientX - resizePos.value) * 100) / window.innerWidth;
      resizePos.value = event.clientX;
      if (activeChat.value.length < 2) {
        if (
          videoPanelWidth1.value + xChange > 75
          || videoPanelWidth1.value + xChange < 33
        ) {
          return;
        }
        videoPanelWidth1.value += xChange;
      } else {
        if (
          videoPanelWidth2.value + xChange > 75
          || videoPanelWidth2.value + xChange < 33
        ) {
          return;
        }
        videoPanelWidth2.value += xChange;
      }
    }
  }
}

async function checkLoginValidity() {
  useAppStore().loginVerify({ bounceToLogin: true });
}

function changeUsernameClick() {
  router.push({ path: "/user" });
}

function handleVideoClicked(selectedVideo: any) {
  videoSelectDialog.value = false;
  mainStreamLink.value = selectedVideo.type === "placeholder"
    ? selectedVideo.link
    : `https://youtube.com/watch?v=${selectedVideo.id}`;
}
</script>

<style>
.TopMenu {
  width: 100%;
  position: absolute;
  top: 0px;
  left: 0px;
  z-index: 1;
}
.ColourButton {
  margin-top: 19px;
  margin-left: 5px;
}
.ProfileListCard {
  position: absolute;
  bottom: 5px;
  right: 5px;
}
.ChatPanelContainer {
  display: grid;
  grid-auto-flow: column;
}
.activeChatIFrame {
  width: 100%;
  height: 100%;
}
.tl-topbar > *:not(:first-child):not(:last-child) {
  margin: 0px 3px;
}
.tl-topbar > * {
  border-radius: 0px;
  text-transform: unset !important;
}

#player > div,
#player > div > iframe {
  width: 100%;
  height: 100%;
}
</style>
