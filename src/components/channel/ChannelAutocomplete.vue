<template>
  <div class="space-y-2">
    <UiInput
      v-model="search"
      :list="datalistId"
      :placeholder="label"
      @input="handleInput"
    />
    <datalist :id="datalistId">
      <option
        v-for="item in searchResults"
        :key="item.value.id"
        :value="item.text"
      />
    </datalist>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import backendApi from "@/utils/backend-api";
import { CHANNEL_TYPES } from "@/utils/consts";
import debounce from "lodash-es/debounce";
import UiInput from "@/components/ui/input/Input.vue";

withDefaults(defineProps<{
  value?: Record<string, any>;
  label?: string;
}>(), {
  value: undefined,
  label: "Search Channels",
});

const emit = defineEmits<{
  (e: "input", value: any): void;
}>();

const search = ref("");
const searchResults = ref<any[]>([]);
const datalistId = `channel-autocomplete-${Math.random().toString(36).slice(2)}`;

const debouncedSearch = debounce(() => {
  if (!search.value) {
    searchResults.value = [];
    return;
  }
  backendApi
    .searchChannel({
      type: CHANNEL_TYPES.VTUBER,
      queryText: search.value,
    })
    .then(({ data }: any) => {
      searchResults.value = data.map((d: any) => ({
        text: `${d.english_name ? (d.english_name + ",") : ""} ${d.name} (${d.id})`,
        value: d,
      }));
    });
}, 500);

watch(search, () => {
  debouncedSearch();
});

function handleInput(value: string) {
  const match = searchResults.value.find((item) => item.text === value);
  emit("input", match ? match.value : value);
}
</script>

<style>

</style>
