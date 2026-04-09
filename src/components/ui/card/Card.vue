<template>
  <div :class="cardClass">
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/utils/functions";

const props = defineProps<{
  className?: string;
}>();

const cardClass = computed(() =>
  cn(
    "glass-panel rounded-[calc(var(--radius)+6px)]",
    props.className ?? "",
  ),
);
</script>
