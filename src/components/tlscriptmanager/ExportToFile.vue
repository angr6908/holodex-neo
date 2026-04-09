<template>
  <div class="space-y-5 p-6">
    <h2 class="text-center text-lg font-semibold text-white">
      {{ $t("views.tlManager.download") }}
    </h2>
    <label class="block space-y-2">
      <span class="text-sm font-medium text-slate-300">{{ $t("views.tlManager.langPick") }}</span>
      <select
        v-model="TLLang"
        class="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
        @change="reloadEntries"
      >
        <option
          v-for="item in TL_LANGS"
          :key="item.value"
          :value="item"
          class="bg-slate-950"
        >
          {{ item.text + ' (' + item.value + ')' }}
        </option>
      </select>
    </label>
    <p class="text-center text-sm text-slate-400">
      {{ entries.length + " entries, " + profile.length + " profile." }}
    </p>
    <div class="flex flex-wrap justify-center gap-3">
      <UiButton @click="exportSrt">
        .srt
      </UiButton>
      <UiButton @click="exportAss">
        .ass
      </UiButton>
      <UiButton @click="exportTTML">
        .ttml
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import UiButton from "@/components/ui/button/Button.vue";
import { useAppStore } from "@/stores/app";
import backendApi from "@/utils/backend-api";
import { TL_LANGS } from "@/utils/consts";

const props = defineProps({
  videoData: Object,
});

const appStore = useAppStore();

const TLLang = ref(TL_LANGS[0]);
const entries = ref<any[]>([]);
const profile = ref<any[]>([{
  Name: "Default",
  Prefix: "",
  Suffix: "",
  useCC: false,
  CC: "#000000",
  useOC: false,
  OC: "#000000",
}]);

const userdata = computed(() => appStore.userdata);

function reloadEntries() {
  entries.value = [];
  backendApi.chatHistory((props.videoData as any).id, {
    custom_video_id: (props.videoData as any).custom_video_id,
    lang: (TLLang.value as any).value,
    verified: 0,
    moderator: 0,
    vtuber: 0,
    limit: 100000,
    mode: 1,
    creator_id: userdata.value.user.id,
  }).then(({ status, data }: any) => {
    if (status === 200) {
      const videoData = props.videoData as any;
      const fetchChat = videoData.start_actual
        ? data.filter((e: any) => (e.timestamp >= videoData.start_actual)).map((e: any) => {
          e.timestamp -= videoData.start_actual;
          return e;
        })
        : data.map((e: any) => {
          e.timestamp -= data?.[0]?.timestamp || 0;
          return e;
        });

      for (let i = 0; i < fetchChat.length; i += 1) {
        const dt = {
          id: fetchChat[i].id,
          Time: fetchChat[i].timestamp,
          SText: fetchChat[i].message,
          Profile: 0,
        };

        if (fetchChat[i].duration) {
          entries.value.push({
            ...dt,
            Duration: Number(fetchChat[i].duration),
          });
        } else if (i === fetchChat.length - 1) {
          entries.value.push({
            ...dt,
            Duration: 3000,
          });
        } else {
          entries.value.push({
            ...dt,
            Duration: fetchChat[i + 1].timestamp - fetchChat[i].timestamp,
          });
        }
      }
    }
  }).catch((err: any) => {
    console.error(err);
  });
}

watch(() => props.videoData, () => {
  reloadEntries();
});

onMounted(() => {
  reloadEntries();
});

function stringifyTime(time: number, mode: boolean): string {
  let timeStamp = time;
  let timeString = "";
  let stringTime = 0;
  let tempString = "";

  stringTime = Math.floor(timeStamp / 3600000);
  tempString = stringTime.toString();
  if (tempString.length < 2) tempString = `0${tempString}`;
  timeString += `${tempString}:`;
  timeStamp -= stringTime * 3600000;

  stringTime = Math.floor(timeStamp / 60000);
  tempString = stringTime.toString();
  if (tempString.length < 2) tempString = `0${tempString}`;
  timeString += `${tempString}:`;
  timeStamp -= stringTime * 60000;

  stringTime = Math.floor(timeStamp / 1000);
  tempString = stringTime.toString();
  if (tempString.length < 2) tempString = `0${tempString}`;
  timeString += tempString;
  timeStamp -= stringTime * 1000;

  if (mode) {
    timeString += ",";
  } else {
    timeString += ".";
  }

  timeString += timeStamp.toString();
  return (timeString);
}

function exportAss() {
  const entriesArr = entries.value;
  const profileArr = profile.value;
  let writeStream = "";

  writeStream += "[V4+ Styles]\n";
  writeStream += "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n";

  for (let i = 0; i < profileArr.length; i += 1) {
    writeStream += `Style: ${profileArr[i].Name},Arial,20,&H00`;
    if (profileArr[i].useCC) {
      writeStream += profileArr[i].CC.substring(5, 7) + profileArr[i].CC.substring(3, 5) + profileArr[i].CC.substring(1, 3);
    } else {
      writeStream += "FFFFFF";
    }
    writeStream += ",&H00000000,&H00";
    if (profileArr[i].useOC) {
      writeStream += profileArr[i].OC.substring(5, 7) + profileArr[i].OC.substring(3, 5) + profileArr[i].OC.substring(1, 3);
    } else {
      writeStream += "000000";
    }
    writeStream += ",&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1\n";
  }

  writeStream += "\n[Events]\n";
  writeStream += "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";

  for (let i = 0; i < entriesArr.length; i += 1) {
    writeStream += `Dialogue: 0,${stringifyTime(entriesArr[i].Time, false)},`;
    if (i === entriesArr.length - 1) {
      writeStream += `${stringifyTime(entriesArr[i].Time + 3000, false)},`;
    } else {
      writeStream += `${stringifyTime(entriesArr[i].Time + entriesArr[0].Duration, false)},`;
    }
    writeStream += `${profileArr[entriesArr[i].Profile].Name},`;
    writeStream += `,0,0,0,,${entriesArr[i].SText}\n`;
  }

  const blob = new Blob([writeStream], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${userdata.value.user.username} - ${(props.videoData as any).title}.ass`;
  link.click();
  link.remove();
}

function exportTTML() {
  const entriesArr = entries.value;
  const profileArr = profile.value;
  let writeStream = "";

  writeStream += "<?xml version=\"1.0\" encoding=\"utf-8\"?><timedtext format=\"3\">\n"
    + "\t<head>\n"
    + "\t\t<wp id=\"0\" ap=\"7\" ah=\"0\" av=\"0\" />\n"
    + "\t\t<wp id=\"1\" ap=\"7\" ah=\"50\" av=\"100\" />\n"
    + "\t\t<ws id=\"0\" ju=\"2\" pd=\"0\" sd=\"0\" />\n"
    + "\t\t<ws id=\"1\" ju=\"2\" pd=\"0\" sd=\"0\" />\n\n"
    + "\t\t<pen id=\"0\" sz=\"100\" fc=\"#000000\" fo=\"0\" bo=\"0\" />\n"
    + "\t\t<pen id=\"1\" sz=\"0\" fc=\"#A0AAB4\" fo=\"0\" bo=\"0\" />\n";

  for (let i = 0; i < profileArr.length; i += 1) {
    writeStream += `\t\t<pen id="${((i * 2) + 2).toString()}" sz="100" fc="`;
    writeStream += profileArr[i].useCC ? profileArr[i].CC : "#FFFFFF";
    writeStream += "\" fo=\"254\" et=\"4\" ec=\"";
    writeStream += profileArr[i].useOC ? profileArr[i].OC : "#000000";
    writeStream += "\" />\n";
    writeStream += `\t\t<pen id="${((i * 2) + 3).toString()}" sz="100" fc="`;
    writeStream += profileArr[i].useCC ? profileArr[i].CC : "#FFFFFF";
    writeStream += "\" fo=\"254\" et=\"3\" ec=\"";
    writeStream += profileArr[i].useOC ? profileArr[i].OC : "#000000";
    writeStream += "\" />\n";
  }

  writeStream += "\t</head>\n\n\t<body>\n";

  for (let i = 0; i < entriesArr.length; i += 1) {
    writeStream += `\t\t<p t="${(entriesArr[i].Time + 1).toString()}" d="`;
    if (i === entriesArr.length - 1) {
      writeStream += `${(entriesArr[i].Time + 3001).toString()}`;
    } else {
      writeStream += `${(entriesArr[i].Time + 1 + entriesArr[i].Duration).toString()}`;
    }
    writeStream += "\" wp=\"1\" ws=\"1\"><s p=\"1\"></s><s p=\"";
    writeStream += `${((entriesArr[i].Profile * 2) + 2).toString()}"> ${entriesArr[i].SText} </s><s p="1"></s></p>\n`;

    writeStream += `\t\t<p t="${(entriesArr[i].Time + 1).toString()}" d="`;
    if (i === entriesArr.length - 1) {
      writeStream += `${(entriesArr[i].Time + 3001).toString()}`;
    } else {
      writeStream += `${(entriesArr[i].Time + 1 + entriesArr[i].Duration).toString()}`;
    }
    writeStream += "\" wp=\"1\" ws=\"1\"><s p=\"1\"></s><s p=\"";
    writeStream += `${((entriesArr[i].Profile * 2) + 3).toString()}"> ${entriesArr[i].SText} </s><s p="1"></s></p>\n`;
  }

  writeStream += "\t</body>\n</timedtext>";

  const blob = new Blob([writeStream], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${userdata.value.user.username} - ${(props.videoData as any).title}.ttml`;
  link.click();
  link.remove();
}

function exportSrt() {
  const entriesArr = entries.value;
  let writeStream = "";

  for (let i = 0; i < entriesArr.length; i += 1) {
    writeStream += `${(i + 1).toString()}\n`;
    writeStream += `${stringifyTime(entriesArr[i].Time, true)} --> `;
    if (i === entriesArr.length - 1) {
      writeStream += `${stringifyTime(entriesArr[i].Time + 3000, true)}\n`;
    } else {
      writeStream += `${stringifyTime(entriesArr[i].Time + entriesArr[i].Duration, true)}\n`;
    }
    writeStream += `${entriesArr[i].SText}\n\n`;
  }

  const blob = new Blob([writeStream], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${userdata.value.user.username} - ${(props.videoData as any).title}.srt`;
  link.click();
  link.remove();
}
</script>
