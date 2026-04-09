<template>
  <span :class="badgeClass">
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { cva } from "class-variance-authority";
import { cn } from "@/utils/functions";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.18em]",
  {
    variants: {
      variant: {
        default: "border-sky-600 bg-sky-500 text-white",
        secondary: "border-[color:var(--color-border)] bg-[color:var(--surface-soft)] text-[color:var(--color-foreground)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const props = defineProps<{
  variant?: string;
  className?: string;
}>();

const badgeClass = computed(() =>
  cn(badgeVariants({ variant: props.variant ?? "default" }), props.className ?? ""),
);
</script>
