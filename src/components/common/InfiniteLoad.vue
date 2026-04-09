<template>
  <div
    ref="sentinel"
    :key="identifier"
    class="flex justify-center py-4"
    style="min-height: 100px"
  >
    <LoadingOverlay :is-loading="status === STATUSES.LOADING" :show-error="status === STATUSES.ERROR" />
    <div v-if="status === STATUSES.COMPLETED">
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import LoadingOverlay from "@/components/common/LoadingOverlay.vue";

const STATUSES = Object.freeze({ READY: 0, LOADING: 1, ERROR: 2, COMPLETED: 3 });

const props = withDefaults(defineProps<{
  identifier?: string | number;
  initVisible?: boolean;
}>(), {
  identifier: +new Date(),
  initVisible: true,
});

const emit = defineEmits<{ (e: "infinite", state: any): void }>();

const status = ref(0);
const nextPage = ref(1);
const isVisible = ref(false);
const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

function reset() {
  nextPage.value = 1;
  isVisible.value = false;
  status.value = STATUSES.READY;
}

function emitEvent() {
  const loaded = () => {
    nextPage.value += 1;
    status.value = STATUSES.READY;
    setTimeout(() => {
      if (status.value === STATUSES.READY && isVisible.value) emitEvent();
    }, 100);
  };
  const completed = () => { status.value = STATUSES.COMPLETED; };
  const error = () => { status.value = STATUSES.ERROR; };
  emit("infinite", { loaded, completed, error, page: nextPage.value });
  status.value = STATUSES.LOADING;
}

function onIntersect(intersecting: boolean) {
  isVisible.value = intersecting;
  if (status.value === STATUSES.READY && intersecting) emitEvent();
}

function setupObserver() {
  if (!("IntersectionObserver" in window) || !sentinel.value) return;
  observer = new IntersectionObserver(
    (entries) => { onIntersect(entries[0]?.isIntersecting ?? false); },
    { root: null, rootMargin: "200px 0px", threshold: 0 },
  );
  observer.observe(sentinel.value);
}

watch(() => props.identifier, () => reset());

onMounted(() => {
  setupObserver();
  if (props.initVisible) emitEvent();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});
</script>

<style></style>
