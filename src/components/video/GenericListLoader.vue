<template>
  <div>
    <div :id="'tjump' + randomId" />
    <slot :data="data" :is-loading="isLoading" />
    <InfiniteLoad v-if="infiniteLoad" :identifier="identifier" @infinite="emitLoad" />
    <PaginateLoad
      v-if="paginate"
      :identifier="identifier"
      :pages="pages"
      :page-less="pageless || total === null"
      :scroll-element-id="'tjump' + randomId"
      @paginate="emitLoad"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

import InfiniteLoad from "@/components/common/InfiniteLoad.vue";
import PaginateLoad from "@/components/common/PaginateLoad.vue";

const props = withDefaults(defineProps<{
  infiniteLoad?: boolean;
  paginate?: boolean;
  pageless?: boolean;
  endIfPartialPage?: boolean;
  loadFn: (offset: number, limit: number) => Promise<any>;
  perPage?: number;
}>(), {
  infiniteLoad: false,
  paginate: false,
  pageless: false,
  endIfPartialPage: false,
  perPage: 24,
});

const randomId = ref(Date.now());
const data = ref<any[]>([]);
const total = ref<number | null>(null);
const identifier = ref(Date.now());
const isLoading = ref(true);

const pages = computed(() => (total.value ? Math.ceil(total.value / props.perPage) : 1));

async function emitLoad($state: { page: number; loaded: () => void; completed: () => void; error: () => void }) {
  const { page } = $state;
  isLoading.value = true;
  const result: Array<object> | { total?: number; offset?: number; items?: any } = await props.loadFn(
    (page - 1) * props.perPage,
    props.perPage,
  ).catch((x: any) => {
    $state.error();
    console.error(x);
    return null;
  });

  if (!result) {
    isLoading.value = false;
    return;
  }

  let obtainedArray: Array<object>;
  let offset: number;

  if (Array.isArray(result)) {
    obtainedArray = result;
    total.value = null;
    offset = (page - 1) * props.perPage;
  } else {
    total.value = (result as any).total;
    offset = (result as any).offset || (page - 1) * props.perPage;
    obtainedArray = Object.values(result as object).find((v) => Array.isArray(v)) || [];
  }
  isLoading.value = false;

  if (props.infiniteLoad) {
    data.value = data.value.concat(obtainedArray);
    if ((obtainedArray.length < props.perPage && props.endIfPartialPage) || obtainedArray.length === 0) {
      $state.completed();
    } else {
      $state.loaded();
    }
  } else if (props.paginate) {
    data.value = obtainedArray;
    if (props.pageless || total.value === null) {
      if ((obtainedArray.length < props.perPage && props.endIfPartialPage) || obtainedArray.length === 0) {
        $state.completed();
      } else {
        $state.loaded();
      }
    } else if ((offset || (page - 1) * props.perPage) + props.perPage >= total.value!) {
      $state.completed();
    } else {
      $state.loaded();
    }
  }
}
</script>

<style></style>
