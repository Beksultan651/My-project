"use client";

import Link from "next/link";
import { useI18n } from "@/components/i18n-provider";

export default function NotFound() { const { t } = useI18n(); return <section className="panel empty-state"><p className="eyebrow">404</p><h1>{t("notFound")}</h1><p>{t("notFoundBody")}</p><Link href="/" className="button button-primary">{t("backHome")}</Link></section>; }
