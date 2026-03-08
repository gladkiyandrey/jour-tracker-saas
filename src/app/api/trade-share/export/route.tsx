import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CARD_WIDTH = 450;
const CARD_HEIGHT = 600;
const EXPORT_SCALE = 2;

type Point = { t: string; ts: number; c: number };

type PreviewPayload = {
  symbol: string;
  interval: string;
  points: Point[];
  min: number;
  max: number;
  entryIndex: number;
  exitIndex: number;
  tradeStart: number;
  tradeEnd: number;
  entryPriceInput: number | string | null;
  exitPriceInput: number | string | null;
  entryTime: string;
  exitTime: string;
};

type ExportRequest = {
  preview: PreviewPayload;
  positionSide: "long" | "short";
  stopLoss: number | string;
  riskPercent: number | string;
  timeZone: string;
};

function formatPrice(v: number | string | null) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "n/a";
  return `${n.toFixed(5)} USD`;
}

function formatCompactDate(value: string, timeZone: string) {
  const d = new Date(value);
  return d
    .toLocaleString("en-US", {
      timeZone,
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "");
}

function formatDuration(start: string, end: string) {
  const diffSec = Math.max(0, Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000));
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  return `${h}h ${m}m`;
}

function formatPct(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function buildChart(preview: PreviewPayload, manualEntryPrice: number, manualExitPrice: number) {
  const w = CARD_WIDTH;
  const h = CARD_HEIGHT;
  const left = 45;
  const right = 405;
  const top = 84;
  const bottom = 265;
  const innerW = right - left;
  const innerH = bottom - top;

  const safeMin = preview.min;
  const safeMax = preview.max === preview.min ? preview.max + 1 : preview.max;

  const toX = (index: number) => left + (index / (preview.points.length - 1)) * innerW;
  const toY = (price: number) => {
    const y = top + ((safeMax - price) / (safeMax - safeMin)) * innerH;
    return Math.max(top, Math.min(bottom, y));
  };

  const fullPath = preview.points
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(2)} ${toY(p.c).toFixed(2)}`)
    .join(" ");

  const seg = preview.points.slice(preview.tradeStart, preview.tradeEnd + 1);
  const segPath = seg
    .map((p, i) => {
      const idx = preview.tradeStart + i;
      return `${i === 0 ? "M" : "L"}${toX(idx).toFixed(2)} ${toY(p.c).toFixed(2)}`;
    })
    .join(" ");

  const fillPath = [
    segPath,
    `L ${toX(preview.tradeEnd).toFixed(2)} ${(top + innerH).toFixed(2)}`,
    `L ${toX(preview.tradeStart).toFixed(2)} ${(top + innerH).toFixed(2)}`,
    "Z",
  ].join(" ");

  return {
    w,
    h,
    fullPath,
    segPath,
    fillPath,
    entryX: toX(preview.entryIndex),
    exitX: toX(preview.exitIndex),
    right,
    entryMarkerY: toY(Number.isFinite(manualEntryPrice) && manualEntryPrice > 0 ? manualEntryPrice : preview.points[preview.entryIndex].c),
    exitMarkerY: toY(Number.isFinite(manualExitPrice) && manualExitPrice > 0 ? manualExitPrice : preview.points[preview.exitIndex].c),
    toY,
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ExportRequest;
    const preview = body.preview;
    if (!preview || !Array.isArray(preview.points) || preview.points.length < 2) {
      return new Response(JSON.stringify({ error: "Preview payload is missing or invalid" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const positionSide = body.positionSide === "short" ? "short" : "long";
    const timeZone = String(body.timeZone || "UTC");
    const manualEntryPrice = Number(preview.entryPriceInput ?? 0);
    const manualStopLoss = Number(body.stopLoss ?? 0);
    const manualExitPrice = Number(preview.exitPriceInput ?? 0);
    const riskValue = Math.abs(Number(body.riskPercent ?? 0));
    const rrValue =
      Number.isFinite(manualEntryPrice) &&
      Number.isFinite(manualStopLoss) &&
      Number.isFinite(manualExitPrice) &&
      manualEntryPrice > 0
        ? positionSide === "short"
          ? (manualEntryPrice - manualExitPrice) / (manualStopLoss - manualEntryPrice)
          : (manualExitPrice - manualEntryPrice) / (manualEntryPrice - manualStopLoss)
        : null;
    const tradeOutcome =
      rrValue !== null && Number.isFinite(rrValue) ? (rrValue > 0 ? "profit" : rrValue < 0 ? "loss" : "breakeven") : "breakeven";
    const pnlPct = rrValue !== null && Number.isFinite(rrValue) ? riskValue * rrValue : null;
    const chart = buildChart(preview, manualEntryPrice, manualExitPrice);

    const origin = new URL(req.url).origin;
    const noiseUrl = `${origin}/trade-share/figma-82-1109/overlay-noise.jpg`;
    const logoUrl = `${origin}/brand/consist-logo-white.svg`;
    const cornerGlowUrl = `${origin}/trade-share/figma-82-1109/corner-ring.svg`;

    return new ImageResponse(
      (
        <div
          style={{
            width: `${CARD_WIDTH * EXPORT_SCALE}px`,
            height: `${CARD_HEIGHT * EXPORT_SCALE}px`,
            display: "flex",
            position: "relative",
            overflow: "hidden",
            background: "transparent",
          }}
        >
          <div
            style={{
              width: `${CARD_WIDTH}px`,
              height: `${CARD_HEIGHT}px`,
              display: "flex",
              position: "relative",
              overflow: "hidden",
              borderRadius: "25px",
              background: "#131722",
              color: "#fff",
              fontFamily: "Inter, Arial, sans-serif",
              boxShadow: "inset 5px 5px 21.9px rgba(255,255,255,0.1)",
              transform: `scale(${EXPORT_SCALE})`,
              transformOrigin: "top left",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={noiseUrl} alt="" width="526" height="1051" style={{ position: "absolute", left: "-8px", top: "-9px", opacity: 1 }} />
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "25px",
                boxShadow: "inset 5px 5px 21.9px rgba(255,255,255,0.1)",
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoUrl}
              alt=""
              width="400"
              height="110"
              style={{ position: "absolute", left: "25px", top: "245px", opacity: 0.15 }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cornerGlowUrl} alt="" width="74" height="74" style={{ position: "absolute", left: "386px", top: "526px", opacity: 0.9 }} />

            <svg width="450" height="600" viewBox="0 0 450 600" style={{ position: "absolute", left: 0, top: 0 }}>
            <defs>
              <linearGradient id="trade-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00FFA3" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#00FFA3" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="trade-gradient-loss" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF6B7A" stopOpacity="0.42" />
                <stop offset="100%" stopColor="#FF6B7A" stopOpacity="0" />
              </linearGradient>
              <filter id="position-glow-blur" x="-15%" y="-20%" width="130%" height="160%">
                <feGaussianBlur stdDeviation="2" />
              </filter>
            </defs>
            <path d={chart.fullPath} fill="none" stroke="rgba(160,167,180,0.55)" strokeWidth="2.5" />
            <path d={chart.fillPath} fill={tradeOutcome === "loss" ? "url(#trade-gradient-loss)" : "url(#trade-gradient)"} />
            <path
              d={`M ${chart.entryX.toFixed(2)} ${chart.entryMarkerY.toFixed(2)} L ${chart.right.toFixed(2)} ${chart.entryMarkerY.toFixed(2)}`}
              fill="none"
              stroke="rgba(255,210,74,0.45)"
              strokeWidth="1.2"
              strokeDasharray="5 5"
            />
            <path
              d={`M ${chart.entryX.toFixed(2)} ${chart.exitMarkerY.toFixed(2)} L ${chart.right.toFixed(2)} ${chart.exitMarkerY.toFixed(2)}`}
              fill="none"
              stroke={tradeOutcome === "loss" ? "rgba(255,107,122,0.45)" : "rgba(0,255,163,0.45)"}
              strokeWidth="1.2"
              strokeDasharray="5 5"
            />
            <path
              d={chart.segPath}
              fill="none"
              stroke={tradeOutcome === "loss" ? "#FF6B7A" : "#00FFA3"}
              strokeWidth="2"
              opacity="0.8"
              filter="url(#position-glow-blur)"
            />
            <path d={chart.segPath} fill="none" stroke={tradeOutcome === "loss" ? "#FF6B7A" : "#00FFA3"} strokeWidth="3.4" />
            <circle cx={chart.entryX} cy={chart.entryMarkerY} r="6.5" fill="#0f1424" stroke="#ffd24a" strokeWidth="4" />
            <circle
              cx={chart.exitX}
              cy={chart.exitMarkerY}
              r="6.5"
              fill="#0f1424"
              stroke={tradeOutcome === "loss" ? "#ff6b7a" : "#00ffa3"}
              strokeWidth="4"
            />
            </svg>

            <div
              style={{
                position: "absolute",
                left: "34px",
                top: "40px",
                right: "34px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div
                style={{
                  fontSize: "22px",
                  lineHeight: 1.1,
                  fontWeight: 500,
                  maxWidth: "170px",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {preview.symbol}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  marginLeft: "14px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: positionSide === "short" ? "#ffb36f" : "#6fd7ff",
                }}
              >
                <span>{positionSide === "short" ? "↘" : "↗"}</span>
                <span>{positionSide === "short" ? "Short" : "Long"}</span>
              </div>
              <div
                style={{
                  marginLeft: "auto",
                  minWidth: "78px",
                  maxWidth: "92px",
                  height: "30px",
                  padding: "0 10px",
                  borderRadius: "999px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "13px",
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  color: tradeOutcome === "loss" ? "#ff6b7a" : "#00ffa3",
                  background: tradeOutcome === "loss" ? "rgba(255,107,122,0.12)" : "rgba(0,255,163,0.1)",
                  border: `1px solid ${tradeOutcome === "loss" ? "rgba(255,107,122,0.26)" : "rgba(0,255,163,0.24)"}`,
                }}
              >
                {formatPct(pnlPct)}
              </div>
            </div>

            <div
              style={{
                position: "absolute",
                left: "35px",
                top: "333px",
                width: "326px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {[
                ["Entry price", formatPrice(preview.entryPriceInput)],
                ["Exit price", formatPrice(preview.exitPriceInput)],
                ["Stop loss", formatPrice(body.stopLoss)],
                ["Open Date", formatCompactDate(preview.entryTime, timeZone)],
                ["Close Date", formatCompactDate(preview.exitTime, timeZone)],
                ["Duration", formatDuration(preview.entryTime, preview.exitTime)],
                ["Risk", `${body.riskPercent || "0.00"}%`],
                ["RR", rrValue !== null && Number.isFinite(rrValue) ? rrValue.toFixed(2) : "0.00"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "326px",
                  }}
                >
                  <span
                    style={{
                      width: "143px",
                      flexShrink: 0,
                      fontSize: "16px",
                      lineHeight: 1.18,
                      color: "#fff",
                    }}
                  >
                    {label}
                  </span>
                  <strong
                    style={{
                      width: "183px",
                      flexShrink: 0,
                      fontSize: "16px",
                      lineHeight: 1.18,
                      color: "#fff",
                      fontWeight: 400,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {value}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
      {
        width: CARD_WIDTH * EXPORT_SCALE,
        height: CARD_HEIGHT * EXPORT_SCALE,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export card";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}
