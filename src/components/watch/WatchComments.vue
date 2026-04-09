<template>
  <UiCard class-name="rounded-none p-0 shadow-none">
    <button
      type="button"
      class="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-white"
      @click="open = !open"
    >
      <span>{{ $t("component.watch.Comments.title") }} ({{ comments.length }})</span>
      <span class="text-slate-400">{{ open ? "−" : "+" }}</span>
    </button>

    <div v-if="open" class="border-t border-white/10 px-4 py-4">
      <div v-if="!hideBuckets" class="mb-3 flex flex-wrap gap-2">
        <UiButton
          v-for="b in buckets"
          :key="b.time"
          type="button"
          size="sm"
          :variant="currentFilter === b.time ? 'default' : 'ghost'"
          class-name="ts-btn"
          @click="currentFilter = b.time"
        >
          {{ b.display }} ({{ b.count }})
        </UiButton>
      </div>

      <div class="border-t border-white/10" />

      <div
        v-if="comments"
        class="caption mt-3"
        @click="handleClick"
      >
        <template v-for="comment in limitComment" :key="comment.comment_key">
          <Comment :comment="comment" :video-id="video.id" />
        </template>
      </div>

      <UiButton
        v-if="shouldLimit"
        type="button"
        variant="ghost"
        size="sm"
        class-name="mt-3"
        @click="expanded = !expanded"
      >
        {{ expanded ? $t("views.app.close_btn") : $t("component.description.showMore") }}
      </UiButton>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import Comment from "@/components/video/Comment.vue";
import { formatDuration } from "@/utils/time";

defineOptions({ name: "WatchComments" });

const COMMENT_TIMESTAMP_REGEX = /(?:([0-5]?[0-9]):)?([0-5]?[0-9]):([0-5][0-9])/gm;

const props = withDefaults(defineProps<{
  comments: any[];
  video: Record<string, any>;
  limit?: number;
  hideBuckets?: boolean;
  defaultExpanded?: boolean;
}>(), {
  limit: 3,
  hideBuckets: false,
  defaultExpanded: true,
});

const emit = defineEmits<{
  (e: "timeJump", time: string, a: boolean, b: boolean): void;
}>();

const { t } = useI18n();

const currentFilter = ref(-1);
const expanded = ref(false);
const open = ref(props.defaultExpanded);

const groupedComments = computed(() => {
  const { duration } = props.video;
  return props.comments.map((c: any) => {
    let match = COMMENT_TIMESTAMP_REGEX.exec(c.message);
    const times = new Set<number>();
    while (match !== null) {
      const hr = match[1];
      const min = match[2];
      const sec = match[3];
      const time = Number(hr ?? 0) * 3600 + Number(min) * 60 + Number(sec);
      if (time < duration) { times.add(time); }
      match = COMMENT_TIMESTAMP_REGEX.exec(c.message);
    }
    return { ...c, times: Array.from(times) };
  });
});

const filteredComments = computed(() => {
  if (currentFilter.value < 0) {
    return [...groupedComments.value].sort((a: any, b: any) => b.times.length - a.times.length);
  }
  return props.comments
    .filter((c: any) => c.times.find((t: number) => Math.abs(currentFilter.value - t) <= 10))
    .sort((a: any, b: any) => a.times.length - b.times.length);
});

const shouldLimit = computed(() => props.limit && filteredComments.value.length > props.limit);

const limitComment = computed(() =>
  shouldLimit.value && !expanded.value
    ? filteredComments.value.slice(0).splice(0, props.limit)
    : filteredComments.value,
);

const buckets = computed(() => {
  const arr: number[] = [];
  groupedComments.value.forEach((c: any) => {
    arr.push(...c.times);
  });
  arr.sort((a, b) => a - b);

  const result: any[] = [];
  result.push({
    time: -1,
    count: props.comments.length,
    display: `${t("component.watch.Comments.all")}`,
  });

  let currentBucket = 0;
  let subBucket: number[] = [];
  arr.forEach((time, index) => {
    if (time - currentBucket <= 10 && index !== arr.length - 1) {
      subBucket.push(time);
      return;
    }
    if (time - currentBucket <= 10) {
      subBucket.push(time);
    }
    if (subBucket.length > 1) {
      const median = subBucket[Math.floor(subBucket.length / 2)];
      result.push({
        time: median,
        count: subBucket.length,
        display: formatDuration(median * 1000),
      });
    }
    currentBucket = time;
    subBucket = [];
    subBucket.push(time);
  });
  return result.sort((a, b) => b.count - a.count);
});

function handleClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.matches(".comment-chip")) {
    emit("timeJump", target.getAttribute("data-time")!, true, true);
    e.preventDefault();
  }
}
</script>

<style scoped>
.ts-btn {
  font-size: 11px;
}
</style>
