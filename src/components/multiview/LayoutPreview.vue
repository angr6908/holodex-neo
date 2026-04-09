<template>
  <div class="layout-preview" :class="{ 'theme--light': isLightTheme }" :style="size">
    <template v-for="l in layout" :key="l.i">
      <div class="layout-preview-cell" :style="getStyle(l)">
        <span v-if="content && content[l.i] && content[l.i].type === 'chat'">💬</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useSettingsStore } from "@/stores/settings";

defineOptions({ name: "LayoutPreview" });

const props = withDefaults(defineProps<{
  layout: Array<any>;
  content?: Record<string, any>;
  mobile?: boolean;
  scale?: number;
}>(), {
  mobile: false,
  scale: 1,
});

const settingsStore = useSettingsStore();

const isLightTheme = computed(() => !settingsStore.darkMode);

const size = computed(() => {
  const width = props.scale * (props.mobile ? 108 : 192);
  const height = props.scale * (props.mobile ? 192 : 108);
  return {
    width: `${width}px`,
    height: `${height}px`,
  };
});

const palette = computed(() => {
  if (isLightTheme.value) {
    return {
      surface: "#f5f5f5",
      border: "#d6d9df",
      info: "rgba(56, 189, 248, 0.28)",
      warning: "rgba(251, 191, 36, 0.3)",
    };
  }
  return {
    surface: "#1f2937",
    border: "#475569",
    info: "rgba(56, 189, 248, 0.24)",
    warning: "rgba(251, 191, 36, 0.28)",
  };
});

function getStyle(l: any) {
  function px(num: number) {
    return `${num * (100 / 24)}%`;
  }
  return {
    top: px(l.y),
    left: px(l.x),
    width: px(l.w),
    height: px(l.h),
    ...(props.content && props.content[l.i] && props.content[l.i].type === "chat"
      ? { "background-color": palette.value.warning }
      : { "background-color": palette.value.info }),
  };
}
</script>

<style>
.layout-preview {
    border: 2px solid #475569;
    background-color: #1f2937;
    position: relative;
    overflow: hidden;
}

.layout-preview-cell {
    position: absolute;
    border: 2px solid #475569;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    align-items: center;
}

.layout-preview.theme--light > .layout-preview-cell > span {
    color: black;
}

.layout-preview.theme--light {
    border-color: #d6d9df;
    background-color: #f5f5f5;
}
.layout-preview.theme--light > .layout-preview-cell {
    border-color: #d6d9df;
    background-color: #e0e0e0;
}
</style>
