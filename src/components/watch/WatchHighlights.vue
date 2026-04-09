<template>
  <UiCard class-name="rounded-none border-x-0 border-t-0 px-3 py-2 shadow-none">
    <div v-if="bucketsFiltered.length > 0" class="highlight-container">
      <div class="highlight-bar">
        <template v-for="b in bucketsFiltered" :key="b.display">
          <div
            class="highlight-item"
            :style="computeItemStyle(b.time)"
            :title="b.best ? `${b.display} ${b.best}` : b.display"
            @click.prevent="jump(b.time)"
          >
            <div class="highlight-chip" :style="computeTipStyle(b)" />
          </div>
        </template>
      </div>
    </div>
  </UiCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatDuration } from "@/utils/time";
import UiCard from "@/components/ui/card/Card.vue";

defineOptions({ name: "WatchHighlights" });

interface ParsedComment {
  time: number;
  occurence: number;
  text?: string;
  song?: any;
}

const COMMENT_TIMESTAMP_REGEX = /(?:([0-5]?[0-9]):)?([0-5]?[0-9]):([0-5][0-9])([^\r\n]+)?/gm;

const STOP_WORDS = new Set(["an", "the"]);

function removeStopWords(words: string) {
  return words
    .split(" ")
    .filter((s) => !STOP_WORDS.has(s.toLowerCase()))
    .join(" ");
}

function removePunctuations(input: string) {
  return input.replace(/[*,\-.\][()、。]/g, "");
}

function filterByWordCount(limit = 2) {
  return (input: string) => input.split(" ").length >= limit;
}

function parseTimestampComments(
  message: string,
  videoDuration: number,
): ParsedComment[] {
  const pairs: any[] = [];
  let match = COMMENT_TIMESTAMP_REGEX.exec(message);
  while (match !== null) {
    const hr = match[1];
    const min = match[2];
    const sec = match[3];
    const time = Number(hr ?? 0) * 3600 + Number(min) * 60 + Number(sec);

    const text = match[4];

    if (time < videoDuration) {
      pairs.push({ time, text });
    }

    match = COMMENT_TIMESTAMP_REGEX.exec(message);
  }
  for (const pair of pairs) pair.occurence = pairs.length;
  return pairs;
}

const props = withDefaults(defineProps<{
  comments: any[];
  video: Record<string, any>;
  limit?: number;
}>(), {
  limit: 0,
});

const emit = defineEmits<{
  (e: "timeJump", time: number, a: boolean, b: boolean): void;
}>();

const buckets = computed(() => {
  const TIME_THRESHOLD = 40;
  const MIN_TIMESTAMP_OCCURENCE = 1;
  const VIDEO_START_TIMESTAMP = +new Date(
    props.video.start_actual || props.video.available_at,
  );

  const parsed: ParsedComment[] = [];
  for (const comment of props.comments) {
    const pairs = parseTimestampComments(
      comment.message,
      props.video.duration,
    ).filter((pair) => pair.text);

    if (pairs.length >= MIN_TIMESTAMP_OCCURENCE) {
      parsed.push(...pairs);
    }
  }

  parsed.sort((a, b) => a.time - b.time);

  const result: any[] = [];
  let subBucket: ParsedComment[] = [];

  parsed.forEach((comment, index) => {
    subBucket.push(comment);
    if (
      index !== parsed.length - 1
      && parsed[index + 1].time - comment.time <= TIME_THRESHOLD
    ) {
      return;
    }
    const th = Math.floor(subBucket.length / 3);
    const median = subBucket[th].time;
    const matchingSong = props.video?.songs?.find(
      (song: any) => Math.abs(song.start - median) <= TIME_THRESHOLD,
    );
    if (!matchingSong) {
      const processed = subBucket
        .sort(
          (a, b) => b.occurence / b.text!.length - a.occurence / a.text!.length,
        )
        .map((s) => s.text!)
        .map(removePunctuations)
        .map(removeStopWords)
        .map((c) => c.trim())
        .filter((c) => c.length > 1);

      if (processed.length > 0) {
        let best = processed[0];

        const stricter = processed
          .filter(filterByWordCount(2))
          .filter((c) => !/(?:clip\s?(?:it|this)|[!?]{3})/i.test(c));
        if (stricter.length > 0) [best] = stricter;

        if (best.length > 60) best = `${best.slice(0, 60)}...`;

        const medianMS = median * 1000;
        const absolute = new Date(
          VIDEO_START_TIMESTAMP + medianMS,
        ).toISOString();
        result.push({
          time: median,
          count: subBucket.length,
          best,
          display: formatDuration(medianMS),
          absolute,
        });
      }
    }
    subBucket = [];
  });

  result.push(
    ...(props.video.songs?.map((song: any) => ({
      time: song.start,
      count: 1,
      song: {
        ...song,
        channel: props.video.channel,
      },
      display: formatDuration(song.start * 1000),
    })) || []),
  );
  return result;
});

const bucketsFiltered = computed(() => {
  if (props.limit) {
    const arr = [...buckets.value];
    let cnt = 0;
    return arr.filter((b) => {
      if (b.song) return true;
      if (cnt < props.limit) {
        cnt += 1;
        return true;
      }
      return false;
    });
  }
  return buckets.value;
});

function computeItemStyle(ts: number) {
  return {
    marginLeft: `${Math.round((ts / props.video.duration) * 100)}%`,
  };
}

function computeTipStyle(bucket: any) {
  const { count } = bucket;
  let width = "1px";
  let color = "rgb(100, 100, 100)";
  if (bucket.song) {
    width = "3px";
    color = "var(--color-primary)";
  }
  if (count > 1) {
    width = "2px";
    color = "rgb(164, 164, 164)";
  }
  if (count > 2) color = "darkorange";
  if (count > 3) color = "orange";
  if (count > 4) color = "#d05b5b";
  if (count > 5) color = "red";
  return {
    width,
    backgroundColor: color,
  };
}

function jump(time: number) {
  emit("timeJump", time, true, true);
}
</script>

<style scoped>
.highlight-container {
  width: 100%;
}

.highlight-bar {
  position: relative;
  height: 16px;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.06);
}

.highlight-item {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 0;
  cursor: pointer;
}

.highlight-chip {
  height: 100%;
  border-radius: 999px;
}
</style>
