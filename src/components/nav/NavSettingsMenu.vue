<template>
  <UiPopover v-model:open="menuOpen">
    <UiPopoverTrigger as-child>
      <UiButton
        type="button"
        variant="ghost"
        size="icon"
        class-name="menu-action-btn"
        :title="$t('component.mainNav.settings')"
      >
        <UiIcon :icon="mdiCog" class-name="menu-theme-icon h-5 w-5" />
        <span class="sr-only">{{ $t("component.mainNav.settings") }}</span>
      </UiButton>
    </UiPopoverTrigger>

    <UiPopoverContent align="end" class-name="w-[26rem] max-h-[min(80vh,700px)] flex flex-col p-0">
      <div class="flex items-center border-b border-[color:var(--color-border)] px-3 py-2">
        <div class="inline-flex items-center gap-1 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-0.5">
          <button
            v-for="t in tabs"
            :key="t.key"
            type="button"
            class="cursor-pointer rounded-lg px-3 py-1.5 text-[0.8rem] font-medium transition"
            :class="tab === t.key ? 'bg-[color:var(--color-bold)] text-white' : 'text-[color:var(--color-muted-foreground)] hover:text-[color:var(--color-foreground)]'"
            @click="tab = t.key"
          >
            {{ t.label }}
          </button>
        </div>
      </div>

      <Settings v-if="tab === 'settings'" />
      <UiScrollArea v-else class-name="min-h-0 flex-1">
        <AboutSection />
      </UiScrollArea>
    </UiPopoverContent>
  </UiPopover>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import { mdiCog } from "@mdi/js";
import Settings from "@/views/Settings.vue";
import AboutSection from "@/components/setting/AboutSection.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiPopover from "@/components/ui/popover/Popover.vue";
import UiPopoverTrigger from "@/components/ui/popover/PopoverTrigger.vue";
import UiPopoverContent from "@/components/ui/popover/PopoverContent.vue";
import UiScrollArea from "@/components/ui/scroll-area/ScrollArea.vue";

const { t } = useI18n();

const menuOpen = ref(false);
const tab = ref<"settings" | "about">("settings");

const tabs = computed(() => [
  { key: "settings" as const, label: t("component.mainNav.settings") },
  { key: "about" as const, label: t("component.mainNav.about") },
]);
</script>
