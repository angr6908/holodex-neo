<template>
  <UiDialog
    :open="value"
    :class-name="isTooSmall ? 'max-w-[96%] p-0' : 'max-w-[980px] w-[80%] p-0'"
    @update:open="$emit('input', $event)"
  >
    <UiCard class-name="relative p-0">
      <img v-if="video.thumbnail" :src="'/statics/thumbnail/maxres/'+enc(video.thumbnail)+'.jpg'" class="placeholder-img">

      <watch-info :video="videoWithMentions" no-sub-count>
        <div v-if="appStore.userdata.user && appStore.userdata.user.role !== 'user'" class="pl-6">
          <code class="text-h6">{{ video.id }}</code>
          <UiButton
            variant="secondary"
            class-name="m-2"
            as="a"
            :href="`/add_placeholder?id=${video.id}`"
          >
            Edit
          </UiButton>
          <UiButton
            variant="destructive"
            class-name="m-2"
            @click="showDeleteConfirm = true"
          >
            Delete
          </UiButton>
          <UiDialog
            :open="showDeleteConfirm"
            class-name="max-w-[290px] p-0"
            @update:open="showDeleteConfirm = $event"
          >
            <UiCard class-name="space-y-4 p-5">
              <div class="text-lg font-semibold text-white">
                Are you sure?
              </div>
              <div class="flex justify-end">
                <UiButton variant="destructive" size="sm" @click="deletePlaceholder">
                  Delete
                </UiButton>
              </div>
            </UiCard>
          </UiDialog>
        </div>
        <div style="height:12px;" />
        <template #rightTitleAction>
          <UiButton
            v-if="video.placeholderType === 'scheduled-yt-stream'"
            size="lg"
            class="float-right placeholder-punchout"
            as="a"
            :href="video.link"
            target="_blank"
          >
            <UiIcon :icon="icons.mdiYoutube" size="sm" />
            {{ $t('component.placeholderVideo.scheduledEvent') }}
          </UiButton>
          <UiButton
            v-else
            size="lg"
            class="float-right placeholder-punchout"
            as="a"
            target="_blank"
            :href="video.link"
          >
            <UiIcon :icon="icons.mdiOpenInNew" size="sm" />
            {{ video.placeholderType === 'external-stream' ? $t('component.placeholderVideo.streamPageBtn') : $t('component.placeholderVideo.eventPageBtn') }}
          </UiButton>
        </template>
        <div class="mt-n4 pl-7 text-left text-body-2">
          <div class="space-y-1">
            <span>{{ $t('component.placeholderVideo.creditTitleText') }}</span>
            <span v-if="video.credits.discord && discordCredits && discordCredits.data">
              <i18n path="component.placeholderVideo.discordCredit" :tag="false">
                <template #0>
                  {{ video.credits.discord.user }}
                </template>
                <template #1>
                  <strong><a :href="`https://discord.gg/${video.credits.discord.link}`" style="display:inline-block;">
                    <UiIcon :icon="icons.mdiDiscord" size="sm" />{{ discordCredits.data.guild.name }}</a>
                  </strong>
                </template>
              </i18n>
            </span>
            <span v-if="video.credits.datasource">
              {{ $t('component.placeholderVideo.datasourceCredit', [video.credits.datasource.name]) }}
              <strong><a :href="video.credits.datasource.link">
                <UiIcon :icon="icons.mdiOpenInNew" size="sm" />{{ video.credits.datasource.link }}</a>
              </strong>
            </span>
            <span v-if="video.credits.bot">
              {{ $t('component.placeholderVideo.botCredit', [video.credits.bot.name, video.credits.bot.user]) }}
              <strong><a :href="video.credits.bot.link">
                <UiIcon :icon="icons.mdiOpenInNew" size="sm" />{{ video.credits.bot.link }}</a>
              </strong>
            </span>
            <span v-if="video.credits.editor">
              {{ $t('component.placeholderVideo.editorCredit', [video.credits.editor.name]) }}
            </span>
          </div>
        </div>
      </watch-info>
    </UiCard>
  </UiDialog>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import WatchInfo from "@/components/watch/WatchInfo.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiDialog from "@/components/ui/dialog/Dialog.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import backendApi from "@/utils/backend-api";
import { useAppStore } from "@/stores/app";

const props = defineProps<{ value: boolean; video: any }>();
defineEmits<{ (e: "input", val: boolean): void }>();

const appStore = useAppStore();
const discordCredits = ref<any>({});
const mentions = ref<any[]>([]);
const showDeleteConfirm = ref(false);

const isTooSmall = computed(() => window.innerWidth < 700);
const videoWithMentions = computed(() => ({ ...props.video, mentions: mentions.value }));

function enc(url: string) {
  const encoded = btoa(url);
  return encoded.replace("+", "-").replace("/", "_").replace(/=+$/, "");
}

function updateMentions() {
  backendApi.getMentions(props.video.id).then(({ data }: any) => {
    mentions.value = data;
  });
}

async function deletePlaceholder() {
  try {
    await backendApi.deletePlaceholderStream(props.video.id, appStore.userdata.jwt);
    alert("Successfully deleted, probably.");
  } catch (e) {
    console.error(e);
    alert("Failed to delete");
  }
  showDeleteConfirm.value = false;
}

onMounted(async () => {
  if (props.video?.credits?.discord) {
    discordCredits.value = await backendApi.discordServerInfo(props.video.credits.discord.link);
  }
  updateMentions();
});
</script>

<style>
.placeholder-punchout {
    position: absolute;
    right: 20px;
    margin-top: 15px;
    z-index: 30;
}
.placeholder-img {
  object-fit: contain;
  width: 100%;height: 500px;
  background: black;
  max-height: 50vh;
}
</style>
