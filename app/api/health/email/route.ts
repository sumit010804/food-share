import { NextResponse } from "next/server"
import nodemailer from "nodemailer"

export async function GET() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER

  const summary: any = {
    hasHost: !!host,
    hasUser: !!user,
    hasPass: !!process.env.SMTP_PASS,
    from,
  }

  if (!host || !user || !process.env.SMTP_PASS) {
    return NextResponse.json({ ok: false, summary, note: "Missing SMTP env vars" }, { status: 200 })
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user, pass: process.env.SMTP_PASS! },
    })

    // Verify connection configuration (no email sent)
    await transporter.verify()
    return NextResponse.json({ ok: true, summary })
  } catch (e: any) {
    return NextResponse.json({ ok: false, summary, error: String(e?.message || e) }, { status: 200 })
  }
}
