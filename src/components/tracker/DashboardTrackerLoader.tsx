"use client";

import dynamic from "next/dynamic";
import type { Locale } from "@/lib/i18n";

type Props = {
  userKey: string;
  locale: Locale;
};

const TrackerClient = dynamic(() => import("@/components/tracker/TrackerClient"), {
  ssr: false,
  loading: () => (
    <section className="tracker-skeleton" aria-label="Loading tracker">
      <div className="tracker-skeleton-main">
        <div className="skeleton-line title" />
        <div className="skeleton-line legend" />
        <div className="skeleton-chart" />
        <div className="skeleton-cards">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      </div>
      <div className="tracker-skeleton-side">
        <div className="skeleton-calendar" />
        <div className="skeleton-ai" />
      </div>
    </section>
  ),
});

export default function DashboardTrackerLoader({ userKey, locale }: Props) {
  return <TrackerClient userKey={userKey} locale={locale} />;
}
