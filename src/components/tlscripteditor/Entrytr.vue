<template>
  <tr>
    <td style="white-space: nowrap">
      {{ timeStampStart }}
    </td>
    <td style="white-space: nowrap">
      {{ timeStampEnd }}
    </td>
    <td>{{ profileName }}</td>
    <td class="EntryContainer" :style="textStyle" colspan="2">
      <span style="word-wrap:break-word">
        {{ stext }}
      </span>
    </td>
  </tr>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { dayjs } from "@/utils/time";

const props = withDefaults(defineProps<{
  time?: number;
  duration?: number;
  profileName?: string;
  stext?: string;
  cc?: string;
  oc?: string;
  realTime?: number;
  useRealTime?: boolean;
}>(), { time: 0, duration: 0, profileName: "", stext: "", cc: "", oc: "", realTime: 0, useRealTime: false });

function formatTs(raw: number): string {
  let timeRaw = raw;
  let s = "";
  const hh = Math.floor(timeRaw / 3600000); timeRaw -= hh * 3600000;
  s += (hh < 10 ? "0" : "") + hh + ":";
  const mm = Math.floor(timeRaw / 60000); timeRaw -= mm * 60000;
  s += (mm < 10 ? "0" : "") + mm + ":";
  const ss = Math.floor(timeRaw / 1000); timeRaw -= ss * 1000;
  s += (ss < 10 ? "0" : "") + ss + ".";
  s += timeRaw > 100 ? String(timeRaw).slice(0, 2) : timeRaw > 10 ? "0" + String(timeRaw).slice(0, 1) : "00";
  return s;
}

const timeStampStart = computed(() =>
  props.useRealTime
    ? dayjs(Number.parseFloat(String(props.realTime))).format("h:mm:ss.SSS A")
    : formatTs(props.time),
);
const timeStampEnd = computed(() =>
  props.useRealTime
    ? dayjs(Number.parseFloat(String(props.realTime)) + props.duration).format("h:mm:ss.SSS A")
    : formatTs(props.time + props.duration),
);
const textStyle = computed(() => ({
  "-webkit-text-fill-color": props.cc === "" ? "unset" : props.cc,
  "-webkit-text-stroke-color": props.oc === "" ? "unset" : props.oc,
  "-webkit-text-stroke-width": props.oc === "" ? "0px" : "1px",
}));
</script>

<style>
.EntryContainer {
    font-weight: bold;
}
</style>
