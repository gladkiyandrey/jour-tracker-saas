import { NextResponse } from "next/server";
import QRCode from "qrcode";

type Params = { id: string };

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<Params> }) {
  const { id } = await params;
  const cleanId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!cleanId) {
    return NextResponse.json({ error: "Invalid share id" }, { status: 400 });
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://consist.online").replace(/\/$/, "");
  const verifyUrl = `${appUrl}/share/verify/${cleanId}`;

  try {
    const svg = await QRCode.toString(verifyUrl, {
      type: "svg",
      margin: 1,
      width: 360,
      color: {
        dark: "#0f172f",
        light: "#ffffff",
      },
    });

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate QR" }, { status: 500 });
  }
}
