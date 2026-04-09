<template>
  <section class="space-y-6 px-4 py-6">
    <header class="space-y-2">
      <UiBadge variant="secondary">
        TLDex
      </UiBadge>
      <h1 class="text-3xl font-semibold tracking-tight text-white">
        {{ $t("views.tlManager.title") }}
      </h1>
      <p class="max-w-3xl text-sm text-slate-400">
        Manage translation scripts, export data, and clean up custom links from the migrated manager surface.
      </p>
    </header>

    <UiCard class-name="p-5">
      <div class="flex flex-col gap-4 md:flex-row md:items-center">
        <UiButton @click="modalNexus = true; modalMode = 3">
          <UiIcon :icon="mdiFileMultiple" size="sm" />
          Import From Mchad
        </UiButton>

        <div class="flex items-center gap-2 md:ml-auto">
          <UiButton variant="outline" size="icon" @click="loadPrev">
            <UiIcon :icon="mdiArrowLeftBold" size="sm" />
          </UiButton>
          <div class="min-w-[9rem] text-center text-sm text-slate-400">
            {{ pageRange }}
          </div>
          <UiButton variant="outline" size="icon" @click="loadNext">
            <UiIcon :icon="mdiArrowRightBold" size="sm" />
          </UiButton>
        </div>
      </div>

      <div class="mt-5 overflow-hidden rounded-[calc(var(--radius)+6px)] border border-white/10">
        <div class="max-h-[70vh] overflow-auto">
          <table class="min-w-full text-sm">
            <thead class="sticky top-0 bg-slate-950/95 backdrop-blur">
              <tr class="border-b border-white/10 text-left text-slate-300">
                <th class="px-4 py-3 font-medium">
                  {{ $t("views.tlManager.headerID") }}
                </th>
                <th class="px-4 py-3 font-medium">
                  Video Title
                </th>
                <th class="px-4 py-3 font-medium">
                  Lang
                </th>
                <th class="px-4 py-3 font-medium">
                  {{ $t("views.tlManager.headerEntries") }}
                </th>
                <th class="px-4 py-3 font-medium text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(dt, index) in tlData"
                :key="index"
                class="border-b border-white/8 text-slate-200 transition hover:bg-white/4"
              >
                <td class="px-4 py-3 align-top">
                  <a
                    class="text-sky-300 hover:text-sky-200"
                    :href="dt.video_id ? `watch/${dt.video_id}` : dt.custom_video_id"
                  >
                    {{ dt.video_id || dt.custom_video_id }}
                  </a>
                </td>
                <td class="max-w-0 px-4 py-3 align-top">
                  <div class="truncate">
                    {{ dt.title || dt.custom_video_id || "No title" }}
                  </div>
                </td>
                <td class="px-4 py-3 align-top">
                  {{ dt.lang }}
                </td>
                <td class="px-4 py-3 align-top">
                  {{ (dt.entry_count || 0) + " entries" }}
                </td>
                <td class="px-4 py-3 align-top">
                  <div class="flex justify-end gap-2">
                    <UiButton
                      size="icon"
                      variant="ghost"
                      :title="$t('component.videoCard.openScriptEditor')"
                      @click="openTlClient(dt.video_id, dt.custom_video_id)"
                    >
                      <UiIcon :icon="mdiTypewriter" size="sm" />
                    </UiButton>
                    <UiButton
                      v-if="dt.video_id"
                      size="icon"
                      variant="ghost"
                      :title="$t('component.videoCard.uploadScript')"
                      @click="uploadClick(dt.video_id)"
                    >
                      <UiIcon :icon="mdiClipboardArrowUpOutline" size="sm" />
                    </UiButton>
                    <UiButton
                      size="icon"
                      variant="ghost"
                      :title="$t('views.tlManager.download')"
                      @click="downloadClick(dt.video_id, dt.custom_video_id)"
                    >
                      <UiIcon :icon="mdiDownload" size="sm" />
                    </UiButton>
                    <UiButton
                      size="icon"
                      variant="ghost"
                      :title="$t('views.tlManager.delete')"
                      @click="deleteClick(dt.video_id, dt.custom_video_id)"
                    >
                      <UiIcon :icon="mdiTrashCan" size="sm" />
                    </UiButton>
                    <UiButton
                      v-if="dt.custom_video_id"
                      size="icon"
                      variant="ghost"
                      title="Change Custom Link"
                      @click="modalMode = 4; modalNexus = true; newLinkInput = dt.custom_video_id; selectedScript = dt"
                    >
                      <UiIcon :icon="icons.mdiNoteEdit" size="sm" />
                    </UiButton>
                  </div>
                </td>
              </tr>
              <tr v-if="tlData.length === 0">
                <td colspan="5" class="px-4 py-10 text-center text-slate-500">
                  No translation scripts found for this page.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </UiCard>

    <UiDialog :open="modalNexus" :class-name="dialogPanelClass" @update:open="handleDialogOpen">
      <div v-if="modalMode === 0" class="bg-slate-950">
        <UploadScript :video-data="videoData" @close="closeUpload" />
      </div>

      <div v-else-if="modalMode === 1" class="bg-slate-950">
        <ExportFile :video-data="videoData" />
      </div>

      <div v-else-if="modalMode === 2" class="space-y-5 p-6">
        <div>
          <h2 class="text-lg font-semibold text-white">
            {{ $t("views.tlManager.deleteTitle") }}
          </h2>
        </div>
        <label class="block space-y-2">
          <span class="text-sm font-medium text-slate-300">{{ $t("views.tlManager.langPick") }}</span>
          <select
            v-model="TLLang"
            class="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
            @change="reloadDeleteEntries"
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
        <p class="text-sm text-slate-400">
          {{ modalText }}
        </p>
        <div class="flex items-center gap-3">
          <UiButton variant="ghost" @click="modalNexus = false">
            {{ $t("views.tlClient.cancelBtn") }}
          </UiButton>
          <UiButton variant="destructive" class-name="ml-auto" @click="clearAll">
            {{ $t("views.tlManager.delete") }}
          </UiButton>
        </div>
      </div>

      <div v-else-if="modalMode === 3" class="bg-slate-950">
        <ImportMchad @close="closeUpload" />
      </div>

      <div v-else-if="modalMode === 4" class="space-y-5 p-6">
        <div>
          <h2 class="text-lg font-semibold text-white">
            Change stream link
          </h2>
        </div>
        <div class="space-y-2">
          <label class="block text-sm font-medium text-slate-300">New link</label>
          <UiInput v-model="newLinkInput" />
        </div>
        <div class="flex items-center gap-3">
          <UiButton variant="ghost" @click="modalNexus = false">
            {{ $t("views.tlClient.cancelBtn") }}
          </UiButton>
          <UiButton class-name="ml-auto" @click="modalNexus = false; changeLink()">
            {{ $t("views.tlClient.okBtn") }}
          </UiButton>
        </div>
      </div>
    </UiDialog>
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/stores/app";
import { useMetaTitle } from "@/composables/useMetaTitle";
import UiBadge from "@/components/ui/badge/Badge.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiDialog from "@/components/ui/dialog/Dialog.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";
import backendApi from "@/utils/backend-api";
import {
  mdiTypewriter,
  mdiClipboardArrowUpOutline,
  mdiTrashCan,
  mdiDownload,
  mdiArrowRightBold,
  mdiArrowLeftBold,
  mdiFileMultiple,
  mdiNoteEdit,
} from "@mdi/js";
import { TL_LANGS } from "@/utils/consts";
import ExportFile from "@/components/tlscriptmanager/ExportToFile.vue";
import UploadScript from "@/components/tlscriptmanager/UploadScript.vue";
import ImportMchad from "@/components/tlscriptmanager/ImportMchad.vue";

useI18n();
const route = useRoute();
const router = useRouter();
const appStore = useAppStore();

useMetaTitle(() => "TLManager - Holodex");

const icons = { mdiNoteEdit };

const tlData = ref<any[]>([]);
const modalNexus = ref(false);
const modalMode = ref(0);
const selectedID = ref<any>(-1);
const TLLang = ref(TL_LANGS[0]);
const modalText = ref("");
const entries = ref<any[]>([]);
const query = reactive({ limit: 20, offset: 0 });
const newLinkInput = ref("");
const selectedScript = ref<any>(undefined);
const videoData = ref<any>(undefined);

const dialogPanelClass = computed(() => {
  switch (modalMode.value) {
    case 2: return "max-w-[300px]";
    case 3: return "max-w-[95vw]";
    default: return "max-w-[600px]";
  }
});

const pageRange = computed(() => `${query.offset + 1} ... ${query.offset + query.limit}`);

function handleDialogOpen(open: boolean) {
  if (!open && modalMode.value !== 3) {
    modalNexus.value = false;
  } else if (open) {
    modalNexus.value = true;
  }
}

function reloadData() {
  backendApi.getTLStats(appStore.userdata.jwt, query).then(({ status, data }: any) => {
    if (status === 200) {
      tlData.value = data;
      modalNexus.value = false;
    }
  }).catch((err: any) => {
    console.error(err);
  });
}

function openTlClient(ID: string, custom_video_id: string) {
  if (appStore.userdata?.user) {
    router.push({ path: "/scripteditor", query: { video: custom_video_id || `YT_${ID}` } });
  } else {
    router.push({ path: "/user" });
  }
}

function deleteClick(ID: string, custom_video_id: string) {
  modalNexus.value = true;
  modalMode.value = 2;
  selectedID.value = custom_video_id || ID;
  reloadDeleteEntries();
}

async function downloadClick(ID: string, custom_video_id: string) {
  if (custom_video_id) {
    videoData.value = {
      id: "custom",
      custom_video_id,
      title: custom_video_id,
    };
  } else {
    const { status, data } = await backendApi.video(ID, TLLang.value.value);
    if (status === 200) {
      videoData.value = {
        id: ID,
        start_actual: !data.start_actual ? Date.parse(data.available_at) : Date.parse(data.start_actual),
        title: data.title,
      };
    }
  }
  modalNexus.value = true;
  modalMode.value = 1;
  selectedID.value = ID;
}

function uploadClick(ID: string) {
  backendApi.video(ID, TLLang.value.value).then(({ status, data }: any) => {
    if (status === 200) {
      videoData.value = {
        id: ID,
        start_actual: !data.start_actual ? Date.parse(data.available_at) : Date.parse(data.start_actual),
        title: data.title,
      };
      modalNexus.value = true;
      modalMode.value = 0;
      selectedID.value = ID;
    }
  }).catch((err: any) => {
    console.error(err);
  });
}

function closeUpload(e: { upload?: boolean }) {
  if (e.upload) {
    reloadData();
  }
  modalNexus.value = false;
}

function loadNext() {
  if (tlData.value.length >= query.limit) {
    tlData.value = [];
    query.offset += 20;
    reloadData();
  }
}

function loadPrev() {
  tlData.value = [];
  if (query.offset - 20 < 0) {
    query.offset = 0;
  } else {
    query.offset -= 20;
  }
  reloadData();
}

function reloadDeleteEntries() {
  const isCustom = !!String(selectedID.value).match(/^https:\/\//i);
  backendApi.chatHistory(isCustom ? "custom" : selectedID.value, {
    ...isCustom && { custom_video_id: selectedID.value },
    lang: TLLang.value.value,
    verified: 0,
    moderator: 0,
    vtuber: 0,
    limit: 100000,
    mode: 1,
    creator_id: appStore.userdata.user.id,
  }).then(({ status, data }: any) => {
    if (status === 200) {
      entries.value = data.map((e: any) => e.id);
      modalText.value = `${entries.value.length} entries`;
    }
  }).catch((err: any) => {
    console.error(err);
  });
}

function clearAll() {
  const isCustom = !!String(selectedID.value).match(/^https:\/\//i);
  const processes = entries.value.map((e) => ({
    type: "Delete",
    data: { id: e },
  }));

  backendApi.postTLLog({
    ...isCustom && { custom_video_id: selectedID.value },
    videoId: isCustom ? "custom" : selectedID.value,
    jwt: appStore.userdata.jwt,
    body: processes,
    lang: TLLang.value.value,
  }).then(({ status }: any) => {
    if (status === 200) {
      reloadData();
      modalNexus.value = false;
    }
  }).catch((err: any) => {
    console.error(err);
  });
}

async function changeLink() {
  try {
    await backendApi.postChangeLink({
      jwt: appStore.userdata.jwt,
      body: {
        oldId: selectedScript.value.custom_video_id,
        newId: newLinkInput.value,
        lang: selectedScript.value.lang,
      },
    });
  } catch (e) {
    alert(`failed ${e}`);
  }
  await reloadData();
}

watch(() => route.name, () => {
  if (route.name === "scriptmanager") {
    tlData.value = [];
    reloadData();
  }
});

onMounted(() => {
  reloadData();
});
</script>

<style scoped>
td {
    white-space: nowrap;
}
</style>
