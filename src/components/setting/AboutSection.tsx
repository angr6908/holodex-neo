"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, MoreVertical, Share, GithubIcon, ExternalLink, Puzzle, TwitterIcon, DiscordIcon } from "@/lib/icons";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useTranslations } from "next-intl";
const socialLinkClass = "block h-auto w-full min-w-0 whitespace-normal rounded-lg border border-border bg-card p-3 font-normal text-foreground no-underline transition-colors hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent";

function SocialLink({ item }: { item: any }) {
  return <Button nativeButton={false} render={<a href={item.href} target="_blank" rel="noopener noreferrer" />} variant="ghost" className={socialLinkClass}><div className="flex items-center gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-md" style={item.iconStyle}><item.icon className="size-4" /></div><div className="min-w-0"><div className="truncate text-sm font-medium">{item.title}</div><div className="truncate text-xs text-muted-foreground">{item.label}</div></div></div></Button>;
}

function TwitterFeed() {
  const t = useTranslations();
  const [metrics, setMetrics] = useState<any>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const s = metrics?.statistics ?? null;
  const links = useMemo(() => [
    { title: "X", label: "@holodex", bucket: "top", href: "https://x.com/holodex", icon: TwitterIcon, iconStyle: { background: "color-mix(in srgb, #0ea5e9 72%, #020617 28%)", color: "#f8fafc" } },
    { title: "Discord", label: t("about.links.community"), bucket: "top", href: "https://discord.gg/jctkgHBt4b", icon: DiscordIcon, iconStyle: { background: "color-mix(in srgb, #6366f1 78%, #0f172a 22%)", color: "#f8fafc" } },
    { title: "GitHub", label: t("about.links.repository"), bucket: "top", href: "https://github.com/RiceCakess/Holodex", icon: GithubIcon, iconStyle: { background: "#111827", color: "#f8fafc" } },
    { title: t("about.links.docs"), label: "HoloAPI V2", bucket: "top", href: "https://docs.holodex.net/", icon: ExternalLink, iconStyle: { background: "color-mix(in srgb, #f59e0b 74%, #0f172a 26%)", color: "#f8fafc" } },
    { title: t("about.links.extension"), label: t("about.links.browserAddon"), bucket: "bottom", href: "https://holodex.net/extension", icon: Puzzle, iconStyle: { background: "color-mix(in srgb, #10b981 74%, #0f172a 26%)", color: "#f8fafc" } },
  ], [t]);
  const statCards = useMemo(() => {
    if (!s) return [];
    return [
      { label: t("about.stats.vtubers"), value: s.channelCount.vtuber || 0, delta: t("about.stats.lastMonth", { count: s.monthlyChannels.vtuber || 0 }) },
      { label: t("about.stats.subbers"), value: s.channelCount.subber || 0, delta: t("about.stats.lastMonth", { count: s.monthlyChannels.subber || 0 }) },
      { label: t("about.stats.videos"), value: s.totalVideos.count || 0, delta: t("about.stats.yesterday", { count: s.dailyVideos.count || 0 }) },
      { label: t("about.stats.songs"), value: s.totalSongs.count || 0, delta: " " },
    ];
  }, [s, t]);
  useEffect(() => { api.stats().then(({ data }) => setMetrics(data)).catch(() => {}); }, []);
  useEffect(() => {
    if (!metrics) return;
    const handles: number[] = [];
    (elRef.current?.querySelectorAll<HTMLElement>("[data-stat-value]") ?? []).forEach((el) => {
      const target = +(el.getAttribute("data-value") || 0);
      const step = Math.max(target / 200, 1);
      const tick = () => {
        const curr = +(el.innerText || 0);
        if (curr < target) { el.innerText = `${Math.ceil(curr + step)}`; handles.push(requestAnimationFrame(tick)); }
        else el.innerText = `${target}`;
      };
      tick();
    });
    return () => handles.forEach(cancelAnimationFrame);
  }, [metrics]);

  return <div ref={elRef} className="space-y-4 p-5">
    {s ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{statCards.map((item) => <Card key={item.label} role="article" className="gap-0 rounded-lg border-border p-3 shadow-none"><div className="text-2xl font-semibold tracking-tight text-foreground" data-stat-value data-value={item.value}>0</div><div className="mt-1 text-xs font-medium text-muted-foreground">{item.label}</div><div className="mt-1 text-[11px] text-muted-foreground/80">{item.delta}</div></Card>)}</div> : null}
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{links.filter((l) => l.bucket === "top").map((item) => <SocialLink key={item.title} item={item} />)}</div>
    <div className="grid gap-2 min-[1100px]:grid-cols-2">
      <div className="grid gap-2">{links.filter((l) => l.bucket === "bottom").map((item) => <SocialLink key={item.title} item={item} />)}</div>
      <Button nativeButton={false} render={<a href="javascript:(function(){var v=new%20URLSearchParams(window.location.search).get('v');v&&(window.location.href='https://holodex.net/watch/'+v)})()" />} variant="ghost" className={socialLinkClass}><div className="flex items-center gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><Bookmark className="size-4" /></div><div className="min-w-0"><div className="text-sm font-medium">{t("about.bookmarklet.title")}</div><div className="text-xs text-muted-foreground">{t("about.bookmarklet.openYoutube")}</div></div></div></Button>
    </div>
  </div>;
}

export function AboutSection() {
  const t = useTranslations();
  return <div id="about" className="space-y-6">
    <div className="grid gap-6"><Card className="overflow-hidden p-0"><TwitterFeed /></Card></div>
    <Card className="gap-0 p-6">
      <CardHeader className="p-0">
        <CardTitle role="heading" aria-level={3} className="text-lg leading-7 text-[color:var(--color-foreground)]">{t("about.credits.title")}</CardTitle>
      </CardHeader>
      <CardContent className="about-credits mt-4 space-y-4 p-0 text-sm leading-6 text-[color:var(--color-muted-foreground)]">
        <p>{t("about.credits.contents.0")} <a className="font-medium text-[color:var(--color-primary)] underline underline-offset-4 transition-opacity hover:opacity-90" href="https://hololive.jetri.co/">HoloTools</a> {t("about.credits.contents.1")} <a className="font-medium text-[color:var(--color-primary)] underline underline-offset-4 transition-opacity hover:opacity-90" href="https://github.com/holofans/holoapi">holoapi</a>.<br />{t("about.credits.contents.2")}</p>
        <p>{t("about.credits.contents.3")} <a className="font-medium text-[color:var(--color-primary)] underline underline-offset-4 transition-opacity hover:opacity-90" href="https://en.hololive.tv/terms" target="_blank" rel="noopener noreferrer">{t("about.credits.contents.4")}</a></p>
        <p>{t("about.youtubeTerms.before")} <a className="font-medium text-[color:var(--color-primary)] underline underline-offset-4 transition-opacity hover:opacity-90" href="https://www.youtube.com/t/terms">{t("about.youtubeTerms.link")}</a>{t("about.youtubeTerms.after")}</p>
      </CardContent>
    </Card>
    <div className="grid gap-6"><Card className="gap-0 p-6"><CardHeader className="p-0"><CardTitle role="heading" aria-level={3} className="text-lg leading-7 text-[color:var(--color-foreground)]">{t("about.faq.title")}</CardTitle></CardHeader><CardContent className="mt-4 p-0"><Accordion multiple>
      <Faq title={t("about.faq.ytchatHeader")}><>{t("about.faq.ytchatContent")}<br /><a className="text-sky-300 hover:text-sky-200" href="https://support.mozilla.org/en-US/kb/third-party-cookies-firefox-tracking-protection?redirectslug=disable-third-party-cookies">{t("about.faq.ytchatFirefox")}</a></></Faq>
      <Faq title={t("about.faq.autoplayHeader")}><div className="space-y-4"><p>{t("about.faq.autoplayContent")}</p><div className="space-y-4"><div><div className="mb-2 text-sm font-normal text-[color:var(--color-foreground)]">Safari</div><img width="80%" src="https://www.imore.com/sites/imore.com/files/styles/large/public/field/image/2017/07/safari-custom-settings-websites-mac-screenshot-06.jpg?itok=ONVYTcno" alt="" /></div><div><div className="mb-2 text-sm font-normal text-[color:var(--color-foreground)]">Firefox</div><img width="80%" src="https://ffp4g1ylyit3jdyti1hqcvtb-wpengine.netdna-ssl.com/firefox/files/2019/04/Screen-Shot-2019-04-01-at-11.21.21-AM.png" alt="" /></div></div></div></Faq>
      <Faq title={t("about.faq.mobile.title")}><><p>{t("about.faq.mobile.content.summary")}</p><ul className="mt-3 space-y-2 pl-5"><li>{t("about.faq.mobile.content.android.0")} <MoreVertical className="size-4 mx-1 text-sky-300" /> {t("about.faq.mobile.content.android.1")}</li><li>{t("about.faq.mobile.content.ios.0")} <Share className="size-4 mx-1 text-sky-300" /> {t("about.faq.mobile.content.ios.1")}</li></ul></></Faq>
      <Faq title={t("about.faq.favorite.disappear.title")}>{t("about.faq.favorite.contents.0")}</Faq>
      <Faq title={t("about.faq.subber.title")}><>{t("about.faq.subber.contents.0")} <a className="text-sky-300 hover:text-sky-200" href="https://forms.gle/xkN4w8fyPr6YTGfx6">{t("about.faq.subber.contents.1")}</a> {t("about.faq.subber.contents.2")}</></Faq>
      <Faq title={t("about.faq.videoLinkage")}>{t("about.faq.videoLinkageContent")}</Faq>
      <Faq title={t("about.faq.quitHolodex")}>{t("about.faq.quitHolodexContent")}</Faq>
      <Faq title={t("about.faq.feedback.title")}>{t("about.faq.feedback.contents.0")}</Faq>
      <Faq title={t("about.faq.support.title")}><div dangerouslySetInnerHTML={{ __html: t.raw("about.faq.support.contents.0") }} /></Faq>
      <Faq title={t("about.privacyPolicy")}><PrivacyPolicy /></Faq>
      <Faq title={t("about.gdpr")}><>{t("about.gdprContent")} <span className="font-normal text-[color:var(--color-foreground)]">{t("about.gdprDeletion")}</span></></Faq>
    </Accordion></CardContent></Card></div>
  </div>;
}

function Faq({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return <AccordionItem value={String(title)}><AccordionTrigger>{title}</AccordionTrigger><AccordionContent className="text-sm leading-6 text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4">{children}</AccordionContent></AccordionItem>;
}

function PrivacyPolicy() {
  const t = useTranslations();
  return <div className="space-y-4">
    <p>{t("about.privacy.content.intro")}</p>
    <div><h4 className="text-base font-normal text-[color:var(--color-foreground)]">{t("about.privacy.firstParty.title")}</h4><p className="mt-2">{t("about.privacy.firstParty.collection")}</p><p className="mt-2">{t("about.privacy.firstParty.voluntary")}</p><p className="mt-2">{t("about.privacy.firstParty.access")}</p><p className="mt-2">{t("about.privacy.firstParty.limitedUse")}</p><p className="mt-2">{t("about.privacy.firstParty.noPosting")}</p><p className="mt-2">{t("about.privacy.firstParty.revoking")}</p><p className="mt-2">{t("about.privacy.firstParty.changes")}</p></div>
    <div><h4 className="text-base font-normal text-white">{t("about.privacy.thirdParty.title")}</h4><h5 className="mt-3 text-sm font-normal uppercase tracking-[0.18em] text-[color:var(--color-foreground)]">{t("about.privacy.thirdParty.analyticsTitle")}</h5><p className="mt-2">{t("about.privacy.thirdParty.analyticsBody")}</p><p className="mt-2">{t("about.privacy.thirdParty.analyticsUse")}</p><h5 className="mt-3 text-sm font-normal uppercase tracking-[0.18em] text-[color:var(--color-foreground)]">{t("about.privacy.thirdParty.embedsTitle")}</h5><p className="mt-2">{t("about.privacy.thirdParty.embedsBody")}</p><p className="mt-2">{t("about.privacy.thirdParty.linksIntro")}</p><h5 className="mt-3 text-sm font-normal uppercase tracking-[0.18em] text-[color:var(--color-foreground)]">{t("about.privacy.thirdParty.choicesTitle")}</h5><p className="mt-2">{t("about.privacy.thirdParty.choicesBody")}</p><h5 className="mt-3 text-sm font-normal uppercase tracking-[0.18em] text-[color:var(--color-foreground)]">{t("about.privacy.thirdParty.contactTitle")}</h5><p className="mt-2">{t("about.privacy.thirdParty.contactBody")}</p><p className="mt-2">{t("about.privacy.thirdParty.commitment")}</p><div className="space-y-2"><a className="block text-sky-300 hover:text-sky-200" href="https://policies.google.com/privacy">{t("about.privacy.links.google")}</a><a className="block text-sky-300 hover:text-sky-200" href="https://www.twitch.tv/p/en/legal/privacy-notice/">{t("about.privacy.links.twitch")}</a></div></div>
  </div>;
}
