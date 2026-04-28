"use client";

import { useEffect, type ReactNode } from "react";
import { mdiGithub } from "@mdi/js";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n";

type ExtensionPromoCardProps = {
  screenshot: { src: string; alt: string };
  icon: { src: string; alt: string };
  title: string;
  featuresLabel: string;
  features: string[];
  children: ReactNode;
};

export function ExtensionPage() {
  const { t } = useI18n();
  useEffect(() => { document.title = `${t("views.extension.title")} - Holodex`; }, [t]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6 md:pt-12">
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
        <a href="https://chrome.google.com/webstore/detail/holodex-plus/mjcecbpccklceljomllkhilglcdcncbh" title="Chrome Webstore" className="inline-flex">
          <img src="/img/holodex-plus/chrome-webstore.png" alt="Chrome Webstore" className="max-h-[50px] max-w-[180px] rounded-xl object-contain" />
        </a>
        <a href="https://addons.mozilla.org/firefox/addon/holodex-plus/" title="Firefox Extension" className="inline-flex">
          <img src="/img/holodex-plus/firefox-amo.png" alt="Firefox Add-ons" className="max-h-[50px] max-w-[145px] rounded-xl object-contain" />
        </a>
        <Button as="a" className="h-[50px] rounded-xl bg-violet-600 px-4 text-white hover:brightness-110" target="_blank" href="https://github.com/HolodexNet/Holodex-Plus" title="Github Download">
          <Icon icon={mdiGithub} />
          Install<br />from Github
        </Button>
      </ExtensionPromoCard>

      <ExtensionPromoCard
        screenshot={{ src: "https://files.raycast.com/ynzdcq6vupr1rptcwz2qd3j323f1", alt: "Raycast extension screenshot" }}
        icon={{ src: "https://imgproxy.raycast.com/RNu0jpnAtWUnMiJAdLuIvB7-gpQ5ohNPGiR3td1FigI/rs:fill:64:64/dpr:2/aHR0cHM6Ly9maWxl/cy5yYXljYXN0LmNv/bS9vb2NlNzNybGFi/a2Z5M3QwZm5weWQ1/ZnVodzZz", alt: "Raycast" }}
        title="Raycast Extension"
        featuresLabel={t("views.extension.features")}
        features={[
          "Show ongoing live streams",
          "Search archives",
          "Search clips",
          "Search channels",
        ]}
      >
        <Button as="a" className="h-[50px] rounded-xl bg-violet-600 px-4 text-white hover:brightness-110" target="_blank" href="https://www.raycast.com/uetchy/holodex" title="Get it on Raycast Store">
          <img src="https://www.raycast.com/assets/static/favicon.b9532cc.628b74797b5186d6caec6476f06179e0.png" alt="Raycast" className="mr-2 h-8 w-8 rounded-md" />
          Get it on<br />Raycast Store
        </Button>
        <Button as="a" className="h-[50px] rounded-xl bg-violet-600 px-4 text-white hover:brightness-110" target="_blank" href="https://github.com/HolodexNet/raycast-holodex" title="Download Source Code">
          <Icon icon={mdiGithub} />
          Install<br />from Github
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
        <div className="p-4 md:p-6">
          <div className="mb-4 flex items-center gap-3">
            <img src={icon.src} alt={icon.alt} className="h-8 w-8 rounded-lg" />
            <div className="text-2xl font-semibold text-white">{title}</div>
          </div>

          <div className="mb-2 text-lg font-medium text-slate-100">{featuresLabel}</div>
          <ul className="space-y-2 text-sm text-slate-300">
            {features.map((feature, index) => <li key={index}>{feature}</li>)}
          </ul>

          <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
            {children}
          </div>
        </div>
      </div>
    </Card>
  );
}
