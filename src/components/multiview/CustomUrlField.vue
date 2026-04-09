<template>
  <form class="flex w-full items-center gap-2 px-3" @submit.prevent="handleSubmit">
    <UiInput
      v-model="url"
      :list="historyId"
      :placeholder="slim ? hint : label"
      :class-name="error ? 'border-amber-400/60 focus:border-amber-400/70 focus:ring-amber-400/20' : ''"
    />
    <datalist :id="historyId">
      <option v-for="item in history" :key="item" :value="item" />
    </datalist>
    <UiButton
      type="submit"
      size="icon"
      :variant="(url && !error) ? 'default' : 'outline'"
    >
      <UiIcon :icon="icons.mdiCheck" />
    </UiButton>
  </form>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { getVideoIDFromUrl } from "@/utils/functions";
import { useMultiviewStore } from "@/stores/multiview";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";

defineOptions({ name: "CustomUrlField" });

const props = defineProps<{
  twitch?: boolean;
  slim?: boolean;
}>();

const emit = defineEmits<{
  (e: "onSuccess", content: any): void;
}>();

const multiviewStore = useMultiviewStore();

const url = ref("");
const error = ref(false);

const hint = computed(() =>
  props.twitch ? "https://www.twitch.tv/..." : "https://www.youtube.com/watch?v=...",
);

const label = computed(() =>
  props.twitch ? "Twitch Channel Link" : "Youtube Video Link",
);

const history = computed(() => {
  const hist = props.twitch ? multiviewStore.twUrlHistory : multiviewStore.ytUrlHistory;
  return [...hist].reverse();
});

const historyId = computed(() =>
  props.twitch ? "multiview-twitch-history" : "multiview-youtube-history",
);

watch(() => props.twitch, () => {
  url.value = "";
  error.value = false;
});

function handleSubmit() {
  const content = getVideoIDFromUrl(url.value);
  if (content && content.id) {
    error.value = false;
    emit("onSuccess", content);
    if (!history.value.includes(url.value)) multiviewStore.addUrlHistory({ twitch: props.twitch, url: url.value });
    url.value = "";
  } else {
    error.value = true;
  }
}
</script>
