"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mdiFileDocument } from "@mdi/js";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { TL_LANGS } from "@/lib/consts";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Entrytr } from "@/components/tlscriptmanager/Entrytr";
import { openUserMenu } from "@/lib/navigation-events";

export function UploadScript({ videoData, onClose }: { videoData: any; onClose?: (payload: { upload: boolean }) => void }) {
  const { t } = useI18n();
  const appStore = useAppState();
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [parsed, setParsed] = useState(false);
  const [entries, setEntries] = useState<any[]>([]);
  const [profileContainer, setProfileContainer] = useState<any[]>([]);
  const [notifText, setNotifText] = useState("");
  const [TLLang, setTLLang] = useState<any>(TL_LANGS[0]);
  const userdata = appStore.userdata;

  const startTime = useMemo(() => {
    if (!videoData?.start_actual) {
      return Date.parse(videoData?.available_at);
    }
    if (Number.isNaN(Number(videoData.start_actual))) {
      return Date.parse(videoData.start_actual);
    }
    return videoData.start_actual;
  }, [videoData]);

  useEffect(() => {
    if (fileInput.current) {
      fileInput.current.value = "";
    }
    setParsed(false);
    setNotifText("");
    setEntries([]);
  }, [videoData]);

  function handleFileInput(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event?.target?.files?.[0];
    fileChange(file);
  }

  function changeUsernameClick() {
    openUserMenu();
  }

  function fileChange(e: File | undefined) {
    setParsed(false);
    setEntries([]);
    setProfileContainer([]);
    setNotifText("");
    if (!e) {
      return;
    }
    setNotifText(t("views.watch.uploadPanel.notifTextParsing"));
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
      setNotifText(t("views.watch.uploadPanel.notifTextErrExt"));
    }
  }

  function parseAss(dataFeed: string) {
    const res = dataFeed.split("\n");
    let fail = true;
    let lineSplit: string[] = [];
    let locationIndex: number[] = [];
    let dataLength = 0;
    const nextProfileContainer: any[] = [];
    const nextEntries: any[] = [];

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
                    nextProfileContainer.push({
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
      setNotifText(t("views.watch.uploadPanel.notifTextErr"));
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
                  for (let index2 = 0; index2 < nextProfileContainer.length; index2 += 1) {
                    if (lineSplit[locationIndex[2]].trim() === nextProfileContainer[index2].Name) {
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

                      nextEntries.push({
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
      setNotifText(t("views.watch.uploadPanel.notifTextErr"));
    } else {
      setProfileContainer(nextProfileContainer);
      setEntries(nextEntries);
      setNotifText(`Parsed ASS file, ${nextProfileContainer.length} profiles, ${nextEntries.length} Entries.`);
      setParsed(true);
    }
  }

  function parseTtml(dataFeed: string) {
    let fail = true;
    let startIndex: number;
    let endIndex: number;
    let penEnd: number;
    let target: number;
    let endTarget: number;
    const nextProfileContainer: any[] = [];
    const nextEntries: any[] = [];

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

        nextProfileContainer.push(tempProfileContainer);
        penStart = penEnd;
      }
    }

    if (fail) {
      setNotifText(t("views.watch.uploadPanel.notifTextErr"));
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

              for (let i = 0; i < nextProfileContainer.length; i += 1) {
                if (nextProfileContainer[i].Name === dataFeed.substring(target + 3, endTarget)) {
                  nextEntries.push({
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
      setNotifText(t("views.watch.uploadPanel.notifTextErr"));
    } else {
      setProfileContainer(nextProfileContainer);
      setEntries(nextEntries);
      setNotifText(`Parsed TTML file, ${nextProfileContainer.length} colour profiles, ${nextEntries.length} Entries.`);
      setParsed(true);
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
    const nextEntries: any[] = [];

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
            nextEntries.push({
              message: text,
              timestamp: srtStartTime,
              duration: endTimeMs - srtStartTime,
            });
            break;
          } else if (res[index] === "") {
            write = false;
            nextEntries.push({
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
            nextEntries.push({
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
        setEntries(nextEntries);
        setNotifText(`Parsed SRT file, ${nextEntries.length} Entries.`);
        setParsed(true);
      }
    }
  }

  async function sendData() {
    const processes = await (await api.chatHistory(videoData.id, {
      lang: TLLang.value,
      verified: 0,
      moderator: 0,
      vtuber: 0,
      limit: 100000,
      mode: 1,
      creator_id: userdata.user.id,
    })).data.map((e: any) => ({
      type: "Delete",
      data: {
        id: e.id,
      },
    }));

    for (let idx = 0; idx < entries.length; idx += 1) {
      processes.push({
        type: "Add",
        data: {
          tempid: `I${idx}`,
          name: userdata.user.username,
          timestamp: Math.floor(startTime + entries[idx].timestamp),
          message: entries[idx].message,
          duration: Math.floor(entries[idx].duration),
        },
      });
    }

    api.postTLLog({
      videoId: videoData.id,
      jwt: userdata.jwt!,
      body: processes,
      lang: TLLang.value,
    }).then(({ status }: any) => {
      if (status === 200) {
        onClose?.({ upload: true });
      }
    }).catch((err: any) => {
      console.error("Upload error:", err);
    });
  }

  return (
    <div className="space-y-5 p-6">
      <div>
        <h2 className="text-lg font-semibold text-white">
          {t("views.watch.uploadPanel.title")}
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          {t("views.watch.uploadPanel.usernameText") + " : " + userdata.user?.username + " "}
          <a className="underline underline-offset-4 hover:text-sky-300" onClick={changeUsernameClick}>{t("views.watch.uploadPanel.usernameChange")}</a>
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-300">Subtitle file</label>
        <div className="flex items-center gap-3 rounded-[calc(var(--radius)+6px)] border border-white/10 bg-white/4 px-4 py-3">
          <Icon icon={mdiFileDocument} size="sm" className="text-slate-400" />
          <input
            ref={fileInput}
            accept=".ass,.TTML,.srt,.ttml"
            type="file"
            className="w-full text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-white/15"
            onChange={handleFileInput}
          />
        </div>
      </div>

      <p className="text-sm text-slate-400">
        {notifText}
      </p>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-300">{t("views.tlManager.langPick")}</span>
        <select
          value={TLLang.value}
          className="h-10 w-full rounded-xl border border-white/12 bg-white/6 px-3 text-sm text-white outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-400/20"
          onChange={(event) => setTLLang(TL_LANGS.find((item) => item.value === event.target.value) || TL_LANGS[0])}
        >
          {TL_LANGS.map((item) => (
            <option key={item.value} value={item.value} className="bg-slate-950">
              {item.text + " (" + item.value + ")"}
            </option>
          ))}
        </select>
      </label>

      {entries.length > 0 ? (
        <div className="overflow-hidden rounded-[calc(var(--radius)+6px)] border border-white/10">
          <div className="max-h-[40vh] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-950/95 backdrop-blur">
                <tr className="border-b border-white/10 text-left text-slate-300">
                  <th className="px-4 py-3 font-medium">
                    {t("views.watch.uploadPanel.headerStart")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("views.watch.uploadPanel.headerEnd")}
                  </th>
                  <th className="px-4 py-3 font-medium">
                    {t("views.watch.uploadPanel.headerText")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, index) => (
                  <Entrytr
                    key={index}
                    time={entry.timestamp}
                    duration={entry.duration}
                    stext={entry.message}
                    cc={entry.cc ? entry.cc : ""}
                    oc={entry.oc ? entry.oc : ""}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => onClose?.({ upload: false })}>
          {t("views.watch.uploadPanel.cancelBtn")}
        </Button>

        <Button
          variant="destructive"
          className="ml-auto"
          disabled={!parsed}
          onClick={sendData}
        >
          {t("views.scriptEditor.importFile.overwriteBtn")}
        </Button>
      </div>
    </div>
  );
}
