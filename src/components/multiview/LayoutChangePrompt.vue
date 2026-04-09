<template>
  <UiDialog
    :open="modelValue"
    class-name="max-w-[400px]"
    @update:open="$emit('update:modelValue', $event)"
  >
    <UiCard class-name="border-0 bg-transparent p-5 shadow-none">
      <div class="text-lg font-semibold text-white">
        {{ $t("views.multiview.confirmOverwrite") }}
      </div>

      <div class="mt-4 flex flex-col items-center justify-center gap-4 text-sm text-slate-200">
        <LayoutPreview :layout="layoutPreview.layout" :content="layoutPreview.content" />

        <label class="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left">
          <input
            v-model="overwriteMerge"
            type="checkbox"
            class="h-4 w-4 rounded border-white/15 bg-slate-950/80 text-sky-400"
          >
          <span>Fill empty cells with current videos</span>
        </label>
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <UiButton
          type="button"
          variant="secondary"
          @click="confirmFn(overwriteMerge)"
        >
          {{ $t("views.multiview.confirmOverwriteYes") }}
        </UiButton>
        <UiButton
          type="button"
          variant="ghost"
          @click="cancelFn(overwriteMerge)"
        >
          {{ $t("views.library.deleteConfirmationCancel") }}
        </UiButton>
      </div>
    </UiCard>
  </UiDialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import LayoutPreview from "@/components/multiview/LayoutPreview.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiDialog from "@/components/ui/dialog/Dialog.vue";

defineOptions({ name: "LayoutChangePrompt" });

const props = withDefaults(defineProps<{
  modelValue: boolean;
  confirmFn?: (overwriteMerge: boolean) => void;
  cancelFn?: (overwriteMerge: boolean) => void;
  defaultOverwrite?: boolean;
  layoutPreview?: { layout: any[]; content: Record<string, any> };
}>(), {
  confirmFn: () => () => {},
  cancelFn: () => () => {},
  defaultOverwrite: false,
  layoutPreview: () => ({ layout: [], content: {} }),
});

defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const overwriteMerge = ref(props.defaultOverwrite);

watch(() => props.defaultOverwrite, (value) => {
  overwriteMerge.value = value;
});

watch(() => props.modelValue, (open) => {
  if (open) overwriteMerge.value = props.defaultOverwrite;
});
</script>
