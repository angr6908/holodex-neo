<template>
  <teleport to="body">
    <transition name="sheet-fade">
      <div
        v-if="open"
        class="fixed inset-0 z-[90] bg-slate-950/70 backdrop-blur-sm"
        @click="emit('update:open', false)"
      />
    </transition>
    <transition :name="side === 'right' ? 'sheet-right' : 'sheet-left'">
      <aside
        v-if="open"
        :class="panelClass"
      >
        <slot />
      </aside>
    </transition>
  </teleport>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/utils/functions";

const props = withDefaults(defineProps<{
  open?: boolean;
  side?: string;
  className?: string;
}>(), {
  open: false,
  side: "left",
  className: "",
});

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
}>();

const panelClass = computed(() => {
  const sideClass = props.side === "right"
    ? "right-0 border-l"
    : "left-0 border-r";
  return cn(
    "fixed inset-y-0 z-[95] w-[min(92vw,24rem)] overflow-y-auto border-white/10 bg-slate-950/92 p-4 shadow-2xl shadow-slate-950/50 backdrop-blur-xl",
    sideClass,
    props.className,
  );
});
</script>

<style scoped>
.sheet-fade-enter-active,
.sheet-fade-leave-active,
.sheet-left-enter-active,
.sheet-left-leave-active,
.sheet-right-enter-active,
.sheet-right-leave-active {
  transition: all 0.18s ease;
}

.sheet-fade-enter-from,
.sheet-fade-leave-to {
  opacity: 0;
}

.sheet-left-enter-from,
.sheet-left-leave-to {
  transform: translateX(-100%);
}

.sheet-right-enter-from,
.sheet-right-leave-to {
  transform: translateX(100%);
}
</style>
