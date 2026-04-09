<template>
  <DropdownMenuLabel
    :class="cn('px-3 py-1 text-[10px] font-medium uppercase tracking-widest text-[color:var(--color-muted-foreground)]', className)"
  >
    <slot />
  </DropdownMenuLabel>
</template>

<script setup lang="ts">
import { DropdownMenuLabel } from "reka-ui";
import { cn } from "@/utils/functions";

defineProps<{ className?: string }>();
</script>
