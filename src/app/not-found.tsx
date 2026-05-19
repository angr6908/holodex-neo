"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useTranslations } from "next-intl";
export default function NotFound() {
  const t = useTranslations();
  useEffect(() => { document.title = "404 Error - Holodex"; }, []);
  return (
    <section className="mx-auto min-h-screen w-full max-w-[1600px] px-3 pb-10 pt-[var(--nav-total-height,120px)] sm:px-5 flex items-center justify-center">
      <Card className="w-full max-w-lg p-8 text-center">
        <Empty className="flex-none gap-6 rounded-none p-0 md:p-0">
          <EmptyMedia className="mx-auto mb-0 h-14 w-14 text-2xl font-normal">
            404
          </EmptyMedia>
          <EmptyHeader className="max-w-none gap-6">
            <EmptyTitle
              role="heading"
              aria-level={1}
              className="mt-5 text-3xl font-semibold tracking-tight"
            >
              {t("views.notFound.title")}
            </EmptyTitle>
            <EmptyDescription className="mt-3 text-sm">
              The page you requested is missing or no longer available.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="max-w-none gap-0">
            <Button nativeButton={false} render={<Link href="/" />} className="mt-6">
              {t("views.notFound.back")}
            </Button>
          </EmptyContent>
        </Empty>
      </Card>
    </section>
  );
}
