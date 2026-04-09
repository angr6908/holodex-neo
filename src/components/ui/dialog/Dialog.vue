<template>
  <teleport to="body">
    <transition name="dialog-fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
        @click.self="emit('update:open', false)"
      >
        <div :class="panelClass">
          <slot />
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/utils/functions";

const props = withDefaults(defineProps<{
  open?: boolean;
  className?: string;
}>(), {
  open: false,
  className: "",
});

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
}>();

const panelClass = computed(() =>
  cn(
    "glass-panel max-h-[90vh] w-full overflow-hidden rounded-[calc(var(--radius)+8px)] border border-white/10 shadow-2xl shadow-slate-950/50",
    props.className,
  ),
);
</script>

<style scoped>
.dialog-fade-enter-active,
.dialog-fade-leave-active {
  transition: opacity 0.18s ease;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}
</style>
