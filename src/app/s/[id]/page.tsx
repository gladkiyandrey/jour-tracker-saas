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
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://consist.online").replace(/\/$/, "");
  const verifyUrl = `${appUrl}/share/verify/${snapshot.id}`;
  const activeDays = snapshot.days.length;
  const greenDays = snapshot.days.filter((d) => d.variant !== "neg").length;
  const redDays = snapshot.days.filter((d) => d.variant === "neg").length;
  const consistencyRate = activeDays > 0 ? Math.round((greenDays / activeDays) * 100) : 0;
  const generatedAt = new Date(snapshot.createdAt);
  const generatedText = Number.isNaN(generatedAt.getTime()) ? "Unknown date" : generatedAt.toLocaleDateString("en-US");
  const bars = snapshot.days
    .slice()
    .sort((a, b) => a.day - b.day)
    .map((d) => ({
      day: d.day,
      type: d.variant === "neg" ? "neg" : d.variant === "pos-outline" ? "outline" : "pos",
      height: d.variant === "neg" ? 74 : d.variant === "pos-outline" ? 52 : 40,
    }));
  const axisLabels = bars.filter((_, i) => i % Math.max(1, Math.ceil(bars.length / 10)) === 0 || i === bars.length - 1);
  const scoreLabel = snapshot.score >= 80 ? "Elite discipline" : snapshot.score >= 65 ? "Consistent trader" : "In recovery mode";

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.glowA} aria-hidden />
        <div className={styles.glowB} aria-hidden />
        <div className={styles.noise} aria-hidden />

        <header className={styles.head}>
          <div className={styles.brandWrap}>
            <span className={styles.brand}>CONSIST</span>
            <span className={styles.verifyChip}>Verified Snapshot</span>
          </div>
          <span className={styles.periodPill}>
            {monthNames[snapshot.month]} {snapshot.year}
          </span>
        </header>

        <section className={styles.hero}>
          <div className={styles.heroLeft}>
            <span className={styles.heroTag}>Reward</span>
            <h1>{snapshot.score}%</h1>
            <p>{scoreLabel}</p>
            <div className={styles.heroMeta}>
              <span>{activeDays} tracked days</span>
              <span>{consistencyRate}% positive days</span>
            </div>
          </div>
          <div className={styles.heroRight}>
            <span className={styles.qrLabel}>Scan & verify</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.qrImage}
              src={`/api/share/qr/${snapshot.id}`}
              alt={`Verification QR for share ${snapshot.id}`}
              width={160}
              height={160}
            />
            <a href={verifyUrl} target="_blank" rel="noreferrer" className={styles.verifyUrl}>
              {verifyUrl}
            </a>
          </div>
        </section>

        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <i className={`${styles.legendLine} ${styles.legendYellow}`} /> Consistency
          </span>
          <span className={styles.legendItem}>
            <i className={`${styles.legendLine} ${styles.legendBlue}`} /> Deposit size
          </span>
          <span className={styles.legendHint}>Generated: {generatedText}</span>
        </div>

        <div className={styles.chartShell}>
          <div className={styles.chartBackdrop} />
          <div className={styles.barLayer} aria-hidden>
            {bars.length ? (
              bars.map((bar) => (
                <div key={`bar-${bar.day}`} className={`${styles.bar} ${styles[`bar_${bar.type}`]}`} style={{ height: `${bar.height}%` }} />
              ))
            ) : (
              <div className={styles.barEmpty} />
            )}
          </div>
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
          <div className={styles.axisRow} aria-hidden>
            {axisLabels.map((point) => (
              <span key={`axis-${point.day}`}>{point.day}</span>
            ))}
          </div>
        </div>

        <section className={styles.metrics}>
          <div className={styles.metric}>
            <span>Green Streak</span>
            <strong>{snapshot.greenStreak}</strong>
          </div>
          <div className={styles.metric}>
            <span>Red Streak</span>
            <strong>{snapshot.redStreak}</strong>
          </div>
          <div className={styles.metric}>
            <span>Month Balance</span>
            <strong>{greenDays} / {greenDays + redDays}</strong>
          </div>
        </section>

        <div className={styles.cta}>
          <span>Show your discipline publicly</span>
          <Link href="/login">Build your own card</Link>
        </div>
      </section>
    </main>
  );
}
