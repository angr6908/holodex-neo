"use client";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

import { Kbd } from "@/components/ui/kbd";
import { useTranslations } from "next-intl";
import * as icons from "@/lib/icons";

export function ApiErrorMessage() {
  const t = useTranslations();
  return (
    <Empty className="mx-auto w-full max-w-xl flex-none">
      <EmptyContent>
        <Button nativeButton={false}
          render={<a href="/" />}
          variant="outline"
          size="sm"
        >
          <icons.RefreshCw className="size-4" />
          <span>{t("component.apiError.refresh")}</span>
        </Button>
      </EmptyContent>
      <EmptyHeader>
        <EmptyTitle>{t("component.apiError.title")}</EmptyTitle>
        <EmptyDescription>
          {t("component.apiError.textBeforeTwitter")}{" "}
          <a href="https://twitter.com/holodex" rel="noopener noreferrer">@holodex</a>
          {" "}{t("component.apiError.textAfterTwitter")}{" "}
          <a href="https://discord.gg/jctkgHBt4b" rel="noopener noreferrer">Discord</a>{t("component.apiError.afterAboutPageHyperlink")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyDescription>
        {t("component.apiError.hardRefreshTip")} <Kbd>Ctrl + Shift + R</Kbd>
      </EmptyDescription>
    </Empty>
  );
}
