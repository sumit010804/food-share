import nodemailer from "nodemailer"

export async function sendEmail(to: string, subject: string, html: string) {
  // If SMTP is not configured, skip sending gracefully.
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP not configured, skipping email send to", to)
    return
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  })
}

export async function sendNotificationEmail(to: string, title: string, message: string, actionUrl?: string) {
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#0f172a">
      <h2 style="margin:0 0 8px 0;color:#0f766e">${escapeHtml(title)}</h2>
      <p style="margin:0 0 12px 0">${escapeHtml(message)}</p>
      ${actionUrl ? `<p><a href="${actionUrl}" style="background:#0ea5a3;color:#fff;padding:10px 14px;border-radius:6px;text-decoration:none">Open</a></p>` : ""}
      <p style="font-size:12px;color:#64748b;margin-top:16px">FoodShare</p>
    </div>
  `
  await sendEmail(to, title, html)
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
