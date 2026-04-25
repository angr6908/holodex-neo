"use client";

import { useEffect, useState } from "react";
import { mdiAt } from "@mdi/js";
import { api } from "@/lib/api";
import { useAppState } from "@/lib/store";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ChannelAutocomplete } from "@/components/channel/ChannelAutocomplete";
import { ChannelImg } from "@/components/channel/ChannelImg";
import { ChannelInfo } from "@/components/channel/ChannelInfo";
import { channelDisplayName } from "@/lib/video-format";
import * as icons from "@/lib/icons";

export function VideoEditMentions({ video }: { video: any }) {
  const app = useAppState();
  const [mentions, setMentions] = useState<any[]>([]);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<any>(null);
  const useEnglishName = app.settings.nameProperty === "english_name";

  useEffect(() => { updateMentions(); }, [video.id]);
  function showSuccess(message: string) { setShowSuccessAlert(true); setSuccessMessage(message); setTimeout(() => setShowSuccessAlert(false), 4000); }
  function showError(message: string) { setErrorMessage(message); setShowErrorAlert(true); setTimeout(() => setShowErrorAlert(false), 4000); }
  function updateMentions() { api.getMentions(video.id).then(({ data }: any) => setMentions(data)).catch(console.error); }
  function deleteMention(channelId: string) { api.deleteMentions(video.id, [channelId], app.userdata.jwt).then(({ data }: any) => { if (!data) return; showSuccess("Successfully deleted mention"); updateMentions(); }).catch((e: any) => showError(e.response?.data?.message || e.message || "Error occured")); }
  function addMention(channelId: string) { api.addMention(video.id, channelId, app.userdata.jwt).then(({ data }: any) => { if (!data) return; showSuccess(`Added channel: ${channelDisplayName(selectedChannel, useEnglishName)}`); updateMentions(); }).catch((e: any) => showError(e.response?.data?.message || e.message || "Error occured")); }

  return <div>
    <div className="text-h6"><Icon icon={mdiAt} size="sm" /> Channel Mentions/Tags</div>
    {successMessage && showSuccessAlert ? <div className="mb-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/20 px-4 py-3 text-sm text-white">{successMessage}</div> : null}
    {errorMessage && showErrorAlert ? <div className="mb-3 rounded-2xl border border-rose-400/30 bg-rose-500/20 px-4 py-3 text-sm text-white">{errorMessage}</div> : null}
    <div className="my-2 flex flex-col gap-2"><ChannelAutocomplete value={selectedChannel} onChange={setSelectedChannel} /><Button disabled={!selectedChannel?.id} onClick={() => addMention(selectedChannel.id)}>Add</Button></div>
    <div className="channel-list-container">{mentions.map((channel, index) => <div key={`${channel.id || "channel"}-${index}`}>{index > 0 ? <div className="channel-list-divider" /> : null}<div className="flex items-start gap-3 px-4 py-3 no-underline hover:bg-white/5"><div className="shrink-0"><ChannelImg channel={channel} size={55} /></div><ChannelInfo channel={channel} includeVideoCount={false} /><Button className="deleteBtn h-10 w-10" variant="destructive" size="icon" onClick={(e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); deleteMention(channel.id); }}><Icon icon={icons.mdiDelete} size="lg" /></Button></div></div>)}</div>
  </div>;
}
