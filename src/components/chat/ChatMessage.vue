<template>
  <div class="flex flex-row" :class="{ 'with-author': !hideAuthor && !source.shouldHideAuthor}">
    <div v-if="source.is_vtuber && source.channel_id" style="min-width: 28px;" class="mr-2">
      <channel-img
        v-if="!hideAuthor && !source.shouldHideAuthor"
        class="self-center"
        :channel="{ id: source.channel_id, name: source.name }"
        :size="28"
        rounded
        no-link
      />
    </div>
    <div class="basis-full">
      <div
        v-if="!hideAuthor && !source.shouldHideAuthor"
        :class="{
          'tl-caption': true,
          'text-[color:var(--color-primary)]': source.is_owner,
          'text-[color:var(--color-accent)]': !source.is_owner && (source.is_verified || source.is_moderator || source.is_vtuber),
        }"
      >
        <button type="button" class="tl-name relative text-left" @click="showBlockChannelDialog = true">
          <!-- <span v-if="source.is_owner">👑</span> -->
          <span v-if="source.is_vtuber">[Vtuber]</span>
          <span v-if="source.is_moderator">[Mod]</span>
          {{ source.name }}<span v-if="source.is_verified" style="font-weight: 800"> ✓</span>:
          <UiIcon :icon="icons.mdiCog" size="xs" class-name="tl-name-icon absolute mt-[2px] w-[11px]" />
        </button>
      </div>
      <a class="tl-message" :data-time="source.relativeMs/1000">
        <span v-if="source.timestamp" class="tl-caption mr-1">
          {{ liveTlShowLocalTime || !displayTime ? realTime : displayTime }}
        </span>
        <span v-if="source.parsed" class="text-[color:var(--color-primary)]" v-html="source.parsed" />
        <span v-else class="text-[color:var(--color-primary)]">{{ source.message }}</span>
      </a>
    </div>
    <UiDialog
      v-if="!hideAuthor && !source.shouldHideAuthor"
      :open="showBlockChannelDialog"
      class-name="max-w-lg p-0"
      @update:open="showBlockChannelDialog = $event"
    >
      <UiCard class-name="space-y-5 p-5">
        <div class="text-lg font-semibold text-white">
          {{ source.name }}
        </div>
        <div class="flex flex-wrap gap-2">
          <UiButton
            v-if="source.channel_id"
            as="a"
            :href="`https://youtube.com/channel/${source.channel_id}`"
            target="_blank"
            rel="noreferrer"
            variant="destructive"
            size="sm"
          >
            <UiIcon :icon="icons.mdiYoutube" size="sm" />
            Youtube
          </UiButton>
          <UiButton
            v-if="source.channel_id && source.is_vtuber"
            as="a"
            :href="`https://holodex.net/channel/${source.channel_id}`"
            target="_blank"
            rel="noreferrer"
            variant="secondary"
            size="sm"
          >
            Holodex
          </UiButton>
          <UiButton variant="outline" size="sm" @click="toggleBlockName(source.name)">
            {{ !blockedNames.has(source.name) ? "Block Channel" : "Unblock" }}
          </UiButton>
        </div>
      </UiCard>
    </UiDialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { dayjs, formatDuration } from "@/utils/time";
import * as icons from "@/utils/icons";
import { useSettingsStore } from "@/stores/settings";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiDialog from "@/components/ui/dialog/Dialog.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import ChannelImg from "../channel/ChannelImg.vue";

defineOptions({ name: "ChatMessage" });

const props = defineProps<{
  source: Record<string, any>;
  index?: number;
  hideAuthor?: boolean;
}>();

const settingsStore = useSettingsStore();

const showBlockChannelDialog = ref(false);

const realTime = computed(() => dayjs(props.source.timestamp).format("LTS"));

const displayTime = computed(() => {
  if (!props.source.relativeMs) return null;
  return (Math.sign(props.source.relativeMs) < 0 ? "-" : "") + formatDuration(Math.abs(props.source.relativeMs));
});

const liveTlShowLocalTime = computed(() => settingsStore.liveTlShowLocalTime);
const blockedNames = computed(() => settingsStore.liveTlBlockedNames);

function toggleBlockName(name: string) {
  settingsStore.toggleLiveTlBlocked(name);
}
</script>

<style>
.tl-caption {
    color: hsla(0, 0%, 70%, 0.7);
}

.tl-body .tl-caption {
    letter-spacing: 0.033em;
    font-size: 0.85em;
}

.tl-name, .tl-message {
  word-break: break-word;
}

.tl-name {
  cursor: pointer;
  background: transparent;
  border: 0;
  padding: 0;
}
.tl-name .tl-name-icon {
  opacity: 0;
}

.tl-name:hover .tl-name-icon {
  opacity: 1;
}

.with-author {
  border-top: 1px solid rgb(255 255 255 / 0.08);
  margin-top: 4px;
  padding-top: 4px;
}

/* Emojis */
.tl-message img {
  width: auto;
  height: 1.3em;
  vertical-align: middle;
}
</style>
