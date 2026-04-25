"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useI18n } from "@/lib/i18n";
import * as icons from "@/lib/icons";

export function ApiErrorMessage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto w-full max-w-xl px-3 text-center sm:px-4">
      <div className="space-y-3 py-2">
        <div className="flex justify-center">
          <Button variant="outline" size="sm" as="a" href="/" className="rounded-lg px-3">
            <Icon icon={icons.mdiRefresh} size="sm" />
            <span>Refresh</span>
          </Button>
        </div>
        <div className="text-2xl font-semibold tracking-tight text-[color:var(--color-foreground)]">{t("component.apiError.title")}</div>
        <p className="mx-auto max-w-[34rem] text-sm leading-6 text-[color:var(--color-muted-foreground)]">
          {t("component.apiError.textBeforeTwitter")}{" "}
          <a href="https://twitter.com/holodex" rel="noopener noreferrer" className="font-medium text-[color:var(--color-primary)] no-underline hover:underline">@holodex</a>
          {" "}{t("component.apiError.textAfterTwitter")}{" "}
          <a href="https://discord.gg/jctkgHBt4b" rel="noopener noreferrer" className="font-medium text-[color:var(--color-primary)] no-underline hover:underline">Discord</a>{t("component.apiError.afterAboutPageHyperlink")}
        </p>
        <p className="mx-auto text-xs leading-5 text-[color:var(--color-muted-foreground)]">
          Tip: Hard Refresh/Clear Cache: <code className="rounded px-1.5 py-0.5 text-[color:var(--color-foreground)]">CTRL + SHIFT + R</code>
        </p>
      </div>
    </div>
  );
}
