<template>
  <div class="cell-content pt-4">
    <div class="centered-btn">
      <UiButton
        type="button"
        class-name="w-[190px] bg-indigo-600 text-white hover:brightness-110"
        size="lg"
        @click="$emit('showSelector', item.i)"
      >
        <UiIcon :icon="mdiVideoPlus" />
        {{ $t("views.multiview.video.selectLive") }}
      </UiButton>

      <div class="mt-2 flex max-w-[190px] gap-2">
        <UiButton
          type="button"
          size="lg"
          class-name="flex-1 bg-teal-600 text-white hover:brightness-110"
          @click="setItemAsChat(item, false)"
        >
          <UiIcon :icon="icons.ytChat" />
          Chat
        </UiButton>
        <UiButton
          type="button"
          size="lg"
          class-name="flex-1 bg-teal-600 text-white hover:brightness-110"
          @click="setItemAsChat(item, true)"
        >
          <UiIcon :icon="icons.tlChat" />
          TL
        </UiButton>
      </div>
    </div>

    <CellControl :play-icon="icons.mdiPlay" class="mx-1 mb-2" @delete="deleteCell" />
  </div>
</template>

<script setup lang="ts">
import { mdiVideoPlus } from "@mdi/js";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import CellControl from "./CellControl.vue";
import { useMultiviewCell, type CellItem } from "@/composables/useMultiviewCell";
import { useMultiviewStore } from "@/stores/multiview";

defineOptions({ name: "EmptyCell" });

const props = defineProps<{
  item: CellItem;
}>();

const emit = defineEmits<{
  (e: "delete", id: string): void;
  (e: "showSelector", id: string): void;
}>();

const multiviewStore = useMultiviewStore();
const { deleteCell } = useMultiviewCell(props.item, emit);

function setItemAsChat(item: CellItem, initAsTL: boolean) {
  multiviewStore.setLayoutContentById({
    id: item.i,
    content: {
      type: "chat",
      initAsTL,
    },
  });
}
</script>

<style lang="scss" scoped>
.centered-btn {
    display: flex;
    flex-grow: 1;
    flex-shrink: 1;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    position: relative;
    flex-direction: column;
}
</style>
