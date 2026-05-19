"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bookmark, MoreVertical, Share, GithubIcon, ExternalLink, Puzzle, TwitterIcon, DiscordIcon } from "@/lib/icons";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useTranslations } from "next-intl";
const socialLinkClass = "h-auto w-full justify-start whitespace-normal font-normal";

function SocialLink({ item }: { item: any }) {
  return <Button nativeButton={false} render={<a href={item.href} target="_blank" rel="noopener noreferrer" />} variant="outline" className={socialLinkClass}><item.icon className="size-4" /><span className="truncate">{item.title}</span><span className="truncate text-muted-foreground">{item.label}</span></Button>;
}

function TwitterFeed() {
  const t = useTranslations();
  const [metrics, setMetrics] = useState<any>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const s = metrics?.statistics ?? null;
  const links = useMemo(() => [
    { title: "X", label: "@holodex", bucket: "top", href: "https://x.com/holodex", icon: TwitterIcon },
    { title: "Discord", label: t("about.links.community"), bucket: "top", href: "https://discord.gg/jctkgHBt4b", icon: DiscordIcon },
    { title: "GitHub", label: t("about.links.repository"), bucket: "top", href: "https://github.com/RiceCakess/Holodex", icon: GithubIcon },
    { title: t("about.links.docs"), label: "HoloAPI V2", bucket: "top", href: "https://docs.holodex.net/", icon: ExternalLink },
    { title: t("about.links.extension"), label: t("about.links.browserAddon"), bucket: "bottom", href: "https://holodex.net/extension", icon: Puzzle },
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
    {s ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{statCards.map((item) => <Card key={item.label} role="article" size="sm"><div className="text-2xl font-normal" data-stat-value data-value={item.value}>0</div><div className="text-xs font-medium text-muted-foreground">{item.label}</div><div className="text-xs text-muted-foreground">{item.delta}</div></Card>)}</div> : null}
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{links.filter((l) => l.bucket === "top").map((item) => <SocialLink key={item.title} item={item} />)}</div>
    <div className="grid gap-2 min-[1100px]:grid-cols-2">
      <div className="grid gap-2">{links.filter((l) => l.bucket === "bottom").map((item) => <SocialLink key={item.title} item={item} />)}</div>
      <Button nativeButton={false} render={<a href="javascript:(function(){var v=new%20URLSearchParams(window.location.search).get('v');v&&(window.location.href='https://holodex.net/watch/'+v)})()" />} variant="outline" className={socialLinkClass}><Bookmark className="size-4" /><span>{t("about.bookmarklet.title")}</span><span className="text-muted-foreground">{t("about.bookmarklet.openYoutube")}</span></Button>
    </div>
  </div>;
}

export function AboutSection() {
  const t = useTranslations();
  return <div id="about" className="space-y-6">
    <TwitterFeed />
    <section className="px-5">
      <h3 className="text-lg leading-7 text-foreground">{t("about.credits.title")}</h3>
      <div className="about-credits mt-4 space-y-4 text-sm leading-6 text-muted-foreground">
        <p>{t("about.credits.contents.0")} <a className="font-medium text-primary underline underline-offset-4 transition-opacity hover:opacity-90" href="https://hololive.jetri.co/">HoloTools</a> {t("about.credits.contents.1")} <a className="font-medium text-primary underline underline-offset-4 transition-opacity hover:opacity-90" href="https://github.com/holofans/holoapi">holoapi</a>.<br />{t("about.credits.contents.2")}</p>
        <p>{t("about.credits.contents.3")} <a className="font-medium text-primary underline underline-offset-4 transition-opacity hover:opacity-90" href="https://en.hololive.tv/terms" target="_blank" rel="noopener noreferrer">{t("about.credits.contents.4")}</a></p>
        <p>{t("about.youtubeTerms.before")} <a className="font-medium text-primary underline underline-offset-4 transition-opacity hover:opacity-90" href="https://www.youtube.com/t/terms">{t("about.youtubeTerms.link")}</a>{t("about.youtubeTerms.after")}</p>
      </div>
    </section>
    <section className="px-5">
      <h3 className="text-lg leading-7 text-foreground">{t("about.faq.title")}</h3>
      <div className="mt-4"><Accordion multiple>
	      <Faq title={t("about.faq.ytchatHeader")}><>{t("about.faq.ytchatContent")}<br /><a className="text-primary underline underline-offset-4" href="https://support.mozilla.org/en-US/kb/third-party-cookies-firefox-tracking-protection?redirectslug=disable-third-party-cookies">{t("about.faq.ytchatFirefox")}</a></></Faq>
      <Faq title={t("about.faq.autoplayHeader")}><div className="space-y-4"><p>{t("about.faq.autoplayContent")}</p><div className="space-y-4"><div><div className="mb-2 text-sm font-normal text-foreground">Safari</div><img width="80%" src="https://www.imore.com/sites/imore.com/files/styles/large/public/field/image/2017/07/safari-custom-settings-websites-mac-screenshot-06.jpg?itok=ONVYTcno" alt="" /></div><div><div className="mb-2 text-sm font-normal text-foreground">Firefox</div><img width="80%" src="https://ffp4g1ylyit3jdyti1hqcvtb-wpengine.netdna-ssl.com/firefox/files/2019/04/Screen-Shot-2019-04-01-at-11.21.21-AM.png" alt="" /></div></div></div></Faq>
	      <Faq title={t("about.faq.mobile.title")}><><p>{t("about.faq.mobile.content.summary")}</p><ul className="mt-3 space-y-2 pl-5"><li>{t("about.faq.mobile.content.android.0")} <MoreVertical className="size-4 mx-1" /> {t("about.faq.mobile.content.android.1")}</li><li>{t("about.faq.mobile.content.ios.0")} <Share className="size-4 mx-1" /> {t("about.faq.mobile.content.ios.1")}</li></ul></></Faq>
      <Faq title={t("about.faq.favorite.disappear.title")}>{t("about.faq.favorite.contents.0")}</Faq>
	      <Faq title={t("about.faq.subber.title")}><>{t("about.faq.subber.contents.0")} <a className="text-primary underline underline-offset-4" href="https://forms.gle/xkN4w8fyPr6YTGfx6">{t("about.faq.subber.contents.1")}</a> {t("about.faq.subber.contents.2")}</></Faq>
      <Faq title={t("about.faq.videoLinkage")}>{t("about.faq.videoLinkageContent")}</Faq>
      <Faq title={t("about.faq.quitHolodex")}>{t("about.faq.quitHolodexContent")}</Faq>
      <Faq title={t("about.faq.feedback.title")}>{t("about.faq.feedback.contents.0")}</Faq>
      <Faq title={t("about.faq.support.title")}><div dangerouslySetInnerHTML={{ __html: t.raw("about.faq.support.contents.0") }} /></Faq>
      <Faq title={t("about.privacyPolicy")}><PrivacyPolicy /></Faq>
      <Faq title={t("about.gdpr")}><>{t("about.gdprContent")} <span className="font-normal text-foreground">{t("about.gdprDeletion")}</span></></Faq>
    </Accordion></div>
    </section>
  </div>;
}

function Faq({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return <AccordionItem value={String(title)}><AccordionTrigger>{title}</AccordionTrigger><AccordionContent className="text-sm leading-6 text-muted-foreground [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4">{children}</AccordionContent></AccordionItem>;
}

function PrivacyPolicy() {
  const t = useTranslations();
  return <div className="space-y-4">
    <p>{t("about.privacy.content.intro")}</p>
    <div><h4 className="text-base font-normal text-foreground">{t("about.privacy.firstParty.title")}</h4><p className="mt-2">{t("about.privacy.firstParty.collection")}</p><p className="mt-2">{t("about.privacy.firstParty.voluntary")}</p><p className="mt-2">{t("about.privacy.firstParty.access")}</p><p className="mt-2">{t("about.privacy.firstParty.limitedUse")}</p><p className="mt-2">{t("about.privacy.firstParty.noPosting")}</p><p className="mt-2">{t("about.privacy.firstParty.revoking")}</p><p className="mt-2">{t("about.privacy.firstParty.changes")}</p></div>
    <div><h4 className="text-base font-normal text-foreground">{t("about.privacy.thirdParty.title")}</h4><h5 className="mt-3 text-sm font-normal uppercase tracking-[0.18em] text-foreground">{t("about.privacy.thirdParty.analyticsTitle")}</h5><p className="mt-2">{t("about.privacy.thirdParty.analyticsBody")}</p><p className="mt-2">{t("about.privacy.thirdParty.analyticsUse")}</p><h5 className="mt-3 text-sm font-normal uppercase tracking-[0.18em] text-foreground">{t("about.privacy.thirdParty.embedsTitle")}</h5><p className="mt-2">{t("about.privacy.thirdParty.embedsBody")}</p><p className="mt-2">{t("about.privacy.thirdParty.linksIntro")}</p><h5 className="mt-3 text-sm font-normal uppercase tracking-[0.18em] text-foreground">{t("about.privacy.thirdParty.choicesTitle")}</h5><p className="mt-2">{t("about.privacy.thirdParty.choicesBody")}</p><h5 className="mt-3 text-sm font-normal uppercase tracking-[0.18em] text-foreground">{t("about.privacy.thirdParty.contactTitle")}</h5><p className="mt-2">{t("about.privacy.thirdParty.contactBody")}</p><p className="mt-2">{t("about.privacy.thirdParty.commitment")}</p><div className="space-y-2"><a className="block text-primary underline underline-offset-4" href="https://policies.google.com/privacy">{t("about.privacy.links.google")}</a><a className="block text-primary underline underline-offset-4" href="https://www.twitch.tv/p/en/legal/privacy-notice/">{t("about.privacy.links.twitch")}</a></div></div>
  </div>;
}
