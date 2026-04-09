<template>
  <section v-if="s" class="w-full">
    <UiCard class-name="grid gap-2 p-4">
      <article
        v-for="item in statCards"
        :key="item.label"
        class="rounded-xl border border-white/8 bg-white/4 px-3.5 py-3"
      >
        <div class="num text-3xl font-semibold leading-none tracking-tight tabular-nums text-white" :value="item.value">
          0
        </div>
        <div class="mt-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          {{ item.label }}
        </div>
        <div class="mt-1.5 min-h-[1.1rem] text-xs text-emerald-300">
          {{ item.delta }}
        </div>
      </article>
    </UiCard>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import UiCard from "@/components/ui/card/Card.vue";
import backendApi from "@/utils/backend-api";
import { waitForElement } from "@/utils/functions";

const metrics = ref<any>({});
const s = computed(() => metrics.value.statistics);
const statCards = computed(() => {
  if (!s.value) return [];
  return [
    { label: "VTubers", value: s.value.channelCount.vtuber || 0, delta: `+${s.value.monthlyChannels.vtuber || 0} last month` },
    { label: "Subbers", value: s.value.channelCount.subber || 0, delta: `+${s.value.monthlyChannels.subber || 0} last month` },
    { label: "Videos", value: s.value.totalVideos.count || 0, delta: `+${s.value.dailyVideos.count || 0} yesterday` },
    { label: "Songs", value: s.value.totalSongs.count || 0, delta: "\u00a0" },
  ];
});

onMounted(async () => {
  metrics.value = (await backendApi.stats()).data;
  waitForElement(".num").then(() => {
    const numbers = document.querySelectorAll(".num");
    numbers.forEach((el) => {
      const animate = () => {
        const value = +(el as HTMLElement).getAttribute("value")!;
        const currVal = +(el as HTMLElement).innerText;
        const time = value / 200;
        if (currVal < value) {
          (el as HTMLElement).innerText = String(Math.ceil(currVal + time));
          setTimeout(animate, 1);
        } else {
          (el as HTMLElement).innerText = String(value);
        }
      };
      animate();
    });
  });
});
</script>
