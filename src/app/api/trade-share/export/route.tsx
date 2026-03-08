import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const CARD_WIDTH = 382;
const CARD_HEIGHT = 531;
const EXPORT_SCALE = 3;
const CHART_LEFT = 30;
const CHART_RIGHT = 352;
const CHART_TOP = 79;
const CHART_BOTTOM = 252;
const inter400 = readFile(join(process.cwd(), "public/inter-400.ttf"));
const inter500 = readFile(join(process.cwd(), "public/inter-500.ttf"));
const inter600 = readFile(join(process.cwd(), "public/inter-600.ttf"));
const inter700 = readFile(join(process.cwd(), "public/inter-700.ttf"));

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
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const day = parts.find((part) => part.type === "day")?.value || "";
  const month = parts.find((part) => part.type === "month")?.value || "";
  const hour = parts.find((part) => part.type === "hour")?.value || "";
  const minute = parts.find((part) => part.type === "minute")?.value || "";
  return `${day} ${month}, ${hour}:${minute}`;
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

function buildChart(preview: PreviewPayload) {
  const safeMin = preview.min;
  const safeMax = preview.max === preview.min ? preview.max + 1 : preview.max;
  const innerW = CHART_RIGHT - CHART_LEFT;
  const innerH = CHART_BOTTOM - CHART_TOP;

  const toX = (index: number) => CHART_LEFT + (index / (preview.points.length - 1)) * innerW;
  const toY = (price: number) => {
    const y = CHART_TOP + ((safeMax - price) / (safeMax - safeMin)) * innerH;
    return Math.max(CHART_TOP, Math.min(CHART_BOTTOM, y));
  };

  const fullPath = preview.points
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(2)} ${toY(p.c).toFixed(2)}`)
    .join(" ");

  const segment = preview.points.slice(preview.tradeStart, preview.tradeEnd + 1);
  const segPath = segment
    .map((p, i) => {
      const idx = preview.tradeStart + i;
      return `${i === 0 ? "M" : "L"}${toX(idx).toFixed(2)} ${toY(p.c).toFixed(2)}`;
    })
    .join(" ");

  const fillPath = [
    segPath,
    `L ${toX(preview.tradeEnd).toFixed(2)} ${CHART_BOTTOM.toFixed(2)}`,
    `L ${toX(preview.tradeStart).toFixed(2)} ${CHART_BOTTOM.toFixed(2)}`,
    "Z",
  ].join(" ");

  return {
    fullPath,
    segPath,
    fillPath,
    entryX: toX(preview.entryIndex),
    exitX: toX(preview.exitIndex),
    entryMarkerY: toY(preview.points[preview.entryIndex].c),
    exitMarkerY: toY(preview.points[preview.exitIndex].c),
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
      rrValue !== null && Number.isFinite(rrValue)
        ? rrValue > 0
          ? "profit"
          : rrValue < 0
            ? "loss"
            : "breakeven"
        : "breakeven";
    const pnlPct = rrValue !== null && Number.isFinite(rrValue) ? riskValue * rrValue : null;
    const chart = buildChart(preview);
    const segmentColor = tradeOutcome === "loss" ? "#E84A6A" : "#00FFA3";
    const sideColor = positionSide === "short" ? "#E84A6A" : "#00FFA3";
    const [font400, font500, font600, font700] = await Promise.all([inter400, inter500, inter600, inter700]);

    const origin = new URL(req.url).origin;
    const watermarkUrl = `${origin}/trade-share/redesign/consist-watermark.svg`;
    const arrowUrl = `${origin}${positionSide === "short" ? "/trade-share/redesign/shorticon.svg" : "/trade-share/redesign/longicon.svg"}`;

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
              background: "#1c1c1c",
              color: "#d8d8d8",
              fontFamily: "Inter, Arial, sans-serif",
              transform: `scale(${EXPORT_SCALE})`,
              transformOrigin: "top left",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={watermarkUrl}
              alt=""
              width="140"
              height="38"
              style={{ position: "absolute", left: "121px", top: "279px", opacity: 0.84 }}
            />

            <svg width={CARD_WIDTH} height={CARD_HEIGHT} viewBox={`0 0 ${CARD_WIDTH} ${CARD_HEIGHT}`} style={{ position: "absolute", left: 0, top: 0 }}>
              <defs>
                <linearGradient id="trade-gradient-profit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="-36.13%" stopColor="#00FFA3" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#00FFA3" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="trade-gradient-loss" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="-36.13%" stopColor="#E84A6A" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#E84A6A" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={chart.fullPath} fill="none" stroke="rgba(129,129,129,0.58)" strokeWidth="1.9" />
              <path d={chart.fillPath} fill={tradeOutcome === "loss" ? "url(#trade-gradient-loss)" : "url(#trade-gradient-profit)"} style={{ mixBlendMode: "color-dodge" }} />
              <path
                d={`M ${chart.entryX.toFixed(2)} ${chart.entryMarkerY.toFixed(2)} L ${chart.entryX.toFixed(2)} ${(CHART_BOTTOM + 12).toFixed(2)}`}
                fill="none"
                stroke="rgba(247,213,0,0.7)"
                strokeWidth="1.15"
                strokeDasharray="5 6"
              />
              <path
                d={`M ${chart.exitX.toFixed(2)} ${chart.exitMarkerY.toFixed(2)} L ${chart.exitX.toFixed(2)} ${(CHART_BOTTOM + 12).toFixed(2)}`}
                fill="none"
                stroke={tradeOutcome === "loss" ? "rgba(232,74,106,0.72)" : "rgba(0,255,163,0.72)"}
                strokeWidth="1.15"
                strokeDasharray="5 6"
              />
              <path d={chart.segPath} fill="none" stroke={segmentColor} strokeWidth="2" />
              <circle cx={chart.entryX} cy={chart.entryMarkerY} r="4.35" fill="#1c1c1c" stroke="#F7D500" strokeWidth="3.2" />
              <circle cx={chart.exitX} cy={chart.exitMarkerY} r="4.35" fill="#1c1c1c" stroke={segmentColor} strokeWidth="3.2" />
            </svg>

            <div
              style={{
                position: "absolute",
                left: "30px",
                top: "26px",
                right: "30px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: "22px",
                  lineHeight: 1.05,
                  fontWeight: 400,
                  color: "#d8d8d8",
                  maxWidth: "120px",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {preview.symbol}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "20px", color: sideColor, fontSize: "14px", fontWeight: 600 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={arrowUrl} alt="" width="11" height="11" style={{ display: "block" }} />
                <span>{positionSide === "short" ? "Short" : "Long"}</span>
              </div>
              <div style={{ marginLeft: "auto", fontSize: "24px", lineHeight: 1, fontWeight: 700, color: tradeOutcome === "loss" ? "#E84A6A" : "#00FFA3" }}>
                {formatPct(pnlPct)}
              </div>
            </div>

            <div
              style={{
                position: "absolute",
                left: "74px",
                top: "334px",
                width: "234px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                color: "#d8d8d8",
              }}
            >
              {[
                ["Entry price", formatPrice(preview.entryPriceInput)],
                ["Exit price", formatPrice(preview.exitPriceInput)],
                ["Open Date", formatCompactDate(preview.entryTime, timeZone)],
                ["Close Date", formatCompactDate(preview.exitTime, timeZone)],
                ["Duration", formatDuration(preview.entryTime, preview.exitTime)],
                ["Risk", `${riskValue || 0}%`],
                ["RR", rrValue !== null && Number.isFinite(rrValue) ? rrValue.toFixed(2) : "0.00"],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", width: "234px", fontSize: "14px", lineHeight: 1.1 }}>
                  <div style={{ width: "143px", flex: "0 0 auto" }}>{label}</div>
                  <div style={{ width: "91px", flex: "0 0 auto", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
      {
        width: CARD_WIDTH * EXPORT_SCALE,
        height: CARD_HEIGHT * EXPORT_SCALE,
        headers: {
          "content-type": "image/png",
          "cache-control": "no-store, max-age=0",
          "content-disposition": `attachment; filename="consist-trade-${(preview.symbol || "card").replace(/[^\w-]+/g, "-").toLowerCase()}.png"`,
        },
        fonts: [
          { name: "Inter", data: font400, weight: 400, style: "normal" },
          { name: "Inter", data: font500, weight: 500, style: "normal" },
          { name: "Inter", data: font600, weight: 600, style: "normal" },
          { name: "Inter", data: font700, weight: 700, style: "normal" },
        ],
      },
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Failed to render image" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
