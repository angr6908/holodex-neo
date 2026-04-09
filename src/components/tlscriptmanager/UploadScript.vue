<template>
  <div class="space-y-5 p-6">
    <div>
      <h2 class="text-lg font-semibold text-white">
        {{ $t("views.watch.uploadPanel.title") }}
      </h2>
      <p class="mt-2 text-sm text-slate-400">
        {{ $t("views.watch.uploadPanel.usernameText") + ' : ' + userdata.user.username + ' ' }}
        <a class="underline underline-offset-4 hover:text-sky-300" @click="changeUsernameClick()">{{ $t("views.watch.uploadPanel.usernameChange") }}</a>
      </p>
    </div>

    <div class="space-y-2">
      <label class="block text-sm font-medium text-slate-300">Subtitle file</label>
      <div class="flex items-center gap-3 rounded-[calc(var(--radius)+6px)] border border-white/10 bg-white/4 px-4 py-3">
        <UiIcon :icon="mdiFileDocument" size="sm" class-name="text-slate-400" />
        <input
          ref="fileInput"
          accept=".ass,.TTML,.srt,.ttml"
          type="file"
          class="w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/15"
          @change="handleFileInput"
        >
      </div>
    </div>

    <p class="text-sm text-slate-400">
      {{ notifText }}
    </p>

    <label class="block space-y-2">
      <span class="text-sm font-medium text-slate-300">{{ $t("views.tlManager.langPick") }}</span>
      <select
        v-model="TLLang"
        class="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
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

    <div
      v-if="entries.length > 0"
      class="overflow-hidden rounded-[calc(var(--radius)+6px)] border border-white/10"
    >
      <div class="max-h-[40vh] overflow-auto">
        <table class="min-w-full text-sm">
          <thead class="sticky top-0 bg-slate-950/95 backdrop-blur">
            <tr class="border-b border-white/10 text-left text-slate-300">
              <th class="px-4 py-3 font-medium">
                {{ $t("views.watch.uploadPanel.headerStart") }}
              </th>
              <th class="px-4 py-3 font-medium">
                {{ $t("views.watch.uploadPanel.headerEnd") }}
              </th>
              <th class="px-4 py-3 font-medium">
                {{ $t("views.watch.uploadPanel.headerText") }}
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(entry, index) in entries" :key="index">
              <Entrytr
                :time="entry.timestamp"
                :duration="entry.duration"
                :stext="entry.message"
                :cc="entry.cc ? entry.cc : ''"
                :oc="entry.oc ? entry.oc : ''"
              />
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <UiButton variant="ghost" @click="$emit('close', {upload: false})">
        {{ $t("views.watch.uploadPanel.cancelBtn") }}
      </UiButton>

      <UiButton
        variant="destructive"
        class-name="ml-auto"
        :disabled="!parsed"
        @click="sendData()"
      >
        {{ $t("views.scriptEditor.importFile.overwriteBtn") }}
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import UiButton from "@/components/ui/button/Button.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";
import { mdiFileDocument } from "@mdi/js";
import Entrytr from "@/components/tlscriptmanager/Entrytr.vue";
import { useAppStore } from "@/stores/app";
import backendApi from "@/utils/backend-api";
import { TL_LANGS } from "@/utils/consts";
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

const { t } = useI18n();
const router = useRouter();
const appStore = useAppStore();

const props = defineProps<{
  videoData: any;
}>();

const emit = defineEmits<{
  (e: "close", payload: { upload: boolean }): void;
}>();

const fileInput = ref<HTMLInputElement | null>(null);
const parsed = ref(false);
const entries = ref<any[]>([]);
const profileContainer = ref<any[]>([]);
const notifText = ref("");
const TLLang = ref(TL_LANGS[0]);

const userdata = computed(() => appStore.userdata);

const startTime = computed(() => {
  if (!props.videoData.start_actual) {
    return Date.parse(props.videoData.available_at);
  }
  if (Number.isNaN(Number(props.videoData.start_actual))) {
    return Date.parse(props.videoData.start_actual);
  }
  return props.videoData.start_actual;
});

watch(() => props.videoData, () => {
  if (fileInput.value) {
    fileInput.value.value = "";
  }
  parsed.value = false;
  notifText.value = "";
  entries.value = [];
});

function handleFileInput(event: Event) {
  const file = (event?.target as HTMLInputElement)?.files?.[0];
  fileChange(file);
}

function changeUsernameClick() {
  router.push({ path: "/user" });
}

function fileChange(e: File | undefined) {
  parsed.value = false;
  entries.value = [];
  profileContainer.value = [];
  notifText.value = "";
  if (!e) {
    return;
  }
  notifText.value = t("views.watch.uploadPanel.notifTextParsing");
  const reader = new FileReader();

  if ((/\.ass$/i).test(e.name)) {
    reader.onload = (res) => {
      parseAss((res.target as FileReader).result as string);
    };
    reader.readAsText(e);
  } else if ((/\.srt$/i).test(e.name)) {
    reader.onload = (res) => {
      parseSrt((res.target as FileReader).result as string);
    };
    reader.readAsText(e);
  } else if ((/\.ttml$/i).test(e.name)) {
    reader.onload = (res) => {
      parseTtml((res.target as FileReader).result as string);
    };
    reader.readAsText(e);
  } else {
    notifText.value = t("views.watch.uploadPanel.notifTextErrExt");
  }
}

function parseAss(dataFeed: string) {
  const res = dataFeed.split("\n");
  let fail = true;
  let lineSplit: string[];
  let locationIndex: number[];
  let dataLength: number;

  for (let index = 0; index < res.length; index += 1) {
    if (res[index].search(/\[V4\+ Styles\]/gi) !== -1) {
      index += 1;
      if (res[index].search(/^Format/gi) !== -1) {
        lineSplit = res[index].split(":")[1].split(",").map((e) => e.trim());
        locationIndex = [];
        dataLength = lineSplit.length;

        if (lineSplit.indexOf("Name") !== -1) {
          locationIndex.push(lineSplit.indexOf("Name"));
        }
        if (lineSplit.indexOf("PrimaryColour") !== -1) {
          locationIndex.push(lineSplit.indexOf("PrimaryColour"));
        }
        if (lineSplit.indexOf("OutlineColour") !== -1) {
          locationIndex.push(lineSplit.indexOf("OutlineColour"));
        }

        if (locationIndex.length === 3) {
          fail = false;
          for (index += 1; index < res.length; index += 1) {
            if (res[index].search(/^Style/gi) !== -1) {
              lineSplit = res[index].split(":")[1].split(",").map((e) => e.trim());
              if (lineSplit.length === dataLength) {
                if ((lineSplit[locationIndex[1]].length === 10) && (lineSplit[locationIndex[2]].length === 10)) {
                  profileContainer.value.push({
                    Name: lineSplit[locationIndex[0]].trim(),
                    CC: lineSplit[locationIndex[1]].trim().slice(8, 10) + lineSplit[locationIndex[1]].trim().slice(6, 8) + lineSplit[locationIndex[1]].trim().slice(4, 6),
                    OC: lineSplit[locationIndex[2]].trim().slice(8, 10) + lineSplit[locationIndex[2]].trim().slice(6, 8) + lineSplit[locationIndex[2]].trim().slice(4, 6),
                  });
                } else {
                  fail = true;
                  index = res.length;
                }
              } else {
                fail = true;
                index = res.length;
              }
            } else {
              index = res.length;
            }
          }
        } else {
          index = res.length;
        }
      } else {
        index = res.length;
      }
    }
  }

  if (fail) {
    notifText.value = t("views.watch.uploadPanel.notifTextErr");
    return;
  }
  fail = true;

  for (let index = 0; index < res.length; index += 1) {
    if (res[index].search(/\[Events\]/gi) !== -1) {
      index += 1;
      if (res[index].search(/^Format/gi) !== -1) {
        lineSplit = res[index].split(":")[1].split(",").map((e) => e.trim());
        locationIndex = [];
        dataLength = lineSplit.length;

        if (lineSplit.indexOf("Start") !== -1) {
          locationIndex.push(lineSplit.indexOf("Start"));
        }
        if (lineSplit.indexOf("End") !== -1) {
          locationIndex.push(lineSplit.indexOf("End"));
        }
        if (lineSplit.indexOf("Style") !== -1) {
          locationIndex.push(lineSplit.indexOf("Style"));
        }
        if (lineSplit.indexOf("Text") !== -1) {
          locationIndex.push(lineSplit.indexOf("Text"));
        }

        if (locationIndex.length === 4) {
          fail = false;
          for (index += 1; index < res.length; index += 1) {
            if (res[index].search(/^Dialogue/gi) !== -1) {
              lineSplit = res[index].split("Dialogue:")[1].split(",");
              if (lineSplit.length >= dataLength) {
                for (let index2 = 0; index2 < profileContainer.value.length; index2 += 1) {
                  if (lineSplit[locationIndex[2]].trim() === profileContainer.value[index2].Name) {
                    let textSend = lineSplit[locationIndex[3]];
                    for (let z = locationIndex[3] + 1; z < lineSplit.length; z += 1) {
                      textSend += `,${lineSplit[z]}`;
                    }

                    const timeSplit = lineSplit[locationIndex[0]].trim().split(":");
                    let msShift = timeSplit[2].split(".")[1];
                    if (msShift.length === 2) {
                      msShift += "0";
                    } else if (msShift.length === 1) {
                      msShift += "00";
                    }
                    const startTimeMs = Number.parseInt(timeSplit[0], 10) * 60 * 60 * 1000 + Number.parseInt(timeSplit[1], 10) * 60 * 1000 + Number.parseInt(timeSplit[2].split(".")[0], 10) * 1000 + Number.parseInt(msShift, 10);

                    const timeSplit2 = lineSplit[locationIndex[1]].trim().split(":");
                    let msShift2 = timeSplit2[2].split(".")[1];
                    if (msShift2.length === 2) {
                      msShift2 += "0";
                    } else if (msShift2.length === 1) {
                      msShift2 += "00";
                    }
                    const endTimeMs = Number.parseInt(timeSplit2[0], 10) * 60 * 60 * 1000 + Number.parseInt(timeSplit2[1], 10) * 60 * 1000 + Number.parseInt(timeSplit2[2].split(".")[0], 10) * 1000 + Number.parseInt(msShift2, 10);

                    entries.value.push({
                      message: textSend,
                      timestamp: startTimeMs,
                      duration: endTimeMs - startTimeMs,
                    });
                    break;
                  }
                }
              } else {
                index = res.length;
              }
            } else {
              index = res.length;
            }
          }
        } else {
          index = res.length;
        }
      } else {
        index = res.length;
      }
    }
  }

  if (fail) {
    notifText.value = t("views.watch.uploadPanel.notifTextErr");
  } else {
    notifText.value = `Parsed ASS file, ${profileContainer.value.length} profiles, ${entries.value.length} Entries.`;
    parsed.value = true;
  }
}

function parseTtml(dataFeed: string) {
  let fail = true;
  let startIndex: number;
  let endIndex: number;
  let penEnd: number;
  let target: number;
  let endTarget: number;

  if ((dataFeed.indexOf("<head>") !== -1) && (dataFeed.indexOf("</head>") !== -1)) {
    startIndex = dataFeed.indexOf("<head>");
    endIndex = dataFeed.indexOf("</head>");

    fail = false;

    for (let penStart = dataFeed.indexOf("<pen", startIndex); penStart < endIndex; penStart = dataFeed.indexOf("<pen", penStart)) {
      if (penStart === -1) {
        break;
      }

      penEnd = dataFeed.indexOf(">", penStart);
      target = -1;
      endTarget = -1;
      const tempProfileContainer: any = {
        Name: "",
        CC: "",
        OC: "",
      };

      if ((penEnd > endIndex) || (penEnd === -1)) {
        fail = true;
        break;
      }

      target = dataFeed.indexOf("id=\"", penStart);
      if ((target > penEnd) || (target === -1)) {
        fail = true;
        break;
      }
      endTarget = dataFeed.indexOf("\"", target + 4);
      if ((endTarget > penEnd) || (endTarget === -1)) {
        fail = true;
        break;
      }
      tempProfileContainer.Name = dataFeed.substring(target + 4, endTarget);

      target = dataFeed.indexOf("fc=\"", penStart);
      if ((target === -1) || (target > penEnd)) {
        tempProfileContainer.CC = "";
      } else {
        endTarget = dataFeed.indexOf("\"", target + 5);
        if ((endTarget > penEnd) || (endTarget === -1)) {
          fail = true;
          break;
        }
        tempProfileContainer.CC = dataFeed.substring(target + 5, endTarget);
      }

      target = dataFeed.indexOf("ec=\"", penStart);
      if ((target === -1) || (target > penEnd)) {
        tempProfileContainer.OC = "";
      } else {
        endTarget = dataFeed.indexOf("\"", target + 5);
        if ((endTarget > penEnd) || (endTarget === -1)) {
          fail = true;
          break;
        }
        tempProfileContainer.OC = dataFeed.substring(target + 5, endTarget);
      }

      profileContainer.value.push(tempProfileContainer);
      penStart = penEnd;
    }
  }

  if (fail) {
    notifText.value = t("views.watch.uploadPanel.notifTextErr");
    return;
  }
  fail = true;

  if ((dataFeed.indexOf("<body>") !== -1) && (dataFeed.indexOf("</body>") !== -1)) {
    startIndex = dataFeed.indexOf("<body>");
    endIndex = dataFeed.indexOf("</body>");
    const entryContainer = {
      message: "",
      timestamp: 0,
      duration: 0,
      CC: undefined as string | undefined,
      OC: undefined as string | undefined,
    };

    fail = false;

    for (let penStart = dataFeed.indexOf("<p", startIndex); penStart < endIndex; penStart = dataFeed.indexOf("<p", penStart)) {
      if (penStart === -1) {
        break;
      }

      penEnd = dataFeed.indexOf("</p>", penStart);

      if ((penEnd > endIndex) || (penEnd === -1)) {
        fail = true;
        break;
      }

      let startClosure = -1;
      let endClosure = -1;
      target = -1;
      endTarget = -1;
      let target2 = -1;
      let endTarget2 = -1;

      startClosure = penStart;
      endClosure = dataFeed.indexOf(">", startClosure);
      if ((endClosure === -1) || (endClosure > penEnd)) {
        fail = true;
        break;
      }

      target = dataFeed.indexOf("t=\"", startClosure);
      if ((target > endClosure) || (target === -1)) {
        fail = true;
        break;
      }
      endTarget = dataFeed.indexOf("\"", target + 3);
      if ((endTarget > endClosure) || (endTarget === -1)) {
        fail = true;
        break;
      }

      target2 = dataFeed.indexOf("d=\"", startClosure);
      if ((target2 > endClosure) || (target2 === -1)) {
        fail = true;
        break;
      }
      endTarget2 = dataFeed.indexOf("\"", target2 + 3);
      if ((endTarget2 > endClosure) || (endTarget2 === -1)) {
        fail = true;
        break;
      }

      if (Number.isNaN(Number.parseInt(dataFeed.substring(target + 3, endTarget), 10)) || Number.isNaN(Number.parseInt(dataFeed.substring(target2 + 3, endTarget2), 10))) {
        fail = true;
        break;
      } else if (entryContainer.timestamp !== Number.parseInt(dataFeed.substring(target + 3, endTarget), 10)) {
        entryContainer.timestamp = Number.parseInt(dataFeed.substring(target + 3, endTarget), 10);
        entryContainer.duration = Number.parseInt(dataFeed.substring(target2 + 3, endTarget2), 10) - entryContainer.timestamp;

        startClosure = endClosure;
        for (startClosure = dataFeed.indexOf("<s", startClosure); startClosure < penEnd; startClosure = dataFeed.indexOf("<s", startClosure)) {
          if (startClosure === -1) {
            break;
          }

          endClosure = dataFeed.indexOf(">", startClosure);
          if ((endClosure === -1) || (endClosure > penEnd)) {
            penStart = endIndex;
            fail = true;
            break;
          }

          const spanEnd = dataFeed.indexOf("</s>", endClosure);
          if ((spanEnd === -1) || (spanEnd > penEnd)) {
            penStart = endIndex;
            fail = true;
            break;
          }

          if (dataFeed.substring(endClosure + 1, spanEnd).trim().length > 1) {
            entryContainer.message = dataFeed.substring(endClosure + 1, spanEnd).trim();

            target = dataFeed.indexOf("p=\"", startClosure);
            if ((target > endClosure) || (target === -1)) {
              fail = true;
              break;
            }
            endTarget = dataFeed.indexOf("\"", target + 3);
            if ((endTarget > endClosure) || (endTarget === -1)) {
              fail = true;
              break;
            }

            for (let i = 0; i < profileContainer.value.length; i += 1) {
              if (profileContainer.value[i].Name === dataFeed.substring(target + 3, endTarget)) {
                entries.value.push({
                  message: dataFeed.substring(endClosure + 1, spanEnd).trim(),
                  timestamp: entryContainer.timestamp,
                  duration: entryContainer.duration,
                });
                endClosure = penEnd;
                break;
              }
            }
          }
          startClosure = endClosure;
        }
      }

      if (penStart !== endIndex) {
        penStart = penEnd;
      }
    }
  }

  if (fail) {
    notifText.value = t("views.watch.uploadPanel.notifTextErr");
  } else {
    notifText.value = `Parsed TTML file, ${profileContainer.value.length} colour profiles, ${entries.value.length} Entries.`;
    parsed.value = true;
  }
}

function checkTimeString(testString: string) {
  let timeSplit = testString.split(":");
  if (timeSplit.length !== 3) {
    return false;
  }

  if (Number.isNaN(Number.parseInt(timeSplit[0], 10))) {
    return false;
  }

  if (Number.isNaN(Number.parseInt(timeSplit[1], 10)) || (Number.parseInt(timeSplit[1], 10) > 60)) {
    return false;
  }

  timeSplit = timeSplit[2].split(",");

  if (timeSplit.length !== 2) {
    return false;
  }

  if (Number.isNaN(Number.parseInt(timeSplit[0], 10)) || (Number.parseInt(timeSplit[0], 10) > 60)) {
    return false;
  }

  if (Number.isNaN(Number.parseInt(timeSplit[1], 10)) || (Number.parseInt(timeSplit[1], 10) > 1000)) {
    return false;
  }
  return true;
}

function srtTimeCheck(timeString: string) {
  if (timeString.split("-->").length !== 2) {
    return false;
  }
  if ((checkTimeString(timeString.split("-->")[0].trim())) && (checkTimeString(timeString.split("-->")[1].trim()))) {
    return true;
  }
  return false;
}

function parseTimeString(targetString: string) {
  let res = 0;
  let timeSplit = targetString.split(":");

  res = res + Number.parseInt(timeSplit[0], 10) * 3600000 + Number.parseInt(timeSplit[1], 10) * 60000;
  timeSplit = timeSplit[2].split(",");
  res += Number.parseInt(timeSplit[0], 10) * 1000 + Number.parseInt(timeSplit[1], 10);

  return res;
}

function parseSrt(dataFeed: string) {
  const res = dataFeed.split("\n");
  let write = false;

  for (let index = 0; index < res.length; index += 1) {
    if (srtTimeCheck(res[index])) {
      const srtStartTime = parseTimeString(res[index].split("-->")[0].trim());
      const endTimeMs = parseTimeString(res[index].split("-->")[1].trim());
      let text = "";
      write = true;

      for (index += 1; index < res.length; index += 1) {
        if (srtTimeCheck(res[index])) {
          index -= 1;
          write = false;
          entries.value.push({
            message: text,
            timestamp: srtStartTime,
            duration: endTimeMs - srtStartTime,
          });
          break;
        } else if (res[index] === "") {
          write = false;
          entries.value.push({
            message: text,
            timestamp: srtStartTime,
            duration: endTimeMs - srtStartTime,
          });
          break;
        } else if (index === res.length - 1) {
          if (res[index].trim() !== "") {
            text += res[index];
          }
          write = false;
          entries.value.push({
            message: text,
            timestamp: srtStartTime,
            duration: endTimeMs - srtStartTime,
          });
          break;
        } else if (res[index].trim() !== "") {
          if (write === true) {
            if (text !== "") {
              text = `${text} `;
            }
            text += res[index];
          }
        } else {
          write = false;
        }
      }
    }

    if (index === res.length - 1) {
      notifText.value = `Parsed SRT file, ${entries.value.length} Entries.`;
      parsed.value = true;
    }
  }
}

async function sendData() {
  const processes = await (await backendApi.chatHistory(props.videoData.id, {
    lang: TLLang.value.value,
    verified: 0,
    moderator: 0,
    vtuber: 0,
    limit: 100000,
    mode: 1,
    creator_id: userdata.value.user.id,
  })).data.map((e: any) => ({
    type: "Delete",
    data: {
      id: e.id,
    },
  }));

  for (let idx = 0; idx < entries.value.length; idx += 1) {
    processes.push({
      type: "Add",
      data: {
        tempid: `I${idx}`,
        name: userdata.value.user.username,
        timestamp: Math.floor(startTime.value + entries.value[idx].timestamp),
        message: entries.value[idx].message,
        duration: Math.floor(entries.value[idx].duration),
      },
    });
  }

  backendApi.postTLLog({
    videoId: props.videoData.id,
    jwt: userdata.value.jwt,
    body: processes,
    lang: TLLang.value.value,
  }).then(({ status }: any) => {
    if (status === 200) {
      emit("close", { upload: true });
    }
  }).catch((err: any) => {
    console.error("Upload error:", err);
  });
}
</script>
