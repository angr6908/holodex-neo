<template>
  <div class="min-w-0 flex-1">
    <div style="align-self: flex-start">
      <router-link :to="`/channel/${channel.id}`" class="no-decoration text-truncate">
        <UiButton
          v-if="channel.inactive"
          variant="ghost"
          size="icon"
          class-name="plain-button h-[18px] w-[18px]"
          :title="t('component.channelInfo.inactiveChannel')"
        >
          <UiIcon :icon="icons.mdiSchool" size="sm" class-name="h-5 w-5" />
        </UiButton>
        {{ channelName }}
      </router-link> <br>
      <template v-if="channel.yt_handle">
        <a :href="`https://youtube.com/${channel.yt_handle[0]}`" target="__blank" class="no-decoration text--org">
          {{ channel.yt_handle[0] }} •
        </a>
      </template>
      <span v-show="channel.org">
        <router-link :to="`/channels?${channelOrg}`" class="no-decoration text--org">
          {{ channel.org + ((!noGroup && group) ? " / " + group : '') }}
        </router-link>
      </span>
    </div>
    <div class="text-sm text-[color:var(--color-muted-foreground)]">
      <span
        v-if="!noSubscriberCount"
        class="subscriber-count"
      >
        {{ subscriberCount }}
      </span>
      <template v-if="includeVideoCount">
        •
        {{ t("component.channelInfo.videoCount", [channel.video_count]) }}
        <router-link v-if="channel.clip_count > 0" :to="`/channel/${channel.id}/clips`" class="no-decoration">
          •
          <span class="text-[color:var(--color-primary)]">{{ t("component.channelInfo.clipCount", channel.clip_count) }}</span>
        </router-link>
      </template>
    </div>
    <div v-if="channel.top_topics && channel.top_topics.length" class="text-sm text-[color:var(--color-muted-foreground)]">
      🏆
      <a
        v-for="topic in channel.top_topics"
        :key="topic"
        class="topic-chip"
        @click.exact.stop.prevent="searchTopic(topic)"
      >
        {{ topic }}
      </a>
    </div>
    <div v-if="includeSocials" class="text-sm text-[color:var(--color-muted-foreground)]">
      <ChannelSocials :channel="channel" />
    </div>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { formatCount } from "@/utils/functions";
import { json2csvAsync } from "json-2-csv";
import * as icons from "@/utils/icons";
import { useSettingsStore } from "@/stores/settings";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";

const ChannelSocials = defineAsyncComponent(() => import("./ChannelSocials.vue"));

const props = withDefaults(defineProps<{
  channel: Record<string, any>;
  includeSocials?: boolean;
  includeVideoCount?: boolean;
  noSubscriberCount?: boolean;
  noGroup?: boolean;
}>(), {
  includeSocials: false,
  includeVideoCount: false,
  noSubscriberCount: false,
  noGroup: false,
});

const router = useRouter();
const { t } = useI18n();
const settingsStore = useSettingsStore();

const subscriberCount = computed(() => {
  if (props.channel.subscriber_count) {
    return t(
      "component.channelInfo.subscriberCount",
      { n: formatCount(props.channel.subscriber_count, settingsStore.lang) },
    );
  }
  return t("component.channelInfo.subscriberNA");
});

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

const channelOrg = computed(() => new URLSearchParams({ org: props.channel.org }).toString());

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
.topic-chip {
    background-color: var(--surface-soft);
    border: 1px solid var(--color-border);
    padding: 2px 6px;
    border-radius: 1rem;
    text-decoration: none;
    text-transform: capitalize;
    margin-right: 4px;
    align-items: center;
    display: inline-flex;
    color: var(--color-foreground);
}
.topic-chip:hover {
    background-color: var(--color-primary);
    color: var(--color-primary-foreground);
}
.text--org {
  font-size:12px;
  font-weight: 300;
  /* display:block; */
  /* display: block; */
  opacity: 0.7;
  color: var(--color-muted-foreground);
}
.text--org:hover {
  opacity: 1.0;
}
</style>
