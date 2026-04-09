<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2 text-sm font-semibold text-white">
      {{ $t("views.multiview.presetEditor.title") }}
      <span class="text-xs font-normal text-slate-400">
        {{ $t("component.channelInfo.videoCount", [videoCells]) }}
      </span>
    </div>
    <div class="flex justify-center">
      <LayoutPreview :layout="layout" :content="content" />
    </div>
    <div class="flex items-center gap-2">
      <UiInput
        v-model="name"
        class="min-w-0 flex-1"
        :placeholder="$t('views.multiview.presetEditor.name')"
      />
      <UiButton
        size="icon"
        class-name="h-9 w-9 shrink-0 rounded-xl"
        :disabled="!canSave"
        :title="$t('views.multiview.presetEditor.title')"
        @click="addPresetLayout()"
      >
        <UiIcon :icon="mdiContentSave" size="sm" />
      </UiButton>
    </div>
    <label class="flex items-center gap-2 text-sm text-slate-200">
      <input v-model="autoLayout" type="checkbox" class="h-4 w-4 rounded border-white/20 bg-transparent">
      <span>{{ $t('views.multiview.presetEditor.autoLayout') }}</span>
    </label>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, getCurrentInstance } from "vue";
import { mdiContentSave } from "@mdi/js";
import { encodeLayout } from "@/utils/mv-utils";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";
import LayoutPreview from "./LayoutPreview.vue";
import { useMultiviewStore } from "@/stores/multiview";

defineOptions({ name: "PresetEditor" });

const props = defineProps<{
  layout: any[];
  content: Record<string, any>;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const multiviewStore = useMultiviewStore();
const instance = getCurrentInstance();

const name = ref("");
const autoLayout = ref(false);

const presetLayout = computed(() => multiviewStore.presetLayout);

const canSave = computed(() => {
  return (
    name.value.length > 0
    && !presetLayout.value.find((layout: any) => layout.name === name.value)
    && props.layout.length > 0
  );
});

const videoCells = computed(() => {
  return props.layout.filter((l: any) => !props.content[l.i] || props.content[l.i].type !== "chat").length;
});

function addPresetLayout() {
  const contentData = {
    layout: encodeLayout({
      layout: props.layout,
      contents: props.content,
    }),
    name: name.value,
  };
  instance?.proxy?.$gtag?.event("created-preset", {
    event_category: "multiview",
    event_label: `v${videoCells.value}c${
      props.layout.filter((l: any) => props.content[l.i]?.type === "chat").length
    }`,
  });
  multiviewStore.addPresetLayout(contentData);
  if (autoLayout.value) {
    multiviewStore.setAutoLayout({
      index: videoCells.value,
      encodedLayout: contentData.layout,
    });
  }
  emit("close");
}
</script>

<style></style>
