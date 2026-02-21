import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getShareSnapshot } from "@/lib/share-store";
import styles from "./share.module.css";

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
  const snapshot = await getShareSnapshot(id);
  if (!snapshot) {
    return { title: "Share not found | Jour" };
  }

  return {
    title: `Discipline Score ${snapshot.score}% | Jour`,
    description: `Green streak ${snapshot.greenStreak}, red streak ${snapshot.redStreak}.`,
    openGraph: {
      title: `Discipline Score ${snapshot.score}%`,
      description: "See my trading consistency in Jour",
      images: [{ url: `/s/${snapshot.id}/opengraph-image` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `Discipline Score ${snapshot.score}%`,
      description: "See my trading consistency in Jour",
      images: [`/s/${snapshot.id}/opengraph-image`],
    },
  };
}

export default async function SharePage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const snapshot = await getShareSnapshot(id);
  if (!snapshot) notFound();

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <h1>My Trading Discipline</h1>
        <p className={styles.month}>
          {monthNames[snapshot.month]} {snapshot.year}
        </p>

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

        <div className={styles.cta}>
          <span>Track your own discipline and grow consistency with Jour.</span>
          <Link href="/login">Open Jour</Link>
        </div>
      </section>
    </main>
  );
}
