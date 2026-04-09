<template>
  <div
    ref="tlBody"
    class="tl-body p-1 lg:p-3"
    :style="{
      'font-size': fontSize + 'px',
    }"
    :class="{'ios-safari-reverse-fix': checkIOS() }"
  >
    <transition-group name="fade" :class="{'ios-safari-reverse-fix': checkIOS() }">
      <template v-for="(item, index) in tlHistory" :key="item.key">
        <chat-message
          :source="item"
          :hide-author="hideAuthor(item, index)"
        />
      </template>
    </transition-group>
    <!-- Slot for adding a Load More button on top of Messages -->
    <div class="text-center" :class="{'ios-safari-reverse-fix': checkIOS() }">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { checkIOS } from "@/utils/functions";
import ChatMessage from "./ChatMessage.vue";

defineOptions({ name: "MessageRenderer" });

const props = withDefaults(defineProps<{
  tlHistory?: any[];
  fontSize?: number;
}>(), {
  tlHistory: () => [],
  fontSize: 14,
});

const tlBody = ref<HTMLElement | null>(null);

function hideAuthor(item: any, index: number) {
  return !(index === 0
    || index === props.tlHistory.length - 1
    || item.name !== props.tlHistory[index - 1].name
    || !!item.breakpoint);
}

function scrollToBottom() {
  if (tlBody.value && Math.abs(tlBody.value.scrollTop / tlBody.value.scrollHeight) <= 0.15) {
    tlBody.value.scrollTop = 0;
  }
}

defineExpose({ scrollToBottom });
</script>

<style>
.fade-enter-active,
.fade-leave-active {
    transition: all 0.4s;
}
.fade-enter, .fade-leave-to /* .fade-leave-active below version 2.1.8 */ {
    opacity: 0;
}

.ios-safari-reverse-fix {
  transform: scale(1,-1);
  flex-direction: column !important;
}
</style>
