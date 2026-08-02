// Uji kirim email verifikasi lewat SMTP yang dikonfigurasi di server/.env
// Pakai: node scripts/send-test-email.mjs tujuan@contoh.com
//
// - Kalau SMTP_PASS kosong / SMTP belum lengkap -> mailer fallback ke mode LOG
//   (link dicetak ke console, TIDAK terkirim). Isi SMTP_PASS untuk kirim sungguhan.
// - Set SMTP_TLS_INSECURE=true HANYA bila muncul error 'self-signed certificate'.

import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const { sendVerificationEmail } = await import('../src/mailer.js')

const to = process.argv[2]
if (!to) {
  console.error('Pakai: node scripts/send-test-email.mjs tujuan@contoh.com')
  process.exit(1)
}

const base = process.env.MERCHANT_PUBLIC_URL || 'http://localhost:3800'
const verifyUrl = `${base}/api/auth/verify-email?token=TEST-TOKEN-${Date.now()}`

console.log('SMTP_HOST :', process.env.SMTP_HOST || '(kosong)')
console.log('SMTP_USER :', process.env.SMTP_USER || '(kosong)')
console.log('SMTP_PASS :', process.env.SMTP_PASS ? '(terisi)' : '(KOSONG -> akan fallback LOG)')
console.log('MAIL_FROM :', process.env.MAIL_FROM || '(default)')
console.log('Kirim ke  :', to)
console.log('---')

const res = await sendVerificationEmail({ to, name: 'Tes STRANS', verifyUrl })
console.log('Hasil:', res)
if (res.transport === 'smtp' && res.sent) {
  console.log('✅ Terkirim via SMTP. Cek inbox (dan folder Spam) di', to)
} else if (res.transport === 'log') {
  console.log('ℹ️  Belum terkirim sungguhan — SMTP belum lengkap / gagal, link hanya dicetak di atas.')
}
process.exit(res.sent ? 0 : 2)
