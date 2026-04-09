<template>
  <div ref="elRef" class="social-card">
    <div v-if="showHeader" class="space-y-1">
      <div class="social-kicker">
        Holodex
      </div>
      <h3 class="text-lg font-semibold text-[color:var(--color-foreground)]">
        About
      </h3>
    </div>

    <div v-if="s" class="social-stats-grid">
      <article
        v-for="item in statCards"
        :key="item.label"
        class="social-stat-card"
      >
        <div class="social-stat-value" :value="item.value">
          0
        </div>
        <div class="social-stat-label">
          {{ item.label }}
        </div>
        <div class="social-stat-delta">
          {{ item.delta }}
        </div>
      </article>
    </div>

    <div class="social-grid social-grid-top">
      <a
        v-for="item in topLinks"
        :key="item.title"
        :href="item.href"
        target="_blank"
        rel="noopener noreferrer"
        class="social-link"
      >
        <div class="social-link-top">
          <div class="social-icon" :style="item.iconStyle">
            <UiIcon :icon="item.icon" size="sm" />
          </div>
          <div class="min-w-0">
            <div class="social-link-title">
              {{ item.title }}
            </div>
            <div class="social-link-label">
              {{ item.label }}
            </div>
          </div>
        </div>
      </a>
    </div>

    <div class="social-bottom-layout">
      <div v-if="bottomLinks.length" class="social-grid social-grid-bottom">
        <a
          v-for="item in bottomLinks"
          :key="item.title"
          :href="item.href"
          target="_blank"
          rel="noopener noreferrer"
          class="social-link"
        >
          <div class="social-link-top">
            <div class="social-icon" :style="item.iconStyle">
              <UiIcon :icon="item.icon" size="sm" />
            </div>
            <div class="min-w-0">
              <div class="social-link-title">
                {{ item.title }}
              </div>
              <div class="social-link-label">
                {{ item.label }}
              </div>
            </div>
          </div>
        </a>
      </div>

      <a
        class="social-link social-bookmark-link"
        href="javascript:(function(){var v=new%20URLSearchParams(window.location.search).get('v');v&&(window.location.href='https://holodex.net/watch/'+v)})()"
      >
        <div class="social-link-top social-bookmark-main">
          <div class="social-icon social-bookmark-icon">
            <UiIcon :icon="mdiBookmarkOutline" size="sm" />
          </div>
          <div class="social-bookmark-copy">
            <div class="social-link-title">
              Bookmarklet
            </div>
            <div class="social-link-label">
              <span class="social-bookmark-label-inline">
                Open
                <span class="social-bookmark-youtube-logo" aria-hidden="true">
                  <span class="social-bookmark-youtube-play" />
                </span>
                in Holodex via bookmark bar
              </span>
            </div>
          </div>
        </div>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { mdiBookmarkOutline, mdiGithub, mdiOpenInNew, mdiPuzzleOutline, mdiTwitter } from "@mdi/js";
import { mdiDiscord } from "@/utils/icons";
import UiIcon from "@/components/ui/icon/Icon.vue";
import backendApi from "@/utils/backend-api";

withDefaults(defineProps<{ showHeader?: boolean }>(), { showHeader: true });

const metrics = ref<any>(null);
const s = computed(() => metrics.value?.statistics ?? null);

const statCards = computed(() => {
  if (!s.value) return [];
  return [
    { label: "VTubers", value: s.value.channelCount.vtuber || 0, delta: `+${s.value.monthlyChannels.vtuber || 0} last month` },
    { label: "Subbers", value: s.value.channelCount.subber || 0, delta: `+${s.value.monthlyChannels.subber || 0} last month` },
    { label: "Videos", value: s.value.totalVideos.count || 0, delta: `+${s.value.dailyVideos.count || 0} yesterday` },
    { label: "Songs", value: s.value.totalSongs.count || 0, delta: "\u00a0" },
  ];
});

const links = [
  { title: "X", label: "@holodex", bucket: "top", href: "https://x.com/holodex", icon: mdiTwitter, iconStyle: { background: "color-mix(in srgb, #0ea5e9 72%, #020617 28%)", color: "#f8fafc" } },
  { title: "Discord", label: "Community", bucket: "top", href: "https://discord.gg/jctkgHBt4b", icon: mdiDiscord, iconStyle: { background: "color-mix(in srgb, #6366f1 78%, #0f172a 22%)", color: "#f8fafc" } },
  { title: "GitHub", label: "Repository", bucket: "top", href: "https://github.com/RiceCakess/Holodex", icon: mdiGithub, iconStyle: { background: "#111827", color: "#f8fafc" } },
  { title: "Docs", label: "HoloAPI V2", bucket: "top", href: "https://docs.holodex.net/", icon: mdiOpenInNew, iconStyle: { background: "color-mix(in srgb, #f59e0b 74%, #0f172a 26%)", color: "#f8fafc" } },
  { title: "Extension", label: "Browser add-on", bucket: "bottom", href: "https://holodex.net/extension", icon: mdiPuzzleOutline, iconStyle: { background: "color-mix(in srgb, #10b981 74%, #0f172a 26%)", color: "#f8fafc" } },
];
const topLinks = links.filter((l) => l.bucket === "top");
const bottomLinks = links.filter((l) => l.bucket === "bottom");

const elRef = ref<HTMLElement | null>(null);

function animateStats() {
  const numbers = elRef.value?.querySelectorAll(".social-stat-value") ?? [];
  numbers.forEach((el) => {
    const animate = () => {
      const value = +(el as HTMLElement).getAttribute("value")!;
      const currVal = +(el as HTMLElement).innerText;
      const time = Math.max(value / 200, 1);
      if (currVal < value) {
        (el as HTMLElement).innerText = `${Math.ceil(currVal + time)}`;
        window.setTimeout(animate, 1);
      } else {
        (el as HTMLElement).innerText = `${value}`;
      }
    };
    animate();
  });
}

onMounted(async () => {
  metrics.value = (await backendApi.stats()).data;
  await nextTick();
  animateStats();
});
</script>

<style scoped>
.social-card {
  display: grid;
  gap: 1rem;
  min-height: 100%;
  padding: 1.25rem;
  background: var(--color-base);
}

.social-stats-grid {
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  min-width: 0;
  align-items: stretch;
}

.social-stat-card {
  border-radius: 1rem;
  border: 1px solid var(--color-light);
  background: var(--color-card);
  padding: 0.8rem;
  min-width: 0;
  height: 100%;
}

.social-stat-value {
  color: var(--color-foreground);
  font-size: clamp(1.05rem, 2.6vw, 1.5rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
}

.social-stat-label {
  margin-top: 0.3rem;
  color: var(--color-muted-foreground);
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.social-stat-delta {
  margin-top: 0.22rem;
  color: #34d399;
  font-size: 0.72rem;
}

.social-kicker {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--surface-soft) 88%, transparent);
  padding: 0.35rem 0.6rem;
  color: var(--color-muted-foreground);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.social-grid {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
}

.social-grid-top {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: stretch;
}

.social-grid-bottom {
  grid-template-columns: minmax(0, 1fr);
  height: 100%;
}

.social-bottom-layout {
  display: grid;
  gap: 0.75rem;
  align-items: stretch;
  min-width: 0;
}

.social-link {
  display: grid;
  gap: 0.65rem;
  border-radius: 1rem;
  border: 1px solid var(--color-light);
  background: var(--color-card);
  padding: 0.8rem;
  color: inherit;
  text-decoration: none;
  transition: border-color 160ms ease;
  min-width: 0;
}

.social-link:hover,
.social-link:focus-visible {
  border-color: var(--color-bold) !important;
}

.social-link-top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
}

.social-link-top .min-w-0 {
  overflow: hidden;
}

.social-icon {
  display: inline-flex;
  height: 1.75rem;
  width: 1.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 0.6rem;
  flex-shrink: 0;
}

.social-link-title {
  color: var(--color-foreground);
  font-size: 0.92rem;
  font-weight: 600;
}

.social-link-label {
  color: var(--color-muted-foreground);
  font-size: 0.78rem;
}

.social-bookmark-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  height: 100%;
}

.social-bookmark-main {
  min-width: 0;
}

.social-bookmark-icon {
  background: color-mix(in srgb, #22c55e 72%, #0f172a 28%);
  color: #f8fafc;
}

.social-bookmark-copy {
  min-width: 0;
}

.social-bookmark-label-inline {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.social-bookmark-youtube-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 0.95rem;
  height: 0.64rem;
  border-radius: 0.22rem;
  background: #ff0033;
  flex-shrink: 0;
}

.social-bookmark-youtube-play {
  width: 0;
  height: 0;
  border-top: 0.15rem solid transparent;
  border-bottom: 0.15rem solid transparent;
  border-left: 0.23rem solid #fff;
  margin-left: 0.02rem;
}

.social-grid-bottom .social-link {
  height: 100%;
}

.social-grid-top .social-link {
  height: 100%;
}

@media (min-width: 1100px) {
  .social-bottom-layout {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: stretch;
  }
}
</style>
