"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useI18n } from "@/lib/i18n";

export function NotFoundView() {
  const { t } = useI18n();
  useEffect(() => { document.title = "404 Error - Holodex"; }, []);
  return (
    <section className="flex min-h-[70vh] items-center justify-center px-4 py-10">
      <Card className="w-full max-w-lg p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-2xl font-semibold text-white">
          404
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white">
          {t("views.notFound.title")}
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          The page you requested is missing or no longer available.
        </p>
        <Button as={Link} href="/" className="mt-6">
          {t("views.notFound.back")}
        </Button>
      </Card>
    </section>
  );
}
