<template>
  <DropdownMenuTrigger v-bind="forwarded">
    <slot />
  </DropdownMenuTrigger>
</template>

<script setup lang="ts">
import { DropdownMenuTrigger, useForwardPropsEmits } from "reka-ui";
import type { DropdownMenuTriggerProps } from "reka-ui";

const props = defineProps<DropdownMenuTriggerProps & { class?: string }>();
const emits = defineEmits<{ click: [e: MouseEvent] }>();
const forwarded = useForwardPropsEmits(props, emits);
</script>
