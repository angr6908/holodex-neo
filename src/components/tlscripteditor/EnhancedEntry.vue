<template>
  <span class="EntryContainer2" :style="textStyle">
    {{ stext }}
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{
  stext?: string;
  cc?: string;
  oc?: string;
}>(), { stext: "", cc: "", oc: "" });

const textStyle = computed(() => ({
  "-webkit-text-fill-color": props.cc === "" ? "unset" : props.cc,
  "-webkit-text-stroke-color": props.oc === "" ? "unset" : props.oc,
  "-webkit-text-stroke-width": props.oc === "" ? "0px" : "1px",
}));
</script>

<style>
.EntryContainer2 {
    font-weight: bold;
    text-align: center;
    margin: 2px 4px 2px 4px;
    word-wrap: break-word;
}
</style>
