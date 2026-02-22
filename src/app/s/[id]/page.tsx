import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getShareSnapshot } from "@/lib/share-store";
import styles from "./share.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://consist.online").replace(/\/$/, "");
  const ogImageUrl = `${appUrl}/s/${id}/opengraph-image`;
  let snapshot = null;
  try {
    snapshot = await getShareSnapshot(id);
  } catch {
    snapshot = null;
  }
  if (!snapshot) {
    return {
      title: "Share not found | Consist",
      description: "Trading discipline snapshot by Consist.",
      openGraph: {
        title: "Share not found | Consist",
        description: "Trading discipline snapshot by Consist.",
        url: `${appUrl}/s/${id}`,
        siteName: "Consist",
        type: "website",
        images: [{ url: ogImageUrl, width: 1200, height: 630, type: "image/png" }],
      },
      twitter: {
        card: "summary_large_image",
        title: "Share not found | Consist",
        description: "Trading discipline snapshot by Consist.",
        images: [ogImageUrl],
      },
    };
  }

  return {
    title: `Discipline Score ${snapshot.score}% | Consist`,
    description: `I built a ${snapshot.score}% trading discipline this month. Can you beat it?`,
    alternates: {
      canonical: `${appUrl}/s/${snapshot.id}`,
    },
    openGraph: {
      title: `Discipline Score ${snapshot.score}%`,
      description: `I built a ${snapshot.score}% trading discipline this month. Can you beat it?`,
      url: `${appUrl}/s/${snapshot.id}`,
      siteName: "Consist",
      type: "website",
      locale: "en_US",
      images: [{ url: ogImageUrl, width: 1200, height: 630, type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Discipline Score ${snapshot.score}%`,
      description: `I built a ${snapshot.score}% trading discipline this month. Can you beat it?`,
      images: [ogImageUrl],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function SharePage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const snapshot = await getShareSnapshot(id);
  if (!snapshot) notFound();
  const activeDays = snapshot.days.length;
  const greenDays = snapshot.days.filter((d) => d.variant !== "neg").length;
  const redDays = snapshot.days.filter((d) => d.variant === "neg").length;
  const consistencyRate = activeDays > 0 ? Math.round((greenDays / activeDays) * 100) : 0;
  const generatedAt = new Date(snapshot.createdAt);
  const generatedText = Number.isNaN(generatedAt.getTime()) ? "Unknown date" : generatedAt.toLocaleDateString("en-US");

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.topMeta}>
          <span className={styles.brandPill}>Consist</span>
          <span className={styles.periodPill}>
            {monthNames[snapshot.month]} {snapshot.year}
          </span>
        </div>
        <h1>I built a {snapshot.score}% trading discipline this month.</h1>
        <p className={styles.month}>Can you beat this score?</p>

        <div className={styles.summaryStrip}>
          <span>{activeDays} tracked days</span>
          <span>{consistencyRate}% positive days</span>
          <span>Generated: {generatedText}</span>
        </div>

        <div className={styles.stats}>
          <div className={styles.statBox}>
            <span>Discipline Score</span>
            <strong>{snapshot.score}%</strong>
          </div>
          <div className={styles.statBox}>
            <span>Green Streak</span>
            <strong>{snapshot.greenStreak}</strong>
          </div>
          <div className={styles.statBox}>
            <span>Red Streak</span>
            <strong>{snapshot.redStreak}</strong>
          </div>
        </div>

        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <i className={`${styles.legendLine} ${styles.legendYellow}`} /> Consistency
          </span>
          <span className={styles.legendItem}>
            <i className={`${styles.legendLine} ${styles.legendBlue}`} /> Deposit size
          </span>
          <span className={styles.legendHint}>Auto-generated from journal data</span>
        </div>

        <div className={styles.chartShell}>
          <svg className={styles.chart} viewBox="0 0 520 280" preserveAspectRatio="none" aria-hidden>
            <g>
              <line className={styles.grid} x1="20" y1="30" x2="500" y2="30" />
              <line className={styles.grid} x1="20" y1="80" x2="500" y2="80" />
              <line className={styles.grid} x1="20" y1="130" x2="500" y2="130" />
              <line className={styles.grid} x1="20" y1="180" x2="500" y2="180" />
              <line className={styles.grid} x1="20" y1="230" x2="500" y2="230" />
            </g>
            <path className={styles.yellowGlow} d={snapshot.chartYellow} />
            <path className={styles.blueGlow} d={snapshot.chartBlue} />
            <path className={styles.yellow} d={snapshot.chartYellow} />
            <path className={styles.blue} d={snapshot.chartBlue} />
          </svg>
        </div>

        <div className={styles.cta}>
          <span>
            Green days {greenDays} · Red days {redDays} · Built for disciplined traders.
          </span>
          <Link href="/login">Build your own score</Link>
        </div>
      </section>
    </main>
  );
}
