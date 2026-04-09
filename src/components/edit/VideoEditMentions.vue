<template>
  <div>
    <div class="text-h6">
      <UiIcon :icon="mdiAt" size="sm" /> Channel Mentions/Tags
    </div>
    <div
      v-if="successMessage && showSuccessAlert"
      class="mb-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/20 px-4 py-3 text-sm text-white"
    >
      {{ successMessage }}
    </div>
    <div
      v-if="errorMessage && showErrorAlert"
      class="mb-3 rounded-2xl border border-rose-400/30 bg-rose-500/20 px-4 py-3 text-sm text-white"
    >
      {{ errorMessage }}
    </div>
    <div class="my-2 flex flex-col gap-2">
      <channel-autocomplete v-model="selectedChannel" />
      <UiButton :disabled="!selectedChannel?.id" @click="addMention(selectedChannel.id)">
        Add
      </UiButton>
    </div>
    <channel-list :channels="mentions" :include-video-count="false">
      <template #action="{ channel }">
        <UiButton
          class="deleteBtn"
          variant="destructive"
          size="icon"
          class-name="h-10 w-10"
          @click.stop.prevent="deleteMention(channel.id)"
        >
          <UiIcon :icon="icons.mdiDelete" size="lg" />
        </UiButton>
      </template>
    </channel-list>
    <!-- <loading-overlay :isLoading="isLoading" :showError="hasError" /> -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { mdiAt } from "@mdi/js";
import backendApi from "@/utils/backend-api";
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import ChannelAutocomplete from "@/components/channel/ChannelAutocomplete.vue";
import ChannelList from "../channel/ChannelList.vue";
import { useAppStore } from "@/stores/app";
import { useSettingsStore } from "@/stores/settings";

const props = defineProps<{ video: any }>();

const appStore = useAppStore();
const settingsStore = useSettingsStore();
const mentions = ref<any[]>([]);
const isLoading = ref(true);
const showSuccessAlert = ref(false);
const showErrorAlert = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const selectedChannel = ref<any>(null);

function getChannelName(channel: any) {
  return channel[settingsStore.nameProperty] || channel.name;
}

function showSuccess(message: string) {
  showSuccessAlert.value = true;
  successMessage.value = message;
  setTimeout(() => { showSuccessAlert.value = false; }, 4000);
}

function showError(message: string) {
  errorMessage.value = message;
  showErrorAlert.value = true;
  setTimeout(() => { showErrorAlert.value = false; }, 4000);
}

function updateMentions() {
  backendApi.getMentions(props.video.id)
    .then(({ data }: any) => { mentions.value = data; })
    .catch((e: any) => { console.error(e); });
}

function deleteMention(channelId: string) {
  backendApi.deleteMentions(props.video.id, [channelId], appStore.userdata.jwt)
    .then(({ data }: any) => {
      if (!data) return;
      showSuccess("Successfully deleted mention");
      updateMentions();
    })
    .catch((e: any) => { showError((e.response?.data?.message) || e.message || "Error occured"); });
}

function addMention(channelId: string) {
  isLoading.value = true;
  backendApi.addMention(props.video.id, channelId, appStore.userdata.jwt)
    .then(({ data }: any) => {
      if (!data) return;
      showSuccess(`Added channel: ${getChannelName(selectedChannel.value)}`);
      updateMentions();
    })
    .catch((e: any) => { showError((e.response?.data?.message) || e.message || "Error occured"); });
}

onMounted(() => { updateMentions(); });
</script>

<style></style>
