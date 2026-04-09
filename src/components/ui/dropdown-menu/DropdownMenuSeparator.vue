<template>
  <DropdownMenuSeparator :class="cn('-mx-1 my-1 h-px bg-[color:var(--color-border)]', className)" />
</template>

<script setup lang="ts">
import { DropdownMenuSeparator } from "reka-ui";
import { cn } from "@/utils/functions";

defineProps<{ className?: string }>();
</script>
