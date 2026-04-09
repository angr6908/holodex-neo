<template>
  <div class="mx-auto w-full">
    <div class="flex flex-wrap gap-6">
      <div class="w-full md:w-[calc(25%-1.5rem)]">
        <strong>{{ $t("component.channelInfo.stats") }}</strong>
        <div class="my-3 h-px bg-white/10" />
        {{ $t("component.channelInfo.videoCount", [channel.video_count]) }}
        <div class="my-3 h-px bg-white/10" />
        {{ channel.clip_count }} {{ $t("component.channelInfo.clipCount", [channel.clip_count]) }}
        <div class="my-3 h-px bg-white/10" />
        {{ channel.view_count }} {{ $t("component.channelInfo.totalViews") }}
        <div class="my-3 h-px bg-white/10" />
      </div>
      <div style="white-space: pre-wrap" class="w-full flex-1">
        <strong>{{ $t("component.videoDescription.description") }}</strong>
        <br>
        <div v-linkified v-html="channel.description" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import linkify from "vue-linkify";
import { useChannelStore } from "@/stores/channel";
import { useSettingsStore } from "@/stores/settings";
import { useMetaTitle } from "@/composables/useMetaTitle";

const { t } = useI18n();
const channelStore = useChannelStore();
const settingsStore = useSettingsStore();

const vLinkified = linkify;

const channel = computed(() => channelStore.channel);
const channelName = computed(() => {
  const prop = settingsStore.nameProperty;
  return channel.value[prop] || channel.value.name;
});

useMetaTitle(() => `${channelName.value} - ${t("views.channel.about")} - Holodex`);
</script>

<style></style>
