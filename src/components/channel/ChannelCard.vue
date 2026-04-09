<template>
  <router-link
    v-if="channel"
    :to="`/channel/${channel.id}`"
    class="channel-card no-decoration block"
  >
    <div class="channel-card-shell w-full overflow-hidden border border-[color:var(--color-border)]">
      <!-- Top section: avatar centered + name + org -->
      <div class="flex flex-col items-center gap-1.5 px-3 pt-4 pb-2.5">
        <ChannelImg :channel="channel" size="52" rounded no-link />
        <div class="w-full min-w-0 text-center">
          <div class="truncate text-sm font-semibold leading-tight text-[color:var(--color-foreground)]">
            <UiIcon
              v-if="channel.inactive"
              :icon="icons.mdiSchool"
              class-name="mr-0.5 inline-block h-3.5 w-3.5 align-[-2px] text-[color:var(--color-muted-foreground)]"
            />
            {{ channelName }}
          </div>
          <div v-if="channel.org" class="mt-0.5 truncate text-xs leading-tight text-[color:var(--color-muted-foreground)]">
            {{ channel.org }}{{ group ? ' / ' + group : '' }}
          </div>
          <div v-if="channel.yt_handle" class="mt-0.5 truncate text-[11px] leading-tight text-[color:var(--color-muted-foreground)] opacity-70">
            {{ channel.yt_handle[0] }}
          </div>
        </div>
      </div>

      <UiSeparator />

      <!-- Stats row -->
      <div class="channel-card-stats flex items-center justify-center gap-3 px-2 py-2 text-xs leading-none text-[color:var(--color-muted-foreground)]">
        <span v-if="subscriberCount" class="whitespace-nowrap">
          {{ subscriberCount }}
        </span>
        <span v-if="channel.video_count" class="whitespace-nowrap">
          {{ t('component.channelInfo.videoCount', [formatCount(channel.video_count, lang)]) }}
        </span>
        <router-link
          v-if="channel.clip_count > 0"
          :to="`/channel/${channel.id}/clips`"
          class="whitespace-nowrap text-[color:var(--color-primary)] no-underline hover:underline"
          @click.stop
        >
          {{ t('component.channelInfo.clipCount', { n: channel.clip_count }) }}
        </router-link>
      </div>

      <!-- Topics row -->
      <div v-if="channel.top_topics && channel.top_topics.length" class="flex flex-wrap items-center justify-center gap-1 px-2 pb-2">
        <UiBadge
          v-for="topic in channel.top_topics.slice(0, 3)"
          :key="topic"
          variant="secondary"
          class-name="channel-topic-badge cursor-pointer px-1.5 py-0.5 text-[11px] capitalize leading-tight tracking-normal"
          @click.stop.prevent="searchTopic(topic)"
        >
          {{ topic }}
        </UiBadge>
      </div>

      <UiSeparator />

      <!-- Social icons footer -->
      <div class="channel-card-footer flex items-center justify-center px-1 py-1">
        <ChannelSocials :channel="channel" class="justify-center p-0" />
      </div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { json2csvAsync } from "json-2-csv";
import * as icons from "@/utils/icons";
import { formatCount } from "@/utils/functions";
import { useSettingsStore } from "@/stores/settings";
import ChannelImg from "./ChannelImg.vue";
import ChannelSocials from "./ChannelSocials.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiBadge from "@/components/ui/badge/Badge.vue";
import UiSeparator from "@/components/ui/separator/Separator.vue";

const props = defineProps<{
  channel: Record<string, any>;
  withLink?: boolean;
}>();

const router = useRouter();
const { t } = useI18n();
const settingsStore = useSettingsStore();
const lang = computed(() => settingsStore.lang);

const channelName = computed(() => {
  const prop = settingsStore.nameProperty;
  if (props.channel[prop]) return props.channel[prop];
  return props.channel.name;
});

const group = computed(() => {
  if (props.channel.group) return props.channel.group;
  if (props.channel.suborg) return props.channel.suborg.slice(2);
  return null;
});

const subscriberCount = computed(() => {
  if (props.channel.subscriber_count) {
    return t(
      "component.channelInfo.subscriberCount",
      { n: formatCount(props.channel.subscriber_count, lang.value) },
    );
  }
  return "";
});

async function searchTopic(topicId: string) {
  const query = [
    { type: "channel", value: props.channel.id, text: props.channel.name },
    { type: "topic", value: topicId, text: topicId },
  ];
  router.push({
    path: "/search",
    query: {
      q: await json2csvAsync(query),
    },
  });
}
</script>

<style scoped>
.channel-card {
  display: block;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.24s cubic-bezier(0.16, 1, 0.3, 1);
}

.channel-card:hover {
  transform: translateY(-4px);
}

.channel-card-shell {
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  backface-visibility: hidden;
  border-radius: 1rem;
  display: flex;
  width: 100%;
  min-width: 0;
  flex-direction: column;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-card) 92%, white 8%) 0%, var(--color-card) 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.04);
  filter: drop-shadow(0 12px 28px rgb(2 6 23 / 0.13));
  transition:
    filter 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.24s cubic-bezier(0.16, 1, 0.3, 1),
    border-color 0.24s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}

.channel-card:hover .channel-card-shell {
  border-color: color-mix(in srgb, var(--color-primary) 28%, var(--color-border) 72%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.06);
  filter: drop-shadow(0 22px 44px rgb(2 6 23 / 0.2));
}

/* Stats row: don't let it shrink/crop */
.channel-card-stats {
  flex-shrink: 0;
}

/* Compact social icons for card footer */
.channel-card-footer :deep(.channel-social-horizontal) {
  padding: 0 !important;
  margin: 0 !important;
  gap: 0.15rem;
}

.channel-card-footer :deep(.channel-social-horizontal button),
.channel-card-footer :deep(.channel-social-horizontal a) {
  height: 1.75rem;
  width: 1.75rem;
}

/* Topic badges hover */
.channel-topic-badge:hover {
  background-color: var(--color-primary) !important;
  color: var(--color-primary-foreground) !important;
}

/* Light theme */
:global(html[data-theme="light"] .channel-card-shell) {
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-card) 94%, white 6%) 0%, var(--color-card) 100%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.7);
  filter: drop-shadow(0 12px 28px rgb(148 163 184 / 0.15));
}

:global(html[data-theme="light"] .channel-card:hover .channel-card-shell) {
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.82);
  filter: drop-shadow(0 22px 42px rgb(148 163 184 / 0.22));
}

@media (prefers-reduced-motion: reduce) {
  .channel-card,
  .channel-card-shell {
    transition: none !important;
  }
}
</style>
