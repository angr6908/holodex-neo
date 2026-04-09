<template>
  <input
    v-bind="$attrs"
    :value="inputValue"
    :class="inputClass"
    @input="handleInput"
  >
</template>

<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/utils/functions";

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
  modelValue?: string | number;
  value?: string | number;
  className?: string;
}>(), {
  modelValue: undefined,
  value: undefined,
  className: "",
});

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "input", value: string): void;
}>();

const inputValue = computed(() => props.modelValue ?? props.value ?? "");

const inputClass = computed(() =>
  cn(
    "ui-input-base flex h-10 w-full rounded-xl border px-3 py-2 text-sm text-[color:var(--color-foreground)] placeholder:text-[color:var(--color-muted-foreground)] outline-none",
    props.className,
  ),
);

function handleInput(event: Event) {
  const value = (event?.target as HTMLInputElement)?.value ?? "";
  emit("update:modelValue", value);
  emit("input", value);
}
</script>

<style scoped>
.ui-input-base {
  border-color: var(--color-light);
  background: var(--color-card);
  transition: border-color 160ms ease, background-color 160ms ease, box-shadow 160ms ease;
}

.ui-input-base:focus,
.ui-input-base:focus-visible {
  border-color: var(--color-bold);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-bold) 28%, transparent);
}
</style>
