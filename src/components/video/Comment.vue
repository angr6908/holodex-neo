<template>
  <div class="comment my-3 block">
    <truncated-text
      style="white-space: pre-wrap; word-break: break-word"
      class="text-sm text-slate-300"
      :html="processedMessage"
      lines="5"
    >
      <template #button="{ expanded }">
        <UiButton
          type="button"
          variant="ghost"
          size="sm"
        >
          {{ expanded ? $t("component.description.showLess") : $t("component.description.showMore") }}
        </UiButton>
      </template>
    </truncated-text>
    <a
      class="openOnYoutube"
      :href="`https://www.youtube.com/watch?v=${videoId}&lc=${comment.comment_key}`"
      target="_blank"
      rel="noopener noreferrer"
    >
      <UiIcon :icon="icons.mdiOpenInNew" size="sm" />
    </a>
    <!-- comment body -->
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import TruncatedText from "../common/TruncatedText.vue";
import { useSettingsStore } from "@/stores/settings";

const COMMENT_TIMESTAMP_REGEX = /(?:([0-5]?[0-9]):)?([0-5]?[0-9]):([0-5][0-9])/gm;

const props = defineProps<{
  comment: Record<string, any>;
  videoId: string;
}>();

const settingsStore = useSettingsStore();

const processedMessage = computed(() => {
  const decoder = document.createElement("div");
  decoder.innerHTML = props.comment.message;
  const sanitized = decoder.textContent;
  const vidUrl = (settingsStore.redirectMode ? "https://youtu.be/" : "/watch/") + props.videoId;
  return sanitized!.replace(COMMENT_TIMESTAMP_REGEX, (match, hr, min, sec) => {
    const time = Number(hr ?? 0) * 3600 + Number(min) * 60 + Number(sec);
    return `<a class="comment-chip" href="${vidUrl}?t=${time}" data-time="${time}"> ${match} </a>`;
  });
});
</script>

<style>
.comment-chip {
    /* background-color: rgba(231, 159, 245, 0.281); */
    line-height: initial;
    padding: 1px 1px;
    border-radius: 4px;
    display: inline-block;
    text-decoration: none;
    /* border: 1px solid; */
}
.comment-chip:hover {
    background-color: var(--color-primary);
    color: var(--color-primary-foreground);
}
.comment {
    border-left: 2px solid rgba(255, 255, 255, 0.5);
    min-height: 0px !important;
    padding: 0.25rem 1rem;
    position: relative;
}

.comment:hover .openOnYoutube {
    display: block;
}
.comment:focus .openOnYoutube {
    display: block;
}

.openOnYoutube {
    display: none;
    position: absolute;
    right: 0;
    top: 0;
}
</style>
