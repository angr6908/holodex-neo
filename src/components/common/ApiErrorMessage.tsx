"use client";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

import { Kbd } from "@/components/ui/kbd";
import { useTranslations } from "next-intl";
import * as icons from "@/lib/icons";

export function ApiErrorMessage() {
  const t = useTranslations();
  return (
    <Empty className="mx-auto w-full max-w-xl flex-none gap-3 px-3 py-2 text-wrap sm:px-4 md:px-4 md:py-2">
      <EmptyContent className="max-w-none gap-0">
        <Button nativeButton={false}
          render={<a href="/" />}
          variant="outline"
          size="sm"
          className="rounded-lg px-3"
        >
          <icons.RefreshCw className="size-4" />
          <span>{t("component.apiError.refresh")}</span>
        </Button>
      </EmptyContent>
      <EmptyHeader className="max-w-[34rem] gap-3">
        <EmptyTitle className="text-2xl font-semibold text-[color:var(--color-foreground)]">{t("component.apiError.title")}</EmptyTitle>
        <EmptyDescription className="max-w-[34rem] text-sm leading-6 text-[color:var(--color-muted-foreground)] [&>a]:font-medium [&>a]:text-[color:var(--color-primary)] [&>a]:no-underline [&>a:hover]:underline">
          {t("component.apiError.textBeforeTwitter")}{" "}
          <a href="https://twitter.com/holodex" rel="noopener noreferrer">@holodex</a>
          {" "}{t("component.apiError.textAfterTwitter")}{" "}
          <a href="https://discord.gg/jctkgHBt4b" rel="noopener noreferrer">Discord</a>{t("component.apiError.afterAboutPageHyperlink")}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyDescription className="mx-auto text-xs leading-5 text-[color:var(--color-muted-foreground)]">
        {t("component.apiError.hardRefreshTip")} <Kbd className="h-auto min-w-0 rounded bg-transparent px-1.5 py-0.5 font-mono text-[color:var(--color-foreground)]">CTRL + SHIFT + R</Kbd>
      </EmptyDescription>
    </Empty>
  );
}
