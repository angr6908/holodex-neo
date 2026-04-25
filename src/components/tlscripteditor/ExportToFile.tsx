"use client";

import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";

export function ScriptEditorExportToFile({ entries = [], profile = [], title = "Holodex" }: { entries?: any[]; profile?: any[]; title?: string }) {
  const { t } = useI18n();
  function stringifyTime(time: number, mode: boolean): string {
    let timeStamp = time;
    let timeString = "";
    let stringTime = Math.floor(timeStamp / 3600000);
    let tempString = stringTime.toString();
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
    timeString += mode ? "," : ".";
    timeString += timeStamp.toString();
    return timeString;
  }
  function download(ext: string, writeStream: string) {
    const blob = new Blob([writeStream], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${title}.${ext}`;
    link.click();
    link.remove();
  }
  function exportAss() {
    let writeStream = "";
    writeStream += "[V4+ Styles]\n";
    writeStream += "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n";
    for (let i = 0; i < profile.length; i += 1) {
      writeStream += `Style: ${profile[i].Name},Arial,20,&H00`;
      writeStream += profile[i].useCC ? profile[i].CC.substring(5, 7) + profile[i].CC.substring(3, 5) + profile[i].CC.substring(1, 3) : "FFFFFF";
      writeStream += ",&H00000000,&H00";
      writeStream += profile[i].useOC ? profile[i].OC.substring(5, 7) + profile[i].OC.substring(3, 5) + profile[i].OC.substring(1, 3) : "000000";
      writeStream += ",&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1\n";
    }
    writeStream += "\n[Events]\n";
    writeStream += "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";
    for (let i = 0; i < entries.length; i += 1) {
      writeStream += `Dialogue: 0,${stringifyTime(entries[i].Time, false)},`;
      if (i === entries.length - 1) writeStream += `${stringifyTime(entries[i].Time + 3000, false)},`;
      else writeStream += `${stringifyTime(entries[i].Time + entries[0].Duration, false)},`;
      writeStream += `${profile[entries[i].Profile].Name},`;
      writeStream += `,0,0,0,,${entries[i].SText}\n`;
    }
    download("ass", writeStream);
  }
  function exportTTML() {
    let writeStream = "";
    writeStream += "<?xml version=\"1.0\" encoding=\"utf-8\"?><timedtext format=\"3\">\n"
      + "\t<head>\n"
      + "\t\t<wp id=\"0\" ap=\"7\" ah=\"0\" av=\"0\" />\n"
      + "\t\t<wp id=\"1\" ap=\"7\" ah=\"50\" av=\"100\" />\n"
      + "\t\t<ws id=\"0\" ju=\"2\" pd=\"0\" sd=\"0\" />\n"
      + "\t\t<ws id=\"1\" ju=\"2\" pd=\"0\" sd=\"0\" />\n\n"
      + "\t\t<pen id=\"0\" sz=\"100\" fc=\"#000000\" fo=\"0\" bo=\"0\" />\n"
      + "\t\t<pen id=\"1\" sz=\"0\" fc=\"#A0AAB4\" fo=\"0\" bo=\"0\" />\n";
    for (let i = 0; i < profile.length; i += 1) {
      writeStream += `\t\t<pen id="${((i * 2) + 2).toString()}" sz="100" fc="`;
      writeStream += profile[i].useCC ? profile[i].CC : "#FFFFFF";
      writeStream += "\" fo=\"254\" et=\"4\" ec=\"";
      writeStream += profile[i].useOC ? profile[i].OC : "#000000";
      writeStream += "\" />\n";
      writeStream += `\t\t<pen id="${((i * 2) + 3).toString()}" sz="100" fc="`;
      writeStream += profile[i].useCC ? profile[i].CC : "#FFFFFF";
      writeStream += "\" fo=\"254\" et=\"3\" ec=\"";
      writeStream += profile[i].useOC ? profile[i].OC : "#000000";
      writeStream += "\" />\n";
    }
    writeStream += "\t</head>\n\n\t<body>\n";
    for (let i = 0; i < entries.length; i += 1) {
      for (const penOffset of [2, 3]) {
        writeStream += `\t\t<p t="${(entries[i].Time + 1).toString()}" d="`;
        if (i === entries.length - 1) writeStream += `${(entries[i].Time + 3001).toString()}"`;
        else writeStream += `${(entries[i].Time + 1 + entries[i].Duration).toString()}"`;
        writeStream += " wp=\"1\" ws=\"1\"><s p=\"1\"></s><s p=\"";
        writeStream += `${((entries[i].Profile * 2) + penOffset).toString()}"> ${entries[i].SText} </s><s p="1"></s></p>\n`;
      }
    }
    writeStream += "\t</body>\n</timedtext>";
    download("ttml", writeStream);
  }
  function exportSrt() {
    let writeStream = "";
    for (let i = 0; i < entries.length; i += 1) {
      writeStream += `${(i + 1).toString()}\n`;
      writeStream += `${stringifyTime(entries[i].Time, true)} --> `;
      if (i === entries.length - 1) writeStream += `${stringifyTime(entries[i].Time + 3000, true)}\n`;
      else writeStream += `${stringifyTime(entries[i].Time + entries[i].Duration, true)}\n`;
      writeStream += `${entries[i].SText}\n\n`;
    }
    download("srt", writeStream);
  }
  return <div className="space-y-4 p-4"><h2 className="text-center text-xl font-semibold text-[color:var(--color-foreground)]">{t("views.scriptEditor.menu.exportFile")}</h2><h4 className="text-center text-sm text-[color:var(--color-muted-foreground)]">{entries.length + " entries, " + profile.length + " profile."}</h4><div className="flex flex-wrap justify-center gap-3"><Button type="button" onClick={exportSrt}>.srt</Button><Button type="button" onClick={exportAss}>.ass</Button><Button type="button" onClick={exportTTML}>.ttml</Button></div></div>;
}
