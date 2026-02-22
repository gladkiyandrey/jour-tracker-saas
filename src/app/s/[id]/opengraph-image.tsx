import { ImageResponse } from "next/og";
import { getShareSnapshot } from "@/lib/share-store";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const snapshot = await getShareSnapshot(id);

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

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px",
          background:
            "radial-gradient(circle at 20% 10%, rgba(34, 92, 255, 0.35) 0%, rgba(34, 92, 255, 0) 40%), radial-gradient(circle at 80% 90%, rgba(255, 201, 71, 0.3) 0%, rgba(255, 201, 71, 0) 50%), #070b16",
          color: "#f4f7ff",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 52, fontWeight: 700 }}>Trading Discipline</div>
            <div style={{ marginTop: 10, fontSize: 26, color: "#b8c7f5" }}>
              Score {snapshot.score}% · Green {snapshot.greenStreak} · Red {snapshot.redStreak}
            </div>
          </div>
          <div
            style={{
              border: "1px solid rgba(121,145,228,0.42)",
              borderRadius: 999,
              padding: "10px 18px",
              fontSize: 22,
              background: "rgba(15,22,40,0.8)",
            }}
          >
            consist.online
          </div>
        </div>

        <div
          style={{
            width: "100%",
            height: 250,
            borderRadius: 14,
            border: "1px solid rgba(123,141,204,0.35)",
            background: "rgba(12,17,30,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="1100" height="230" viewBox="0 0 520 280">
            <path d={snapshot.chartYellow} fill="none" stroke="rgba(255,210,74,0.72)" strokeWidth="5" strokeLinecap="round" />
            <path d={snapshot.chartBlue} fill="none" stroke="rgba(47,131,255,0.72)" strokeWidth="5" strokeLinecap="round" />
            <path d={snapshot.chartYellow} fill="none" stroke="#ffd24a" strokeWidth="3" strokeLinecap="round" />
            <path d={snapshot.chartBlue} fill="none" stroke="#2f83ff" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#d9e2ff" }}>
          <div>Share your consistency with Consist</div>
          <div>Open: consist.online</div>
        </div>
      </div>
    ),
    size
  );
}
