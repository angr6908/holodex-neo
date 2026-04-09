<template>
  <div
    role="none"
    :aria-orientation="orientation"
    :class="separatorClass"
  />
</template>

<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/utils/functions";

const props = withDefaults(defineProps<{
  orientation?: string;
  className?: string;
}>(), {
  orientation: "horizontal",
  className: "",
});

const separatorClass = computed(() =>
  cn(
    "shrink-0 bg-[color:var(--color-border)]",
    props.orientation === "vertical" ? "h-full w-px" : "h-px w-full",
    props.className,
  ),
);
</script>
