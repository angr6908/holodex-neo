<template>
  <div>
    <div
      style="white-space: pre-wrap; word-break: break-word"
      :class="{ 'truncated-text': (!expanded && newLineCount > lines) }"
      :style="`-webkit-line-clamp: ${lines}`"
    >
      <span v-if="html" v-linkified v-html="html" />
      <span v-else v-linkified v-text="text" />
    </div>
    <button
      v-if="newLineCount > lines"
      type="button"
      class="mt-3 inline-flex items-center"
      @click="expanded = !expanded"
    >
      <slot name="button" :expanded="expanded">
        <span>{{
          expanded ? $t("component.description.showLess") : $t("component.description.showMore")
        }}</span>
      </slot>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
// TODO(jprochazk): type declarations for this module
import linkify from "vue-linkify";

const vLinkified = linkify;

const props = withDefaults(defineProps<{
  html?: string;
  text?: string;
  lines?: number | string;
}>(), {
  html: "",
  text: "",
  lines: 5,
});

const expanded = ref(false);
const newLineCount = computed(() =>
  props.html.split(/\r\n|\r|\n/).length || props.text.split(/\r\n|\r|\n/).length,
);
</script>

<style>
.truncated-text {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
</style>
