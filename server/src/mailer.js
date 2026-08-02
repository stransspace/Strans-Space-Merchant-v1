// Mailer pluggable. Bila SMTP dikonfigurasi (SMTP_HOST + SMTP_USER + SMTP_PASS) dan
// paket `nodemailer` terpasang, email dikirim sungguhan. Jika tidak, link verifikasi
// hanya DICATAT ke console (mode dev) — alur tetap berfungsi tanpa perlu SMTP.
//
// ENV yang dipakai: SMTP_HOST, SMTP_PORT (default 587), SMTP_SECURE ('true' utk 465),
// SMTP_USER, SMTP_PASS, MAIL_FROM (default "STRANS <no-reply@stranspace.com>").

const smtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

let transporterPromise = null
async function getTransporter() {
  if (!smtpConfigured()) return null
  if (!transporterPromise) {
    transporterPromise = (async () => {
      try {
        const nodemailer = (await import('nodemailer')).default
        const opts = {
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        }
        // Sebagian host cPanel punya cert dg hostname tak persis cocok.
        // Set SMTP_TLS_INSECURE=true HANYA bila terjadi error 'self-signed certificate'.
        if (String(process.env.SMTP_TLS_INSECURE || '').toLowerCase() === 'true') {
          opts.tls = { rejectUnauthorized: false }
        }
        return nodemailer.createTransport(opts)
      } catch (err) {
        // nodemailer belum terpasang -> fallback ke mode log.
        console.warn('[MAIL] nodemailer tidak tersedia, fallback ke mode log:', err.message)
        return null
      }
    })()
  }
  return transporterPromise
}

const MAIL_FROM = process.env.MAIL_FROM || 'STRANS <no-reply@stranspace.com>'

export async function sendVerificationEmail({ to, name, verifyUrl }) {
  const subject = 'Verifikasi email akun STRANS Anda'
  const text = `Halo ${name || ''},\n\nTerima kasih telah mendaftar di STRANS. Silakan verifikasi email Anda dengan membuka tautan berikut:\n\n${verifyUrl}\n\nTautan berlaku 24 jam. Bila Anda tidak mendaftar, abaikan email ini.`
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 8px">Verifikasi email Anda</h2>
      <p style="color:#475569;font-size:14px">Halo ${name || ''}, terima kasih telah mendaftar di <b>STRANS</b>. Klik tombol di bawah untuk memverifikasi email Anda.</p>
      <p style="margin:24px 0"><a href="${verifyUrl}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:bold;display:inline-block">Verifikasi Email</a></p>
      <p style="color:#94a3b8;font-size:12px">Atau salin tautan ini: <br>${verifyUrl}</p>
      <p style="color:#94a3b8;font-size:12px">Tautan berlaku 24 jam. Bila Anda tidak mendaftar, abaikan email ini.</p>
    </div>`

  const transporter = await getTransporter()
  if (!transporter) {
    // Mode dev/log — tampilkan link agar alur tetap bisa diuji tanpa SMTP.
    console.log(`[MAIL:LOG] Verifikasi email untuk ${to} -> ${verifyUrl}`)
    return { sent: false, transport: 'log' }
  }
  try {
    await transporter.sendMail({ from: MAIL_FROM, to, subject, text, html })
    return { sent: true, transport: 'smtp' }
  } catch (err) {
    console.warn('[MAIL] Gagal kirim via SMTP, fallback log:', err.message)
    console.log(`[MAIL:LOG] Verifikasi email untuk ${to} -> ${verifyUrl}`)
    return { sent: false, transport: 'log', error: err.message }
  }
}
