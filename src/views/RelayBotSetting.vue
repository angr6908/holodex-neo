<template>
  <section class="space-y-6 px-4 py-6">
    <header class="space-y-2">
      <h1 class="text-3xl font-semibold tracking-tight text-white">
        Relay Bot
      </h1>
      <p class="max-w-3xl text-sm text-slate-400">
        Manage Discord relay targets, subscriptions, and translator allowlists from the migrated settings panel.
      </p>
    </header>

    <UiCard v-if="!loggedIn" class-name="flex flex-col items-center justify-center gap-4 p-10 text-center sm:flex-row">
      <UiButton as="a" :href="discordOAuth2Links">
        Login Discord
      </UiButton>
      <UiButton
        as="a"
        variant="secondary"
        :href="botInviteLink"
        target="_blank"
        rel="noopener noreferrer"
      >
        Invite Bot
      </UiButton>
    </UiCard>

    <div v-else class="grid gap-6 xl:grid-cols-[0.9fr_0.9fr_1.5fr]">
      <UiCard class-name="flex min-h-[32rem] flex-col p-4">
        <div class="border-b border-white/10 px-2 pb-3 text-center text-lg font-semibold text-white">
          Servers
        </div>
        <div class="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
          <button
            v-for="(guild, index) in guilds"
            :key="'g' + index"
            type="button"
            class="w-full rounded-xl border px-3 py-2 text-left text-sm transition"
            :class="selectedGuild === index ? 'border-sky-400/60 bg-sky-400/12 text-white' : 'border-white/10 bg-white/4 text-slate-200 hover:bg-white/8'"
            @click="loadChannel(index)"
          >
            {{ guild.name }}
          </button>
        </div>
        <p class="mt-4 text-xs leading-5 text-slate-500">
          Server not shown if you have insufficient privilege (admin or kick/ban people).
        </p>
      </UiCard>

      <UiCard
        v-if="selectedGuildData"
        class-name="flex min-h-[32rem] flex-col p-4"
      >
        <div class="border-b border-white/10 px-2 pb-3 text-center text-lg font-semibold text-white">
          {{ selectedGuildData.bot ? `Channels (${selectedGuildData.name})` : selectedGuildData.name }}
        </div>

        <div
          v-if="!selectedGuildData.bot"
          class="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center"
        >
          <p class="text-sm text-slate-300">
            Bot is not in this server.
          </p>
          <UiButton
            as="a"
            :href="botInviteLink"
            target="_blank"
            rel="noopener noreferrer"
          >
            Invite Bot
          </UiButton>
        </div>

        <div v-else class="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
          <button
            v-for="(channel, index) in channels"
            :key="'c' + index"
            type="button"
            class="w-full rounded-xl border px-3 py-2 text-left text-sm transition"
            :class="selectedChannel === index ? 'border-sky-400/60 bg-sky-400/12 text-white' : 'border-white/10 bg-white/4 text-slate-200 hover:bg-white/8'"
            @click="loadSetting(index)"
          >
            {{ channel.name }}
          </button>
        </div>
      </UiCard>

      <UiCard
        v-if="selectedChannelData"
        class-name="space-y-6 p-5"
      >
        <div>
          <h2 class="text-lg font-semibold text-white">
            {{ `Setting (${selectedChannelData.name})` }}
          </h2>
        </div>

        <section class="space-y-3">
          <div class="space-y-2">
            <label class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Youtube Link (Channel/Video)
            </label>
            <UiInput v-model="relayInput" />
          </div>
          <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <label class="space-y-2">
              <span class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Lang</span>
              <select
                v-model="langRelayInput"
                class="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
              >
                <option
                  v-for="item in TL_LANGS"
                  :key="item.value"
                  :value="item"
                  class="bg-slate-950"
                >
                  {{ item.text }} ({{ item.value }})
                </option>
              </select>
            </label>
            <UiButton class-name="self-end" @click="triggerRelay">
              Relay TL
            </UiButton>
          </div>
        </section>

        <section class="space-y-3 border-t border-white/10 pt-6">
          <h3 class="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
            Relay Subscription
          </h3>
          <div class="space-y-2">
            <label class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Youtube Channel
            </label>
            <UiInput v-model="channelInpt" />
          </div>
          <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <label class="space-y-2">
              <span class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Lang</span>
              <select
                v-model="langInpt"
                class="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
              >
                <option
                  v-for="item in TL_LANGS"
                  :key="item.value"
                  :value="item"
                  class="bg-slate-950"
                >
                  {{ item.text }} ({{ item.value }})
                </option>
              </select>
            </label>
            <UiButton class-name="self-end" @click="addSetting">
              <UiIcon :icon="mdiPlusCircle" size="sm" />
              Add Subscription
            </UiButton>
          </div>
        </section>

        <section class="space-y-3 border-t border-white/10 pt-6">
          <div class="overflow-hidden rounded-2xl border border-white/10">
            <table class="min-w-full text-sm">
              <thead class="bg-white/6 text-left text-slate-300">
                <tr>
                  <th class="px-4 py-3 font-medium">
                    Subscribed Channel
                  </th>
                  <th class="px-4 py-3 font-medium">
                    Lang
                  </th>
                  <th class="px-4 py-3 font-medium text-right">
                    Remove
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(set, index) in setting"
                  :key="'s' + index"
                  class="cursor-pointer border-t border-white/8 transition hover:bg-white/6"
                  :class="selectedSetting === index ? 'bg-sky-400/10' : ''"
                  @click="selectSetting(index)"
                >
                  <td class="px-4 py-3 text-slate-200">
                    {{ set.link }}
                  </td>
                  <td class="px-4 py-3 text-slate-300">
                    {{ set.lang }}
                  </td>
                  <td class="px-4 py-3 text-right">
                    <UiButton
                      variant="ghost"
                      size="sm"
                      @click.stop="selectedSetting = -1; setting.splice(index, 1)"
                    >
                      <UiIcon :icon="mdiMinusCircle" size="sm" />
                    </UiButton>
                  </td>
                </tr>
                <tr v-if="setting.length === 0">
                  <td colspan="3" class="px-4 py-6 text-center text-slate-500">
                    No subscriptions configured.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section
          v-if="selectedSetting >= 0 && selectedSetting < setting.length"
          class="grid gap-4 border-t border-white/10 pt-6 lg:grid-cols-2"
        >
          <UiCard class-name="space-y-4 border border-white/10 p-4">
            <h3 class="text-base font-semibold text-white">
              Blacklist
            </h3>
            <div class="overflow-hidden rounded-2xl border border-white/10">
              <table class="min-w-full text-sm">
                <thead class="bg-white/6 text-left text-slate-300">
                  <tr>
                    <th class="px-4 py-3 font-medium">
                      Translator Name
                    </th>
                    <th class="px-4 py-3 font-medium text-right">
                      Remove
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(dt, index) in setting[selectedSetting].blacklist"
                    :key="'bl' + index"
                    class="border-t border-white/8"
                  >
                    <td class="px-4 py-3 text-slate-200">
                      {{ dt }}
                    </td>
                    <td class="px-4 py-3 text-right">
                      <UiButton
                        variant="ghost"
                        size="sm"
                        @click="setting[selectedSetting].blacklist.splice(index, 1)"
                      >
                        <UiIcon :icon="mdiMinusCircle" size="sm" />
                      </UiButton>
                    </td>
                  </tr>
                  <tr v-if="setting[selectedSetting].blacklist.length === 0">
                    <td colspan="2" class="px-4 py-4 text-center text-slate-500">
                      No blacklist entries.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="flex gap-2">
              <UiInput
                v-model="blacklistInput"
                placeholder="Translator Name"
                @keypress.enter="addBlacklist"
              />
              <UiButton variant="secondary" @click="addBlacklist">
                <UiIcon :icon="mdiPlusCircle" size="sm" />
              </UiButton>
            </div>
          </UiCard>

          <UiCard class-name="space-y-4 border border-white/10 p-4">
            <h3 class="text-base font-semibold text-white">
              Whitelist
            </h3>
            <div class="overflow-hidden rounded-2xl border border-white/10">
              <table class="min-w-full text-sm">
                <thead class="bg-white/6 text-left text-slate-300">
                  <tr>
                    <th class="px-4 py-3 font-medium">
                      Translator Name
                    </th>
                    <th class="px-4 py-3 font-medium text-right">
                      Remove
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(dt, index) in setting[selectedSetting].whitelist"
                    :key="'wl' + index"
                    class="border-t border-white/8"
                  >
                    <td class="px-4 py-3 text-slate-200">
                      {{ dt }}
                    </td>
                    <td class="px-4 py-3 text-right">
                      <UiButton
                        variant="ghost"
                        size="sm"
                        @click="setting[selectedSetting].whitelist.splice(index, 1)"
                      >
                        <UiIcon :icon="mdiMinusCircle" size="sm" />
                      </UiButton>
                    </td>
                  </tr>
                  <tr v-if="setting[selectedSetting].whitelist.length === 0">
                    <td colspan="2" class="px-4 py-4 text-center text-slate-500">
                      No whitelist entries.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="flex gap-2">
              <UiInput
                v-model="whitelistInput"
                placeholder="Translator Name"
                @keypress.enter="addWhitelist"
              />
              <UiButton variant="secondary" @click="addWhitelist">
                <UiIcon :icon="mdiPlusCircle" size="sm" />
              </UiButton>
            </div>
          </UiCard>
        </section>

        <section class="border-t border-white/10 pt-6">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <UiButton @click="saveSetting">
              Save
            </UiButton>
            <p class="text-sm text-slate-400">
              {{ saveNotif }}
            </p>
          </div>
        </section>
      </UiCard>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRoute } from "vue-router";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import UiInput from "@/components/ui/input/Input.vue";
import backendApi from "@/utils/backend-api";
import { TL_LANGS } from "@/utils/consts";
import { mdiPlusCircle, mdiMinusCircle } from "@mdi/js";
import { getVideoIDFromUrl } from "@/utils/functions";
import { useMetaTitle } from "@/composables/useMetaTitle";

const route = useRoute();

useMetaTitle(() => "RelayBot - Holodex");

const loggedIn = ref(false);
const accessToken = ref("");
const guilds = ref<any[]>([]);
const channels = ref<any[]>([]);
const setting = ref<any[]>([]);
const channelInpt = ref("");
const langInpt = ref(TL_LANGS[0]);
const selectedGuild = ref(-1);
const selectedChannel = ref(-1);
const saveNotif = ref("");
const selectedSetting = ref(-1);
const blacklistInput = ref("");
const whitelistInput = ref("");
const relayInput = ref("");
const langRelayInput = ref(TL_LANGS[0]);

const botInviteLink = computed(() => "https://discord.com/api/oauth2/authorize?client_id=826055534318583858&permissions=274877910016&scope=bot%20applications.commands");

const discordOAuth2Links = computed(() => {
   
  switch (location.hostname) {
    case "localhost": return ("https://discord.com/api/oauth2/authorize?client_id=826055534318583858&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2Frelaybot&response_type=code&scope=guilds%20identify");
    case "staging.holodex.net": return ("https://discord.com/api/oauth2/authorize?client_id=826055534318583858&redirect_uri=https%3A%2F%2Fstaging.holodex.net%2Frelaybot&response_type=code&scope=guilds%20identify");
    case "holodex.net": return ("https://discord.com/api/oauth2/authorize?client_id=826055534318583858&redirect_uri=https%3A%2F%2Fholodex.net%2Frelaybot&response_type=code&scope=guilds%20identify");
    default: {
      const redirectUri = encodeURIComponent(window.location.origin + "/relaybot");
      return `https://discord.com/api/oauth2/authorize?client_id=826055534318583858&redirect_uri=${redirectUri}&response_type=code&scope=guilds%20identify`;
    }
  }
});

const selectedGuildData = computed(() => selectedGuild.value >= 0 ? guilds.value[selectedGuild.value] : null);

const selectedChannelData = computed(() => selectedChannel.value >= 0 ? channels.value[selectedChannel.value] : null);

function init() {
  loggedIn.value = false;
  if (!route.query.code) {
    loggedIn.value = false;
    return;
  }

  let mode = 3;
   
  switch (location.hostname) {
    case "localhost":
      mode = 0;
      break;
    case "staging.holodex.net":
      mode = 1;
      break;
    case "holodex.net":
      mode = 2;
      break;
    default:
      // Custom domain — use the same mode as production
      mode = 2;
      break;
  }

  backendApi.relayBotLogin(route.query.code, mode).then(({ status, data }) => {
    if (status === 200) {
      selectedChannel.value = -1;
      selectedGuild.value = -1;
      loggedIn.value = true;
      accessToken.value = data.access_token;
      guilds.value = data.guilds.filter((e) => e.admin).map((e) => ({
        id: e.id,
        name: e.name,
        bot: false,
      }));
      checkGuild();
    }
  }).catch(() => {
    loggedIn.value = false;
  });
}

function checkGuild() {
  backendApi.relayBotCheckBotPresence(guilds.value.map((e) => e.id)).then(({ status, data }) => {
    if (status === 200) {
      guilds.value = guilds.value.map((e) => {
        e.bot = data.includes(e.id);
        return e;
      });
    }
  }).catch(() => {
    loggedIn.value = false;
  });
}

function loadChannel(index) {
  channels.value = [];
  selectedGuild.value = index;
  selectedChannel.value = -1;

  if (guilds.value[selectedGuild.value].bot) {
    backendApi.relayBotGetChannels(guilds.value[selectedGuild.value].id).then(({ status, data }) => {
      if (status === 200) {
        channels.value = data.map((e) => ({
          id: e.id,
          name: e.name,
        }));
      }
    }).catch((err) => {
      console.error(err);
    });
  }
}

function selectSetting(index) {
  selectedSetting.value = index;
  blacklistInput.value = "";
  whitelistInput.value = "";
}

function addBlacklist() {
  if (blacklistInput.value.trim() !== "") {
    if (!setting.value[selectedSetting.value].blacklist.includes(blacklistInput.value.trim())) {
      setting.value[selectedSetting.value].blacklist.push(blacklistInput.value.trim());
      setting.value[selectedSetting.value].whitelist = setting.value[selectedSetting.value].whitelist.filter((e) => e !== blacklistInput.value.trim());
    } else {
      blacklistInput.value = "";
    }
  }
}

function addWhitelist() {
  if (whitelistInput.value.trim() !== "") {
    if (!setting.value[selectedSetting.value].whitelist.includes(whitelistInput.value.trim())) {
      setting.value[selectedSetting.value].whitelist.push(whitelistInput.value.trim());
      setting.value[selectedSetting.value].blacklist = setting.value[selectedSetting.value].blacklist.filter((e) => e !== whitelistInput.value.trim());
    } else {
      whitelistInput.value = "";
    }
  }
}

function loadSetting(index) {
  selectedChannel.value = index;
  channelInpt.value = "";
  selectedSetting.value = -1;

  langInpt.value = {
    text: TL_LANGS[0].text,
    value: TL_LANGS[0].value,
  };
  langRelayInput.value = {
    text: TL_LANGS[0].text,
    value: TL_LANGS[0].value,
  };

  saveNotif.value = "";
  setting.value = [];
  backendApi.relayBotGetSettingChannel(channels.value[selectedChannel.value].id).then(({ status, data }) => {
    if (status === 200) {
      setting.value = data.SubChannel ? data.SubChannel.map((e) => {
        if (!e.lang) { e.lang = "en"; }
        if (!e.whitelist) { e.whitelist = []; }
        if (!e.blacklist) { e.blacklist = []; }
        return e;
      }) : [];
    }
  }).catch((err) => {
    console.error(err);
  });
}

function validateChannel(channelUrl) {
  if (channelUrl.indexOf("https://www.youtube.com/channel/") !== 0) {
    return undefined;
  }
  return (((channelUrl.indexOf("?") !== -1) ? channelUrl.slice(0, channelUrl.indexOf("?")) : channelUrl).slice(("https://www.youtube.com/channel/").length));
}

function addSetting() {
  if (validateChannel(channelInpt.value)) {
    const setPush = {
      link: `YT_${validateChannel(channelInpt.value)}`,
      lang: langInpt.value.value,
    };
    if (setting.value.filter((e) => (e.link === setPush.link) && (e.lang === setPush.lang)).length === 0) {
      setting.value.push(setPush);
    }
    channelInpt.value = "";
    langInpt.value = {
      text: TL_LANGS[0].text,
      value: TL_LANGS[0].value,
    };
  }
}

function saveSetting() {
  saveNotif.value = "Saving...";
  backendApi.relayBotSubmitData(channels.value[selectedChannel.value].id, setting.value).then(({ status }) => {
    if (status === 200) {
      saveNotif.value = "Saved!!";
    }
  }).catch((err) => {
    saveNotif.value = err;
  });
}

function triggerRelay() {
  let mode = 0;
  let link = relayInput.value;

  if (getVideoIDFromUrl(link)) {
    relayInput.value = "Sending trigger...";
    mode = 1;
    link = `YT_${getVideoIDFromUrl(link).id}`;
    backendApi.relayBotTrigger(channels.value[selectedChannel.value].id, mode, link, langRelayInput.value.value).then(({ status }) => {
      if (status === 200) {
        relayInput.value = "Ok!!";
      }
    }).catch(() => {
      relayInput.value = "Not Ok!!";
    });
  } else if (validateChannel(link)) {
    relayInput.value = "Sending trigger...";
    mode = 2;
    link = `YT_${validateChannel(link)}`;
    backendApi.relayBotTrigger(channels.value[selectedChannel.value].id, mode, link, langRelayInput.value.value).then(({ status }) => {
      if (status === 200) {
        relayInput.value = "Ok!!";
      }
    }).catch(() => {
      relayInput.value = "Not Ok!!";
    });
  }
}

watch(() => route.query.code, () => {
  if ((route.name === "relaybot") && route.query.code) {
    init();
  }
});

onMounted(() => {
  init();
});
</script>
