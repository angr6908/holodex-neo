<template>
  <div
    :key="identifier"
    class="flex justify-center py-4"
    style="min-height: 100px"
    @click.capture="clicked = true"
  >
    <div
      v-if="!pageLess"
      v-show="status === STATUSES.READY || status === STATUSES.COMPLETED"
      class="flex flex-wrap items-center justify-center gap-2"
    >
      <UiButton
        variant="outline"
        size="sm"
        :disabled="page === 1"
        @click="page -= 1"
      >
        <UiIcon :icon="icons.mdiChevronLeft" size="sm" />
      </UiButton>
      <UiButton
        v-for="pageNumber in visiblePages"
        :key="`page-${pageNumber}`"
        :variant="pageNumber === page ? 'default' : 'outline'"
        size="sm"
        @click="page = pageNumber"
      >
        {{ pageNumber }}
      </UiButton>
      <UiButton
        variant="outline"
        size="sm"
        :disabled="page === pages"
        @click="page += 1"
      >
        <UiIcon :icon="icons.mdiChevronRight" size="sm" />
      </UiButton>
    </div>
    <div v-show="status === STATUSES.READY || status === STATUSES.COMPLETED" v-else>
      <UiButton
        class-name="m-2 pr-6"
        variant="outline"
        :disabled="page === 1"
        @click="page -= 1"
      >
        <UiIcon :icon="icons.mdiChevronLeft" size="sm" />
        {{ $t("component.paginateLoad.newer") }}
      </UiButton>
      <UiButton
        class-name="m-2 pl-6"
        variant="outline"
        :disabled="status === STATUSES.COMPLETED"
        @click="page += 1"
      >
        {{ $t("component.paginateLoad.older") }}
        <UiIcon :icon="icons.mdiChevronRight" size="sm" />
      </UiButton>
    </div>
    <!-- </template> -->
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useIsActive } from "@/composables/useIsActive";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";

const STATUSES = Object.freeze({ READY: 0, LOADING: 1, ERROR: 2, COMPLETED: 3 });
const TOTAL_PAGINATION_COUNT = Object.freeze({ xs: 5, sm: 8, md: 12, lg: 14, xl: 16 });

const props = withDefaults(defineProps<{
  identifier?: string | number;
  pages?: number;
  pageLess?: boolean;
  scrollElementId?: string | null;
}>(), {
  identifier: +new Date(),
  pages: 1,
  pageLess: false,
  scrollElementId: null,
});

const emit = defineEmits<{ (e: "paginate", state: any): void }>();

const { isActive } = useIsActive();
const route = useRoute();
const router = useRouter();

const status = ref(1);
const clicked = ref(false);

const totalVisibleCount = computed(() => {
  const width = window.innerWidth;
  if (width < 640) return TOTAL_PAGINATION_COUNT.xs;
  if (width < 768) return TOTAL_PAGINATION_COUNT.sm;
  if (width < 1024) return TOTAL_PAGINATION_COUNT.md;
  if (width < 1280) return TOTAL_PAGINATION_COUNT.lg;
  return TOTAL_PAGINATION_COUNT.xl;
});

const page = computed({
  get: () => Number(route.query.page || 1),
  set: (val) => {
    router.push({ query: { ...route.query, page: val }, hash: `${route.hash}` });
  },
});

const visiblePages = computed(() => {
  const totalVisible = totalVisibleCount.value;
  const half = Math.floor(totalVisible / 2);
  let start = Math.max(1, page.value - half);
  const end = Math.min(props.pages, start + totalVisible - 1);
  start = Math.max(1, end - totalVisible + 1);
  return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
});

function reset() { status.value = STATUSES.READY; }

function emitEvent() {
  const loaded = () => {
    status.value = STATUSES.READY;
    if (clicked.value && props.scrollElementId) {
      window.scrollTo(0, document.getElementById(props.scrollElementId)!.offsetTop - 100);
    }
  };
  const completed = () => { status.value = STATUSES.COMPLETED; };
  const error = () => { status.value = STATUSES.ERROR; };
  emit("paginate", { page: page.value, loaded, completed, error });
  status.value = STATUSES.LOADING;
}

watch(() => props.identifier, () => {
  reset();
  if (page.value !== 1) {
    page.value = 1;
  }
  if (isActive.value) emitEvent();
});

watch(() => route.query.page, (nw, old) => {
  if (isActive.value && nw !== old) emitEvent();
});

onMounted(() => { emitEvent(); });
</script>

<style></style>
