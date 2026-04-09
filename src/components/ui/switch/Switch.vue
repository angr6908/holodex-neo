<template>
  <label :class="wrapperClass">
    <input
      v-bind="$attrs"
      :checked="checkedValue"
      :disabled="disabled"
      type="checkbox"
      class="peer sr-only"
      @change="handleChange"
    >
    <span :class="trackClass" />
    <span :class="thumbClass" />
  </label>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/utils/functions";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
  modelValue?: boolean;
  checked?: boolean;
  disabled?: boolean;
  className?: string;
}>(), {
  modelValue: undefined,
  checked: undefined,
  disabled: false,
  className: "",
});

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "input", value: boolean): void;
  (e: "change", value: boolean): void;
}>();

const checkedValue = computed(() => props.modelValue ?? props.checked ?? false);

const wrapperClass = computed(() =>
  cn("relative inline-flex h-6 w-11 shrink-0 items-center", props.className),
);

const trackClass = "inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-transparent bg-[color:var(--color-input)] transition-colors duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-[color:var(--color-ring)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-transparent peer-checked:bg-[color:var(--color-primary)] peer-disabled:cursor-not-allowed peer-disabled:opacity-50";

const thumbClass = "pointer-events-none absolute left-[2px] top-[2px] h-5 w-5 rounded-full bg-[color:var(--color-primary-foreground)] shadow-[0_2px_10px_rgba(15,23,42,0.22)] transition-transform duration-150 peer-checked:translate-x-5 peer-disabled:opacity-80";

function handleChange(event: Event) {
  const value = Boolean((event?.target as HTMLInputElement)?.checked);
  emit("update:modelValue", value);
  emit("input", value);
  emit("change", value);
}
</script>
