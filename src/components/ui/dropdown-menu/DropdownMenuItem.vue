<template>
  <DropdownMenuItem
    :disabled="disabled"
    :class="cn(
      'flex w-full cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-1.5 text-sm outline-none transition-colors',
      'text-[color:var(--color-foreground)]',
      'focus:bg-[color:var(--surface-soft)] data-[highlighted]:bg-[color:var(--surface-soft)]',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      inset && 'pl-8',
      className,
    )"
    v-bind="$attrs"
    @select="$emit('select', $event)"
  >
    <slot />
  </DropdownMenuItem>
</template>

<script setup lang="ts">
import { DropdownMenuItem } from "reka-ui";
import { cn } from "@/utils/functions";

defineOptions({ inheritAttrs: false });

defineProps<{
  disabled?: boolean;
  inset?: boolean;
  className?: string;
}>();

defineEmits<{ select: [e: Event] }>();
</script>
