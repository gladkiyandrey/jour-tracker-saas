import { ImageResponse } from "next/og";
import { getShareSnapshot } from "@/lib/share-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let snapshot = null;
  try {
    snapshot = await getShareSnapshot(id);
  } catch {
    snapshot = null;
  }

  if (!snapshot) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0b1120",
            color: "#f2f5ff",
            fontSize: 48,
          }}
        >
          Consist
        </div>
      ),
      size
    );
  }
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
  const activeDays = snapshot.days.length;
  const greenDays = snapshot.days.filter((d) => d.variant !== "neg").length;
  const redDays = snapshot.days.filter((d) => d.variant === "neg").length;
  const bars = snapshot.days
    .slice()
    .sort((a, b) => a.day - b.day)
    .map((d) => ({
      day: d.day,
      type: d.variant === "neg" ? "neg" : d.variant === "pos-outline" ? "outline" : "pos",
      height: d.variant === "neg" ? 110 : d.variant === "pos-outline" ? 82 : 64,
    }));
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://consist.online").replace(/\/$/, "");
  const verifyUrl = `${appUrl}/share/verify/${snapshot.id}`;
  const qrUrl = `${appUrl}/api/share/qr/${snapshot.id}`;
  const scoreLabel = snapshot.score >= 80 ? "Elite discipline" : snapshot.score >= 65 ? "Consistent trader" : "In recovery mode";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "34px",
          background:
            "radial-gradient(circle at 14% 12%, rgba(69,108,255,0.24) 0%, rgba(69,108,255,0) 40%), radial-gradient(circle at 88% 84%, rgba(34,214,172,0.16) 0%, rgba(34,214,172,0) 45%), #070b16",
          color: "#f4f7ff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 20, letterSpacing: 2, color: "#dce6ff" }}>CONSIST VERIFIED</div>
            <div style={{ fontSize: 62, fontWeight: 700, letterSpacing: -1 }}>REWARD</div>
          </div>
          <div
            style={{
              border: "1px solid rgba(121,145,228,0.42)",
              borderRadius: 999,
              padding: "8px 16px",
              fontSize: 20,
              background: "rgba(15,22,40,0.8)",
            }}
          >
            consist.online
          </div>
        </div>

        <div
          style={{
            marginTop: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 16px",
            borderRadius: 14,
            border: "1px solid rgba(123,141,204,0.34)",
            background: "linear-gradient(180deg, rgba(12,17,30,0.85), rgba(7,11,22,0.9))",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 18, color: "#b8c7f5" }}>
              {monthNames[snapshot.month]} {snapshot.year}
            </div>
            <div style={{ fontSize: 62, fontWeight: 700, lineHeight: 0.94 }}>{snapshot.score}%</div>
            <div style={{ fontSize: 20, color: "#d7e0ff" }}>{scoreLabel}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 18, color: "#d9e2ff", textAlign: "right" }}>
            <span>{activeDays} tracked days</span>
            <span>{greenDays} green days</span>
            <span>{redDays} red days</span>
          </div>
        </div>

        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 20, fontSize: 20, color: "#d9e2ff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 0, borderTop: "4px solid #ffd24a", borderRadius: 999 }} />
            Consistency
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 0, borderTop: "4px solid #2f83ff", borderRadius: 999 }} />
            Deposit size
          </div>
          <div style={{ marginLeft: "auto", color: "#b8c7f5" }}>Verified share card</div>
        </div>

        <div style={{ width: "100%", height: 250, display: "flex", alignItems: "stretch", gap: 14 }}>
          <div
            style={{
              flex: 1,
              borderRadius: 14,
              border: "1px solid rgba(123,141,204,0.35)",
              background:
                "linear-gradient(180deg, rgba(12,17,30,0.85), rgba(7,11,22,0.9)), radial-gradient(circle at 20% 0, rgba(89,123,255,0.2), rgba(89,123,255,0))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 22,
                right: 22,
                bottom: 24,
                height: 94,
                display: "flex",
                alignItems: "flex-end",
                gap: 6,
              }}
            >
              {bars.map((bar, index) => (
                <div
                  key={`og-bar-${bar.day}-${index}`}
                  style={{
                    flex: 1,
                    borderRadius: "8px 8px 4px 4px",
                    height: bar.height,
                    background:
                      bar.type === "neg"
                        ? "linear-gradient(180deg, rgba(255,108,138,0.58), rgba(255,108,138,0.15))"
                        : bar.type === "outline"
                          ? "linear-gradient(180deg, rgba(255,216,98,0.55), rgba(255,216,98,0.14))"
                          : "linear-gradient(180deg, rgba(41,255,180,0.5), rgba(41,255,180,0.12))",
                  }}
                />
              ))}
            </div>
            <svg width="950" height="230" viewBox="0 0 520 280">
              <path d={snapshot.chartYellow} fill="none" stroke="rgba(255,210,74,0.72)" strokeWidth="5" strokeLinecap="round" />
              <path d={snapshot.chartBlue} fill="none" stroke="rgba(47,131,255,0.72)" strokeWidth="5" strokeLinecap="round" />
              <path d={snapshot.chartYellow} fill="none" stroke="#ffd24a" strokeWidth="3" strokeLinecap="round" />
              <path d={snapshot.chartBlue} fill="none" stroke="#2f83ff" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <div
            style={{
              width: 214,
              borderRadius: 14,
              border: "1px solid rgba(123,141,204,0.35)",
              background:
                "linear-gradient(180deg, rgba(12,17,30,0.85), rgba(7,11,22,0.9)), radial-gradient(circle at 80% 20%, rgba(152,109,255,0.2), rgba(152,109,255,0))",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              color: "#d9e2ff",
              fontSize: 17,
            }}
          >
            <div>Scan to verify</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="QR code to verify share" width={124} height={124} style={{ borderRadius: 8, background: "#ffffff", padding: 4 }} />
            <div style={{ color: "#aebfe9", fontSize: 13 }}>share/verify/{snapshot.id}</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 21, color: "#d9e2ff" }}>
          <div>
            Discipline Score {snapshot.score}% · Green streak {snapshot.greenStreak} · Red streak {snapshot.redStreak}
          </div>
          <div>{verifyUrl}</div>
        </div>
      </div>
    ),
    size
  );
}
