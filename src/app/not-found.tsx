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
    <section className="app-page flex items-center justify-center">
      <Card className="w-full max-w-lg p-8 text-center">
        <Empty className="flex-none gap-6 rounded-none p-0 md:p-0">
          <EmptyMedia className="mx-auto mb-0 h-14 w-14 rounded-2xl border border-white/10 bg-white/6 text-2xl font-semibold text-white">
            404
          </EmptyMedia>
          <EmptyHeader className="max-w-none gap-6">
            <EmptyTitle
              role="heading"
              aria-level={1}
              className="mt-5 text-3xl font-semibold tracking-tight text-white"
            >
              {t("views.notFound.title")}
            </EmptyTitle>
            <EmptyDescription className="mt-3 text-sm text-slate-400">
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
