<template>
  <UiDialog
    :open="show"
    class-name="max-h-[500px] max-w-[80%]"
    @update:open="show = $event"
  >
    <UiCard class-name="border-0 p-0 shadow-none">
      <div class="space-y-4 p-4">
        <h2 class="text-center text-xl font-semibold text-[color:var(--color-foreground)]">
          {{ $t("views.scriptEditor.menu.importFile") }}
        </h2>

        <label class="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-white/14 bg-white/4 px-4 py-3 text-sm text-[color:var(--color-muted-foreground)] transition hover:border-sky-300/40 hover:bg-white/6">
          <UiIcon :icon="mdiFileDocument" class-name="h-5 w-5 text-[color:var(--color-primary)]" />
          <span class="truncate">{{ selectedFileName || ".ass, .ttml, .srt" }}</span>
          <input
            ref="fileInput"
            accept=".ass,.TTML,.srt"
            type="file"
            class="hidden"
            @change="handleFileInput"
          >
        </label>

        <p class="text-sm text-[color:var(--color-muted-foreground)]">
          {{ notifText }}
        </p>

        <div
          v-if="entries.length > 0"
          class="max-h-[40vh] overflow-auto rounded-xl border border-white/10"
        >
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-slate-950/90 text-left text-xs uppercase tracking-[0.18em] text-[color:var(--color-muted-foreground)]">
              <tr>
                <th class="px-3 py-2">
                  {{ $t("views.watch.uploadPanel.headerStart") }}
                </th>
                <th class="px-3 py-2">
                  {{ $t("views.watch.uploadPanel.headerEnd") }}
                </th>
                <th class="px-3 py-2">
                  {{ $t("views.watch.uploadPanel.headerText") }}
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(entry, index) in entries" :key="index">
                <Entrytr
                  :time="entry.Time"
                  :duration="entry.Duration"
                  :stext="entry.SText"
                  :cc="profile[entry.Profile].useCC ? profile[entry.Profile].CC : ''"
                  :oc="profile[entry.Profile].useOC ? profile[entry.Profile].OC : ''"
                />
              </template>
            </tbody>
          </table>
        </div>

        <div class="flex items-center gap-3">
          <UiButton type="button" variant="ghost" @click="show = false">
            {{ $t("views.tlClient.cancelBtn") }}
          </UiButton>

          <UiButton
            type="button"
            variant="destructive"
            class-name="ml-auto"
            :disabled="!parsed"
            @click="clickOk();"
          >
            {{ $t("views.scriptEditor.importFile.overwriteBtn") }}
          </UiButton>
        </div>
      </div>
    </UiCard>
  </UiDialog>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUpdate } from "vue";
import { useI18n } from "vue-i18n";
import { mdiFileDocument } from "@mdi/js";
import Entrytr from "@/components/tlscriptmanager/Entrytr.vue";
import UiButton from "@/components/ui/button/Button.vue";
import UiCard from "@/components/ui/card/Card.vue";
import UiDialog from "@/components/ui/dialog/Dialog.vue";
import UiIcon from "@/components/ui/icon/Icon.vue";

const props = defineProps({
  value: Boolean,
});

const emit = defineEmits(["input", "bounceDataBack"]);

const { t } = useI18n();

const fileInput = ref<HTMLInputElement | null>(null);
const parsed = ref(false);
const entries = ref<any[]>([]);
const profile = ref<any[]>([]);
const notifText = ref("");
const selectedFileName = ref("");

const show = computed({
  get: () => props.value,
  set: (value) => emit("input", value),
});

onBeforeUpdate(() => {
  if (!show.value) {
    if (fileInput.value) {
      fileInput.value.value = "";
    }
    parsed.value = false;
    notifText.value = "";
    entries.value = [];
    selectedFileName.value = "";
  }
});

function handleFileInput(event: Event) {
  const file = (event?.target as HTMLInputElement)?.files?.[0];
  selectedFileName.value = file?.name || "";
  fileChange(file);
}

function fileChange(e: File | undefined) {
  parsed.value = false;
  entries.value = [];
  profile.value = [];
  notifText.value = "";
  if (!e) {
    return;
  }
  notifText.value = t("views.watch.uploadPanel.notifTextParsing");
  const reader = new FileReader();

  if ((/\.ass$/i).test(e.name)) {
    reader.onload = (res) => {
      parseAss(res.target!.result as string);
    };
    reader.readAsText(e);
  } else if ((/\.srt$/i).test(e.name)) {
    reader.onload = (res) => {
      parseSrt(res.target!.result as string);
    };
    reader.readAsText(e);
  } else if ((/\.ttml$/i).test(e.name)) {
    reader.onload = (res) => {
      parseTtml(res.target!.result as string);
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
        lineSplit = res[index].split(":")[1].split(",").map((e) => (e.trim()));
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
              lineSplit = res[index].split(":")[1].split(",").map((e) => (e.trim()));
              if (lineSplit.length === dataLength) {
                if ((lineSplit[locationIndex[1]].length === 10) && (lineSplit[locationIndex[2]].length === 10)) {
                  profile.value.push({
                    Name: lineSplit[locationIndex[0]].trim(),
                    useCC: true,
                    CC: lineSplit[locationIndex[1]].trim().slice(8, 10) + lineSplit[locationIndex[1]].trim().slice(6, 8) + lineSplit[locationIndex[1]].trim().slice(4, 6),
                    useOC: true,
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
        lineSplit = res[index].split(":")[1].split(",").map((e) => (e.trim()));
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
                for (let index2 = 0; index2 < profile.value.length; index2 += 1) {
                  if (lineSplit[locationIndex[2]].trim() === profile.value[index2].Name) {
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
                    const startTime = Number.parseInt(timeSplit[0], 10) * 60 * 60 * 1000 + Number.parseInt(timeSplit[1], 10) * 60 * 1000 + Number.parseInt(timeSplit[2].split(".")[0], 10) * 1000 + Number.parseInt(msShift, 10);

                    const timeSplit2 = lineSplit[locationIndex[1]].trim().split(":");
                    let msShift2 = timeSplit2[2].split(".")[1];
                    if (msShift2.length === 2) {
                      msShift2 += "0";
                    } else if (msShift2.length === 1) {
                      msShift2 += "00";
                    }
                    const endTime = Number.parseInt(timeSplit2[0], 10) * 60 * 60 * 1000 + Number.parseInt(timeSplit2[1], 10) * 60 * 1000 + Number.parseInt(timeSplit2[2].split(".")[0], 10) * 1000 + Number.parseInt(msShift2, 10);

                    for (let i = 0; i < profile.value.length; i += 1) {
                      if (profile.value[i].Name === lineSplit[locationIndex[2]]) {
                        entries.value.push({
                          SText: textSend,
                          Time: startTime,
                          Duration: endTime - startTime,
                          Profile: i,
                        });
                        break;
                      }
                    }
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
    notifText.value = `Parsed ASS file, ${profile.value.length} profiles, ${entries.value.length} Entries.`;
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
      const tempProfileContainer = {
        Name: "",
        useCC: true,
        CC: "",
        useOC: true,
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

      profile.value.push(tempProfileContainer);
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
      SText: "",
      Time: 0,
      Duration: 0,
      Profile: 0,
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

      //  GET TIME
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
      } else if (entryContainer.Time !== Number.parseInt(dataFeed.substring(target + 3, endTarget), 10)) {
        entryContainer.Time = Number.parseInt(dataFeed.substring(target + 3, endTarget), 10);
        entryContainer.Duration = Number.parseInt(dataFeed.substring(target2 + 3, endTarget2), 10) - entryContainer.Time;

        // LOOK FOR NON EMPTY SPAN
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
            entryContainer.SText = dataFeed.substring(endClosure + 1, spanEnd).trim();

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

            for (let i = 0; i < profile.value.length; i += 1) {
              if (profile.value[i].Name === dataFeed.substring(target + 3, endTarget)) {
                entries.value.push({
                  SText: dataFeed.substring(endClosure + 1, spanEnd).trim(),
                  Time: entryContainer.Time,
                  Duration: entryContainer.Duration,
                  Profile: i,
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
    notifText.value = `Parsed TTML file, ${profile.value.length} colour profiles, ${entries.value.length} Entries.`;
    parsed.value = true;
  }
}

function checkTimeString(testString: string) {
  let timeSplit = testString.split(":");
  if (timeSplit.length !== 3) {
    return (false);
  }

  if (Number.isNaN(Number.parseInt(timeSplit[0], 10))) {
    return (false);
  }

  if (Number.isNaN(Number.parseInt(timeSplit[1], 10)) || (Number.parseInt(timeSplit[1], 10) > 60)) {
    return (false);
  }

  timeSplit = timeSplit[2].split(",");

  if (timeSplit.length !== 2) {
    return (false);
  }

  if (Number.isNaN(Number.parseInt(timeSplit[0], 10)) || (Number.parseInt(timeSplit[0], 10) > 60)) {
    return (false);
  }

  if (Number.isNaN(Number.parseInt(timeSplit[1], 10)) || (Number.parseInt(timeSplit[1], 10) > 1000)) {
    return (false);
  }
  return (true);
}

function srtTimeCheck(timeString: string) {
  if (timeString.split("-->").length !== 2) {
    return (false);
  } if ((checkTimeString(timeString.split("-->")[0].trim())) && (checkTimeString(timeString.split("-->")[1].trim()))) {
    return (true);
  }
  return (false);
}

function parseTimeString(targetString: string) {
  let res = 0;
  let timeSplit = targetString.split(":");

  res = res + Number.parseInt(timeSplit[0], 10) * 3600000 + Number.parseInt(timeSplit[1], 10) * 60000;
  timeSplit = timeSplit[2].split(",");
  res += Number.parseInt(timeSplit[0], 10) * 1000 + Number.parseInt(timeSplit[1], 10);

  return (res);
}

function parseSrt(dataFeed: string) {
  const res = dataFeed.split("\n");
  let write = false;

  profile.value.push({
    Name: "Profile1",
    Prefix: "",
    Suffix: "",
    useCC: false,
    CC: "#000000",
    useOC: false,
    OC: "#000000",
  });

  for (let index = 0; index < res.length; index += 1) {
    if (srtTimeCheck(res[index])) {
      const startTime = parseTimeString(res[index].split("-->")[0].trim());
      const endTime = parseTimeString(res[index].split("-->")[1].trim());
      let text = "";
      write = true;

      for (index += 1; index < res.length; index += 1) {
        if (srtTimeCheck(res[index])) {
          index -= 1;
          write = false;
          entries.value.push({
            SText: text,
            Time: startTime,
            Duration: endTime - startTime,
            Profile: 0,
          });
          break;
        } else if (res[index] === "") {
          write = false;
          entries.value.push({
            SText: text,
            Time: startTime,
            Duration: endTime - startTime,
            Profile: 0,
          });
          break;
        } else if (index === res.length - 1) {
          if (res[index].trim() !== "") {
            text += res[index];
          }
          write = false;
          entries.value.push({
            SText: text,
            Time: startTime,
            Duration: endTime - startTime,
            Profile: 0,
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

function clickOk() {
  emit("bounceDataBack", {
    entriesData: entries.value,
    profileData: profile.value,
  });
  show.value = false;
}
</script>
