<template>
  <div class="mx-auto w-full max-w-5xl px-4 py-6">
    <div class="mx-auto w-full md:max-w-[83.333%] lg:max-w-[66.666%]">
      <UiCard class-name="p-6">
        <div class="text-2xl font-semibold text-white">
          {{ $t("channelRequest.PageTitle") }}
        </div>

        <div
          v-if="type && alertText(type)"
          class="mt-4 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm text-sky-100"
        >
          <p v-html="alertText(type)" />
        </div>

        <div class="mt-6 space-y-6">
          <fieldset>
            <legend class="mb-3 text-sm font-medium text-slate-300">
              {{ $t('channelRequest.RequestType') }}
            </legend>
            <div class="grid gap-3">
              <label
                v-for="ct in channelTypes"
                :key="'ct' + ct.value"
                class="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/4 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/8"
              >
                <input
                  v-model="type"
                  type="radio"
                  :value="ct.value"
                  class="mt-1"
                >
                <span>{{ ct.text }}</span>
              </label>
            </div>
          </fieldset>

          <div v-if="type === MODIFY_EXISTING || type === DELETE">
            <ChannelAutocomplete
              v-model="channel"
              label="Channel"
            />
          </div>

          <div v-else>
            <label class="mb-2 block text-sm font-medium text-slate-300">Channel URL</label>
            <UiInput
              v-model="link"
              placeholder="https://www.youtube.com/channel/UC_____  or https://www.youtube.com/@_____"
            />
            <div v-if="linkValidationError" class="mt-2 text-xs text-rose-300">
              {{ linkValidationError }}
            </div>
            <div class="mt-2 text-xs text-slate-500">
              https://www.youtube.com/channel/UC_____ or https://www.youtube.com/@_____
            </div>
          </div>

          <div v-if="type !== DELETE && type !== ADD_CLIPPER">
            <label class="mb-2 block text-sm font-medium text-slate-300">{{ $t('channelRequest.EnglishNameLabel') }}</label>
            <UiInput v-model="english_name" />
            <div class="mt-2 text-xs text-slate-500">
              {{ $t('channelRequest.EnglishNameHint') }}
            </div>
          </div>

          <div v-if="!(type === ADD_VTUBER || type === DELETE)">
            <label class="mb-2 block text-sm font-medium text-slate-300">{{ $t('channelRequest.ChannelLanguageLabel') }}</label>
            <select
              v-model="lang"
              class="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
            >
              <option value="" class="bg-slate-950">
                Select language
              </option>
              <option
                v-for="item in languages"
                :key="item.value"
                :value="item.value"
                class="bg-slate-950"
              >
                {{ item.text }}
              </option>
            </select>
            <div v-if="langValidationError" class="mt-2 text-xs text-rose-300">
              {{ langValidationError }}
            </div>
          </div>

          <div v-if="type === ADD_VTUBER || type === MODIFY_EXISTING">
            <label class="mb-2 block text-sm font-medium text-slate-300">{{ $t('channelRequest.VtuberGroupLabel') }}</label>
            <UiInput v-model="org" placeholder="Hololive, Nijisanji, ..." />
            <div class="mt-2 text-xs text-slate-500">
              {{ $t('channelRequest.VtuberGroupHint') }}
            </div>
          </div>

          <div v-if="type !== DELETE">
            <label class="mb-2 block text-sm font-medium text-slate-300">{{ $t('channelRequest.TwitterHandle') }}</label>
            <UiInput v-model="twitter" placeholder="@xyzabc" />
            <div v-if="twitterValidationError" class="mt-2 text-xs text-rose-300">
              {{ twitterValidationError }}
            </div>
            <div class="mt-2 text-xs text-slate-500">
              @username
            </div>
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium text-slate-300">{{ $t('channelRequest.DirectContactLabel') }}</label>
            <UiInput
              v-model="contact"
              placeholder="@abc / discord#1234 / contact@hello.me"
            />
            <div v-if="contactValidationError" class="mt-2 text-xs text-rose-300">
              {{ contactValidationError }}
            </div>
            <div class="mt-2 text-xs text-slate-500">
              {{ $t('channelRequest.DirectContactDisclaimer') }}
            </div>
          </div>

          <div>
            <label class="mb-2 block text-sm font-medium text-slate-300">{{ $t('channelRequest.Comments') }}</label>
            <textarea
              v-model="comments"
              class="min-h-28 w-full rounded-xl border border-white/12 bg-white/6 px-3 py-2 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
            />
            <div class="mt-2 text-xs text-slate-500">
              {{ $t('channelRequest.CommentsHint') }}
            </div>
          </div>

          <UiButton
            type="button"
            class-name="mt-2"
            :variant="success ? 'default' : 'default'"
            @click="onSubmit"
          >
            <UiIcon :icon="icons.mdiCheck" />
            Submit
          </UiButton>
        </div>
      </UiCard>
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
      OK
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import * as icons from "@/utils/icons";
import backendApi from "@/utils/backend-api";
import ChannelAutocomplete from "@/components/channel/ChannelAutocomplete.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";

const ADD_VTUBER = "Add a Vtuber ▶️ for Holodex to track the channel and clips.";
const ADD_CLIPPER = "I'd like to ➕ add a clipping/subbing channel to Holodex.";
const MODIFY_EXISTING = "I'd like to modify existing channel";
const DELETE = "I'd like to delete my channel";

const { t } = useI18n();
const router = useRouter();

const languages = [
  { text: "English", value: "en" },
  { text: "日本語", value: "ja" },
  { text: "中文", value: "zh" },
  { text: "한국어", value: "ko" },
  { text: "Español", value: "es" },
  { text: "Français", value: "fr" },
  { text: "ไทย (Thai)", value: "th" },
  { text: "Bahasa", value: "id" },
  { text: "Русский язык", value: "ru" },
  { text: "Tiếng Việt", value: "vi" },
];

const channelTypes = computed(() => [
  { text: t("channelRequest.Types.AddVtuber"), value: ADD_VTUBER },
  { text: t("channelRequest.Types.AddClipper"), value: ADD_CLIPPER },
  { text: t("channelRequest.Types.ModifyExistingInfo"), value: MODIFY_EXISTING },
  { text: t("channelRequest.Types.DeleteChannel"), value: DELETE },
]);

const error = ref(false);
const errorMessage = ref("");
const success = ref(false);
const link = ref("");
const english_name = ref("");
const type = ref("");
const lang = ref("");
const twitter = ref("");
const contact = ref("");
const comments = ref("");
const org = ref("");
const channel = ref<Record<string, any>>({});

// Validation rules
const requiredRule = (v: any) => !!v || "Required";
const twitterRule = (v: string) => !v || !!v.match(/^@.*$/) || "@ABC";

function channelURLRule(v: string) {
  const REGEX = /(?:https?:\/\/)(?:www\.)?youtu(?:be\.com\/)(?:channel\/|@)([\w-.]*)$/i;
  const cid = v.match(REGEX);
  return (
    (cid
      && !cid[0].includes("/c/")
      && (cid[1].length > 12 || cid[0].includes("@"))
      && cid[0].startsWith("ht"))
    || t("channelRequest.ChannelURLErrorFeedback")
  );
}

// Computed validations
const linkValidationError = computed(() => {
  if (!link.value || type.value === MODIFY_EXISTING || type.value === DELETE) return "";
  const result = channelURLRule(link.value);
  return result === true ? "" : result;
});

const twitterValidationError = computed(() => {
  if (!twitter.value) return "";
  const result = twitterRule(twitter.value);
  return result === true ? "" : result;
});

const contactValidationError = computed(() => {
  if (type.value !== DELETE || contact.value) return "";
  const result = requiredRule(contact.value);
  return result === true ? "" : result;
});

const langValidationError = computed(() => {
  if (!(type.value === ADD_CLIPPER || type.value === MODIFY_EXISTING) || lang.value) return "";
  const result = requiredRule(lang.value);
  return result === true ? "" : result;
});

// Watchers
watch(type, () => {
  link.value = "";
  channel.value = {};
  english_name.value = "";
  lang.value = "";
  twitter.value = "";
  contact.value = "";
  comments.value = "";
  org.value = "";
});

watch(success, (value) => {
  if (value) setTimeout(() => { success.value = false; }, 2000);
});

watch(error, (value) => {
  if (value) setTimeout(() => { error.value = false; }, 4000);
});

// Methods
function alertText(t_type: string) {
  switch (t_type) {
    case ADD_VTUBER:
      return t("channelRequest.VtuberRequirementText");
    case ADD_CLIPPER:
      return t("channelRequest.ClipperRequirementText");
    case MODIFY_EXISTING:
      return false;
    case DELETE:
      return t("channelRequest.DeletionRequirementText");
    default:
      return false;
  }
}

function isFormValid() {
  if (!type.value) return false;
  if ((type.value === ADD_VTUBER || type.value === ADD_CLIPPER) && channelURLRule(link.value) !== true) return false;
  if ((type.value === ADD_CLIPPER || type.value === MODIFY_EXISTING) && !lang.value) return false;
  if (type.value === DELETE && !contact.value) return false;
  if (twitterRule(twitter.value) !== true) return false;
  if ((type.value === MODIFY_EXISTING || type.value === DELETE) && !channel.value?.id) return false;
  return true;
}

async function onSubmit() {
  let handle = null;
  if (type.value === ADD_VTUBER || type.value === ADD_CLIPPER) {
    const regex = /(?:https?:\/\/)(?:www\.)?youtu(?:be\.com\/)(?:channel\/|@)([\w\-_]*)/gi;
    const matches = [...link.value.matchAll(regex)];
    let id = matches?.[0]?.[1];
    handle = link.value.includes("@");
    id = handle ? `@${id.toLowerCase()}` : id;

    try {
      const exists = id && (await backendApi.channel(id));
      if (exists && exists.data && exists.data.id) {
        router.push({ path: `/channel/${exists.data.id}` });
        return;
      }
    } catch (e) {
      console.error(e);
    }
  }
  if (isFormValid()) {
    const ifValid = (bool: boolean, val: any) => {
      if (bool) return [val];
      return [];
    };
    const body = {
      content: "‌Look what the cat dragged in...",
      embeds: [
        {
          title: "Holodex New Subber Request",
          color: 1955806,
          fields: [
            { name: "Request Type", value: type.value, inline: false },
            {
              name: "Channel Link",
              value: link.value || `https://www.youtube.com/channel/${channel.value.id}`,
              inline: false,
            },
            ...ifValid(english_name.value, {
              name: "Alternate Channel Name (optional)",
              value: english_name.value,
              inline: false,
            }),
            ...ifValid(lang.value, {
              name: "What language is your channel?",
              value: lang.value,
              inline: false,
            }),
            ...ifValid(twitter.value, {
              name: "Twitter Handle (optional)",
              value: twitter.value,
              inline: false,
            }),
            ...ifValid(contact.value, {
              name: "Direct contact",
              value: contact.value,
              inline: false,
            }),
            ...ifValid(org.value || comments.value, {
              name: "Comments",
              value: `[${org.value}] ${comments.value}`,
              inline: false,
            }),
          ],
          footer: {
            text: "Holodex UI",
          },
        },
      ],
    };
    backendApi
      .requestChannel(body)
      .then(() => {
        success.value = true;
        link.value = "";
        channel.value = {};
        english_name.value = "";
        lang.value = "";
        twitter.value = "";
        contact.value = "";
        comments.value = "";
        org.value = "";
      })
      .catch((e) => {
        error.value = true;
        if (e.response && typeof e.response.data === "string") {
          errorMessage.value = e.response.data;
        } else {
          errorMessage.value = e;
        }
      });
  } else {
    error.value = true;
    errorMessage.value = "Some error occurred.";
  }
}
</script>
