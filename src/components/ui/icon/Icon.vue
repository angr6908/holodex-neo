<template>
  <svg
    v-if="isPathIcon"
    :class="iconClass"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path :d="icon" />
  </svg>
  <span
    v-else
    :class="iconClass"
    aria-hidden="true"
  >
    {{ icon }}
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/utils/functions";

const props = withDefaults(defineProps<{
  icon?: string;
  size?: string;
  className?: string;
}>(), {
  icon: "",
  size: "default",
  className: "",
});

const sizeMap: Record<string, string> = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  default: "h-5 w-5",
  lg: "h-6 w-6",
  xl: "h-7 w-7",
};

const isPathIcon = computed(() =>
  typeof props.icon === "string" && props.icon.startsWith("M"),
);

const iconClass = computed(() =>
  cn(
    "inline-flex shrink-0 items-center justify-center",
    sizeMap[props.size] || sizeMap.default,
    props.className,
  ),
);
</script>
