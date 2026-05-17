"use client";

import { useEffect, type ReactNode } from "react";
import { GithubIcon } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslations } from "next-intl";
type ExtensionPromoCardProps = {
  screenshot: { src: string; alt: string };
  icon: { src: string; alt: string };
  title: string;
  featuresLabel: string;
  features: string[];
  children: ReactNode;
};

export default function ExtensionPage() {
  const t = useTranslations();
  useEffect(() => { document.title = `${t("views.extension.title")} - Holodex`; }, [t]);

  return (
    <div className="app-page flex max-w-6xl flex-col gap-6">
      <ExtensionPromoCard
        screenshot={{ src: "/img/holodex-plus/holodex-plus-screenshot.webp", alt: "Holodex Plus screenshot" }}
        icon={{ src: "/img/holodex-plus/holodex-plus-icon.png", alt: "Holodex Plus" }}
        title={t("views.extension.title")}
        featuresLabel={t("views.extension.features")}
        features={[
          t("views.extension.featureset.one"),
          t("views.extension.featureset.two"),
          t("views.extension.featureset.three"),
          t("views.extension.featureset.four"),
        ]}
      >
        <a href="https://chrome.google.com/webstore/detail/holodex-plus/mjcecbpccklceljomllkhilglcdcncbh" title={t("views.extension.chromeWebstore")} className="inline-flex">
          <img src="/img/holodex-plus/chrome-webstore.png" alt={t("views.extension.chromeWebstore")} className="max-h-[50px] max-w-[180px] rounded-xl object-contain" />
        </a>
        <a href="https://addons.mozilla.org/firefox/addon/holodex-plus/" title={t("views.extension.firefoxExtension")} className="inline-flex">
          <img src="/img/holodex-plus/firefox-amo.png" alt={t("views.extension.firefoxAddons")} className="max-h-[50px] max-w-[145px] rounded-xl object-contain" />
        </a>
        <Button nativeButton={false}
          render={<a target="_blank" href="https://github.com/HolodexNet/Holodex-Plus" title={t("views.extension.githubDownload")} />}
          className="h-[50px] rounded-xl bg-violet-600 px-4 text-white hover:brightness-110"
        >
          <GithubIcon className="size-5" />
          {t("views.extension.installFromGithubPrefix")}<br />{t("views.extension.installFromGithubSuffix")}
        </Button>
      </ExtensionPromoCard>

      <ExtensionPromoCard
        screenshot={{ src: "https://files.raycast.com/ynzdcq6vupr1rptcwz2qd3j323f1", alt: "Raycast extension screenshot" }}
        icon={{ src: "https://imgproxy.raycast.com/RNu0jpnAtWUnMiJAdLuIvB7-gpQ5ohNPGiR3td1FigI/rs:fill:64:64/dpr:2/aHR0cHM6Ly9maWxl/cy5yYXljYXN0LmNv/bS9vb2NlNzNybGFi/a2Z5M3QwZm5weWQ1/ZnVodzZz", alt: "Raycast" }}
        title={t("views.extension.raycast.title")}
        featuresLabel={t("views.extension.features")}
        features={[
          t("views.extension.raycast.features.live"),
          t("views.extension.raycast.features.archives"),
          t("views.extension.raycast.features.clips"),
          t("views.extension.raycast.features.channels"),
        ]}
      >
        <Button nativeButton={false}
          render={<a target="_blank" href="https://www.raycast.com/uetchy/holodex" title={t("views.extension.raycastStore")} />}
          className="h-[50px] rounded-xl bg-violet-600 px-4 text-white hover:brightness-110"
        >
          <img src="https://www.raycast.com/assets/static/favicon.b9532cc.628b74797b5186d6caec6476f06179e0.png" alt="Raycast" className="mr-2 h-8 w-8 rounded-md" />
          {t("views.extension.raycast.getItOnPrefix")}<br />{t("views.extension.raycast.getItOnSuffix")}
        </Button>
        <Button nativeButton={false}
          render={<a target="_blank" href="https://github.com/HolodexNet/raycast-holodex" title={t("views.extension.downloadSourceCode")} />}
          className="h-[50px] rounded-xl bg-violet-600 px-4 text-white hover:brightness-110"
        >
          <GithubIcon className="size-5" />
          {t("views.extension.installFromGithubPrefix")}<br />{t("views.extension.installFromGithubSuffix")}
        </Button>
      </ExtensionPromoCard>
    </div>
  );
}

function ExtensionPromoCard({ screenshot, icon, title, featuresLabel, features, children }: ExtensionPromoCardProps) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-white/10 p-4 md:border-b-0 md:border-r md:p-6">
          <img src={screenshot.src} alt={screenshot.alt} className="h-full w-full rounded-[calc(var(--radius)+4px)] object-cover" />
        </div>
        <CardContent className="p-4 md:p-6">
          <CardHeader className="mb-4 flex items-center gap-3 p-0">
            <img src={icon.src} alt={icon.alt} className="h-8 w-8 rounded-lg" />
            <CardTitle className="text-2xl font-semibold leading-8 text-white">{title}</CardTitle>
          </CardHeader>

          <div className="mb-2 text-lg font-medium text-slate-100">{featuresLabel}</div>
          <ul className="space-y-2 text-sm text-slate-300">
            {features.map((feature, index) => <li key={index}>{feature}</li>)}
          </ul>

          <CardFooter className="mt-6 flex flex-wrap items-stretch justify-center gap-3 p-0 md:justify-start">
            {children}
          </CardFooter>
        </CardContent>
      </div>
    </Card>
  );
}
