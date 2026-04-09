<template>
  <DropdownMenuPortal>
    <DropdownMenuContent
      :align="align"
      :side="side"
      :side-offset="sideOffset"
      :class="cn(
        'dropdown-menu-content z-[200] min-w-[10rem] rounded-xl border border-[color:var(--color-border)] p-1 shadow-xl outline-none',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
        'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )"
      :style="{ background: 'var(--surface-elevated)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }"
      v-bind="$attrs"
    >
      <slot />
    </DropdownMenuContent>
  </DropdownMenuPortal>
</template>

<script setup lang="ts">
import { DropdownMenuPortal, DropdownMenuContent } from "reka-ui";
import { cn } from "@/utils/functions";

defineOptions({ inheritAttrs: false });

withDefaults(defineProps<{
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  sideOffset?: number;
  className?: string;
}>(), {
  align: "start",
  side: "bottom",
  sideOffset: 6,
  className: "",
});
</script>
