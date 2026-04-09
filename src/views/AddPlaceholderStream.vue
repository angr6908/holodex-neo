<template>
  <section class="space-y-6 px-4 py-6">
    <header class="space-y-2">
      <UiBadge variant="secondary">
        Editor
      </UiBadge>
      <h1 class="text-3xl font-semibold tracking-tight text-white">
        Placeholder Stream
      </h1>
      <p class="max-w-3xl text-sm text-slate-400">
        Create or update scheduled placeholders with the migrated form flow.
      </p>
    </header>

    <div class="grid gap-6 xl:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
      <div class="space-y-4">
        <VideoCard :video="videoObj" include-channel />
      </div>

      <div class="space-y-4">
        <div
          v-if="!isEditor && (token && !expired)"
          class="rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100"
        >
          Editing as {{ token.user }} from {{ discordCredits ? discordCredits.data.guild.name : '' }} Discord
          <br>
          Your session expires: {{ expiresIn }}. Please refresh if it is about to expire.
        </div>
        <div
          v-else-if="!isEditor"
          class="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100"
        >
          You are not an editor or token has expired, please login or generate a new token using our bot.
        </div>

        <UiCard class-name="p-6">
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition"
              :class="tab === 0 ? 'border-sky-400/60 bg-sky-400/12 text-white' : 'border-white/10 bg-white/4 text-slate-300 hover:bg-white/8'"
              @click="tab = 0"
            >
              <UiIcon :icon="mdiPlusBox" size="sm" />
              New
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition"
              :class="tab === 1 ? 'border-sky-400/60 bg-sky-400/12 text-white' : 'border-white/10 bg-white/4 text-slate-300 hover:bg-white/8'"
              @click="tab = 1"
            >
              <UiIcon :icon="mdiPencil" size="sm" />
              Existing
            </button>
          </div>

          <div class="mt-6 space-y-5">
            <div v-if="isEditor" class="space-y-2">
              <label class="block text-sm font-medium text-slate-300">Editor Credit Name</label>
              <UiInput v-model="creditName" />
              <p class="text-xs text-slate-500">
                Use a different name when being publicly credited.
              </p>
              <p v-if="validation.creditName" class="text-xs text-rose-300">
                {{ validation.creditName }}
              </p>
            </div>

            <div v-if="tab === 1" class="space-y-4">
              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-300">Placeholder ID (11 characters)</label>
                <div class="flex gap-2">
                  <UiInput v-model="id" placeholder="Placeholder ID" />
                  <UiButton variant="secondary" @click="loadExistingPlaceholder(id)">
                    <UiIcon :icon="mdiCheck" size="sm" />
                  </UiButton>
                </div>
              </div>

              <VideoSelector
                v-if="!id"
                :hide-placeholders="false"
                @videoClicked="(video) => { id = video.id; loadExistingPlaceholder(id); }"
              />
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-medium text-slate-300">Channel</label>
              <ChannelAutocomplete v-model="channel" label="Channel" />
              <p v-if="validation.channel" class="text-xs text-rose-300">
                {{ validation.channel }}
              </p>
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-medium text-slate-300">Video Title</label>
              <UiInput v-model="videoTitle" />
              <p v-if="validation.videoTitle" class="text-xs text-rose-300">
                {{ validation.videoTitle }}
              </p>
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-medium text-slate-300">Japanese Video Title</label>
              <UiInput v-model="videoTitleJP" />
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-medium text-slate-300">Source Link</label>
              <UiInput
                v-model="sourceUrl"
                type="url"
                placeholder="https://twitter.com/..."
              />
              <p class="text-xs text-slate-500">
                eg. URL to twitter schedule or twitch channel
              </p>
              <p v-if="validation.sourceUrl" class="text-xs text-rose-300">
                {{ validation.sourceUrl }}
              </p>
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-medium text-slate-300">Thumbnail Image</label>
              <UiInput
                v-model="thumbnail"
                type="url"
                placeholder="https://imgur.com/..."
              />
              <p v-if="validation.thumbnail" class="text-xs text-rose-300">
                {{ validation.thumbnail }}
              </p>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <label class="space-y-2">
                <span class="block text-sm font-medium text-slate-300">Event Type</span>
                <select
                  v-model="placeholderType"
                  class="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
                >
                  <option
                    v-for="item in PLACEHOLDER_TYPES"
                    :key="item.value"
                    :value="item.value"
                    class="bg-slate-950"
                  >
                    {{ item.text }}
                  </option>
                </select>
                <p v-if="validation.placeholderType" class="text-xs text-rose-300">
                  {{ validation.placeholderType }}
                </p>
              </label>

              <label class="space-y-2">
                <span class="block text-sm font-medium text-slate-300">Certainty</span>
                <select
                  v-model="certainty"
                  class="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
                >
                  <option
                    v-for="item in CERTAINTY_CHOICE"
                    :key="item.value"
                    :value="item.value"
                    class="bg-slate-950"
                  >
                    {{ item.text }}
                  </option>
                </select>
                <p v-if="validation.certainty" class="text-xs text-rose-300">
                  {{ validation.certainty }}
                </p>
              </label>
            </div>

            <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label class="space-y-2">
                <span class="block text-sm font-medium text-slate-300">Timezone</span>
                <select
                  v-model="timezone"
                  class="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
                >
                  <option
                    v-for="item in TIMEZONES"
                    :key="item.value"
                    :value="item.value"
                    class="bg-slate-950"
                  >
                    {{ item.text }}
                  </option>
                </select>
              </label>

              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-300">Date</label>
                <div class="flex gap-2">
                  <UiButton variant="secondary" size="icon" @click="changeDate(-1, 'day')">
                    <UiIcon :icon="mdiMinusBox" size="sm" />
                  </UiButton>
                  <UiInput v-model="liveDate" type="date" class-name="min-w-0" />
                  <UiButton variant="secondary" size="icon" @click="changeDate(1, 'day')">
                    <UiIcon :icon="mdiPlusBox" size="sm" />
                  </UiButton>
                </div>
                <p class="text-xs text-slate-500">
                  YYYY-MM-DD
                </p>
                <p v-if="validation.liveDate" class="text-xs text-rose-300">
                  {{ validation.liveDate }}
                </p>
              </div>

              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-300">Time</label>
                <div class="flex gap-2">
                  <UiButton variant="secondary" size="icon" @click="changeDate(-1, 'hour')">
                    <UiIcon :icon="mdiMinusBox" size="sm" />
                  </UiButton>
                  <UiInput v-model="liveTime" type="time" class-name="min-w-0" />
                  <UiButton variant="secondary" size="icon" @click="changeDate(1, 'hour')">
                    <UiIcon :icon="mdiPlusBox" size="sm" />
                  </UiButton>
                </div>
                <p v-if="validation.liveTime" class="text-xs text-rose-300">
                  {{ validation.liveTime }}
                </p>
              </div>

              <div class="space-y-2">
                <label class="block text-sm font-medium text-slate-300">Duration</label>
                <UiInput v-model="duration" type="number" min="1" />
                <p class="text-xs text-slate-500">
                  Guess a duration in minutes
                </p>
                <p v-if="validation.duration" class="text-xs text-rose-300">
                  {{ validation.duration }}
                </p>
              </div>
            </div>

            <UiButton @click="onSubmit">
              {{ id ? 'Submit Placeholder Modification' : 'Create new Placeholder' }}
            </UiButton>
          </div>
        </UiCard>
      </div>
    </div>

    <div
      v-if="error"
      class="fixed bottom-4 right-4 z-[120] rounded-2xl border border-rose-400/30 bg-rose-500/90 px-4 py-3 text-sm text-white shadow-2xl"
    >
      {{ errorMessage }}
    </div>
    <div
      v-if="success"
      class="fixed bottom-4 right-4 z-[120] rounded-2xl border border-emerald-400/30 bg-emerald-500/90 px-4 py-3 text-sm text-white shadow-2xl"
    >
      Successfully added Placeholder Stream
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import UiBadge from "@/components/ui/badge/Badge.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";
import ChannelAutocomplete from "@/components/channel/ChannelAutocomplete.vue";
import { dayjs } from "@/utils/time";
import VideoCard from "@/components/video/VideoCard.vue";
import { jwtDecode } from "jwt-decode";
import backendApi from "@/utils/backend-api";
import { mdiMinusBox, mdiPlusBox, mdiPencil, mdiCheck } from "@mdi/js";
import VideoSelector from "@/components/multiview/VideoSelector.vue";
import { useAppStore } from "@/stores/app";

const route = useRoute();
const appStore = useAppStore();

const tab = ref(0);
const id = ref("");
const channel = ref<any>(null);
const videoTitle = ref("");
const videoTitleJP = ref("");
const creditName = ref(appStore.userdata?.user?.username);
const sourceUrl = ref("");
const thumbnail = ref("");
const placeholderType = ref<string | null>(null);
const certainty = ref("");
const liveDate = ref(dayjs().format("YYYY-MM-DD"));
const liveTime = ref("");
const timezone = ref("Asia/Tokyo");
const duration = ref(60);
const discordCredits = ref<any>(null);
const error = ref(false);
const errorMessage = ref("");
const success = ref(false);

const PLACEHOLDER_TYPES = [
  { text: "Scheduled YT Stream", value: "scheduled-yt-stream" },
  { text: "External Stream (eg. Twitch/Twitcast)", value: "external-stream" },
  { text: "Event", value: "event" },
];

const CERTAINTY_CHOICE = [
  { text: "Certain", value: "certain" },
  { text: "Likely", value: "likely" },
];

const TIMEZONES = [
  { text: "JST", value: "Asia/Tokyo" },
  { text: "PST", value: "America/Los_Angeles" },
  { text: "GMT", value: "Etc/GMT" },
];

const isEditor = computed(() => {
  const role = appStore.userdata?.user?.role;
  return ["editor", "admin"].includes(role);
});

const token = computed(() => {
  const jwt = route.query?.token as string | undefined;
  if (!jwt) return null;
  return jwtDecode(jwt) as any;
});

const expiresIn = computed(() => {
  if (token.value?.exp) { return dayjs(token.value.exp * 1000).fromNow(); }
  return "never";
});

const expired = computed(() => {
  if (!token.value?.exp) return true;
  return dayjs().isAfter(dayjs(token.value.exp * 1000));
});

const availableAt = computed(() => {
  if (liveTime.value && timezone.value && liveDate.value) {
    const parsed = dayjs.tz(`${liveDate.value} ${liveTime.value}`, timezone.value);
    if (parsed.isValid()) {
      return parsed.toISOString();
    }
    return null;
  }
  return null;
});

const validation = computed(() => ({
  creditName: isEditor.value && !creditName.value ? "Required" : "",
  channel: channel.value?.id ? "" : "Required",
  videoTitle: videoTitle.value ? "" : "Required",
  sourceUrl: !sourceUrl.value ? "Required" : isValidUrl(sourceUrl.value) ? "" : "Invalid url",
  thumbnail: !thumbnail.value ? "" : isValidUrl(thumbnail.value) ? "" : "Invalid url",
  placeholderType: placeholderType.value ? "" : "Required",
  certainty: certainty.value ? "" : "Required",
  liveDate: liveDate.value ? "" : "Required",
  liveTime: !liveTime.value ? "Required" : availableAt.value ? "" : "Invalid time",
  duration: Number(duration.value) > 0 ? "" : "Required",
}));

const isFormValid = computed(() => {
  return Object.values(validation.value).every((value) => !value);
});

const credits = computed(() => {
  if (!isEditor.value && !token.value) return null;
  return isEditor.value
    ? {
      editor: {
        name: creditName.value,
        user: appStore.userdata.user.id,
      },
    } : {
      discord: {
        name: token.value.name,
        link: token.value.link,
        user: token.value.user,
      },
    };
});

const videoObj = computed(() => ({
  title: videoTitle.value || "Example Title",
  placeholderType: placeholderType.value || "scheduled-yt-stream",
  channel: channel.value || {
    id: "ExampleIdThatDoesntExist",
    name: "<CHANNEL>",
    english_name: "<CHANNEL>",
  },
  thumbnail: thumbnail.value || "",
  type: "placeholder",
  status: "upcoming",
  start_scheduled: availableAt.value || dayjs().toISOString(),
  available_at: availableAt.value || dayjs().toISOString(),
  credits: credits.value || {
    discord: {
      user: "Discord User",
      link: "jctkgHBt4b",
    },
  },
  certainty: certainty.value,
  link: sourceUrl.value,
}));

watch(tab, (nv) => {
  if (nv === 0) id.value = "";
});

function isValidUrl(value: string) {
  return /^https?:\/\/[\w-]+(\.[\w-]+)+\.?(\/\S*)?/.test(value);
}

function onSubmit() {
  if (isFormValid.value && (isEditor.value || (token.value && !expired.value))) {
    const titlePayload = {
      name: videoTitle.value,
      ...videoTitleJP.value && { jp_name: videoTitleJP.value },
      link: sourceUrl.value,
      ...thumbnail.value && { thumbnail: thumbnail.value },
      placeholderType: placeholderType.value,
      certainty: certainty.value,
      credits: credits.value,
    };
    const body: any = {
      channel_id: channel.value.id,
      title: titlePayload,
      liveTime: availableAt.value,
      duration: (+duration.value) * 60,
      id: undefined,
    };
    if (id.value) body.id = id.value;
    backendApi.addPlaceholderStream(body, appStore.userdata?.jwt, route.query?.token as string)
      .then(() => {
        success.value = true;
      })
      .catch((e: any) => {
        error.value = true;
        errorMessage.value = e;
      });
  } else {
    error.value = true;
    errorMessage.value = "You're not a valid Holodex Editor, or your discord-generated placeholder creation link has expired";
  }
}

function changeDate(amount: number, unit: "hour" | "day") {
  if (unit === "hour") {
    liveTime.value = dayjs(`${liveDate.value} ${liveTime.value || "00:00"}`).add(amount, unit).format("HH:mm");
  } else {
    liveDate.value = dayjs(liveDate.value || dayjs().format("YYYY-MM-DD")).add(amount, unit).format("YYYY-MM-DD");
  }
}

async function loadExistingPlaceholder(phId: string) {
  if (!phId) return;

  const video = (await backendApi.video(phId, undefined, 0)).data;

  videoTitle.value = video.title;
  videoTitleJP.value = video.jp_name;
  sourceUrl.value = video.link;
  thumbnail.value = video.thumbnail;
  placeholderType.value = video.placeholderType;
  timezone.value = "Asia/Tokyo";
  const vt = dayjs(video.start_scheduled).tz(timezone.value);
  liveDate.value = vt.format("YYYY-MM-DD");
  liveTime.value = vt.format("HH:mm");
  duration.value = video.duration / 60;
  certainty.value = video.certainty;
  channel.value = video.channel;
}

onMounted(async () => {
  if (token.value?.link) { discordCredits.value = await backendApi.discordServerInfo(token.value.link); }
  const queryId = route.query.id as string | undefined;
  if (queryId && isEditor.value) {
    id.value = queryId;
    loadExistingPlaceholder(queryId);
    tab.value = 1;
  }
});
</script>
