"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mdiBookmarkOutline, mdiGithub, mdiOpenInNew, mdiPuzzleOutline, mdiTwitter } from "@mdi/js";
import { mdiDiscord } from "@/lib/icons";
import { Icon } from "@/components/ui/Icon";
import { api } from "@/lib/api";

export function TwitterFeed({ showHeader = true }: { showHeader?: boolean }) {
  const [metrics, setMetrics] = useState<any>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const s = metrics?.statistics ?? null;
  const statCards = useMemo(() => {
    if (!s) return [];
    return [
      { label: "VTubers", value: s.channelCount.vtuber || 0, delta: `+${s.monthlyChannels.vtuber || 0} last month` },
      { label: "Subbers", value: s.channelCount.subber || 0, delta: `+${s.monthlyChannels.subber || 0} last month` },
      { label: "Videos", value: s.totalVideos.count || 0, delta: `+${s.dailyVideos.count || 0} yesterday` },
      { label: "Songs", value: s.totalSongs.count || 0, delta: "\u00a0" },
    ];
  }, [s]);
  const links = [
    { title: "X", label: "@holodex", bucket: "top", href: "https://x.com/holodex", icon: mdiTwitter, iconStyle: { background: "color-mix(in srgb, #0ea5e9 72%, #020617 28%)", color: "#f8fafc" } },
    { title: "Discord", label: "Community", bucket: "top", href: "https://discord.gg/jctkgHBt4b", icon: mdiDiscord, iconStyle: { background: "color-mix(in srgb, #6366f1 78%, #0f172a 22%)", color: "#f8fafc" } },
    { title: "GitHub", label: "Repository", bucket: "top", href: "https://github.com/RiceCakess/Holodex", icon: mdiGithub, iconStyle: { background: "#111827", color: "#f8fafc" } },
    { title: "Docs", label: "HoloAPI V2", bucket: "top", href: "https://docs.holodex.net/", icon: mdiOpenInNew, iconStyle: { background: "color-mix(in srgb, #f59e0b 74%, #0f172a 26%)", color: "#f8fafc" } },
    { title: "Extension", label: "Browser add-on", bucket: "bottom", href: "https://holodex.net/extension", icon: mdiPuzzleOutline, iconStyle: { background: "color-mix(in srgb, #10b981 74%, #0f172a 26%)", color: "#f8fafc" } },
  ];
  const topLinks = links.filter((l) => l.bucket === "top");
  const bottomLinks = links.filter((l) => l.bucket === "bottom");

  useEffect(() => { api.stats().then(({ data }) => setMetrics(data)).catch(() => {}); }, []);
  useEffect(() => {
    if (!metrics) return;
    const numbers = elRef.current?.querySelectorAll<HTMLElement>(".social-stat-value") ?? [];
    numbers.forEach((el) => {
      const animate = () => {
        const value = +(el.getAttribute("data-value") || 0);
        const currVal = +(el.innerText || 0);
        const time = Math.max(value / 200, 1);
        if (currVal < value) {
          el.innerText = `${Math.ceil(currVal + time)}`;
          window.setTimeout(animate, 1);
        } else el.innerText = `${value}`;
      };
      animate();
    });
  }, [metrics]);

  return <div ref={elRef} className="social-card">
    {showHeader ? <div className="space-y-1"><div className="social-kicker">Holodex</div><h3 className="text-lg font-semibold text-[color:var(--color-foreground)]">About</h3></div> : null}
    {s ? <div className="social-stats-grid">{statCards.map((item) => <article key={item.label} className="social-stat-card"><div className="social-stat-value" data-value={item.value}>0</div><div className="social-stat-label">{item.label}</div><div className="social-stat-delta">{item.delta}</div></article>)}</div> : null}
    <div className="social-grid social-grid-top">{topLinks.map((item) => <SocialLink key={item.title} item={item} />)}</div>
    <div className="social-bottom-layout">
      {bottomLinks.length ? <div className="social-grid social-grid-bottom">{bottomLinks.map((item) => <SocialLink key={item.title} item={item} />)}</div> : null}
      <a className="social-link social-bookmark-link" href="javascript:(function(){var v=new%20URLSearchParams(window.location.search).get('v');v&&(window.location.href='https://holodex.net/watch/'+v)})()"><div className="social-link-top social-bookmark-main"><div className="social-icon social-bookmark-icon"><Icon icon={mdiBookmarkOutline} size="sm" /></div><div className="social-bookmark-copy"><div className="social-link-title">Bookmarklet</div><div className="social-link-label"><span className="social-bookmark-label-inline">Open <span className="social-bookmark-youtube-logo" aria-hidden="true"><span className="social-bookmark-youtube-play" /></span> in Holodex via bookmark bar</span></div></div></div></a>
    </div>
  </div>;
}

function SocialLink({ item }: { item: any }) {
  return <a href={item.href} target="_blank" rel="noopener noreferrer" className="social-link"><div className="social-link-top"><div className="social-icon" style={item.iconStyle}><Icon icon={item.icon} size="sm" /></div><div className="min-w-0"><div className="social-link-title">{item.title}</div><div className="social-link-label">{item.label}</div></div></div></a>;
}
