import { query } from './db.js'

const telegramApiUrl = (method) => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`

export async function sendTelegramMessage(chatId, text) {
  if (!process.env.TELEGRAM_BOT_TOKEN || !chatId) return false
  try {
    const res = await fetch(telegramApiUrl('sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    if (!res.ok) {
      const errBody = await res.text()
      console.warn('Telegram sendMessage failed:', res.status, errBody)
      return false
    }
    return true
  } catch (err) {
    console.warn('Telegram sendMessage error:', err.message)
    return false
  }
}

// Notifikasi hanya boleh terkirim SEKALI saat stok baru saja melewati batas minimum,
// bukan berulang di setiap transaksi berikutnya selagi stok masih rendah.
export function crossedLowStockThreshold(oldStock, newStock, stockMin) {
  const min = Number(stockMin) || 0
  return min > 0 && Number(oldStock) > min && Number(newStock) <= min
}

// Notifikasi Telegram otomatis = fitur Juragan Space (AI). Duplikasi minimal dari
// PLAN_CONFIG di routes.js (tidak diimpor langsung krn routes.js sudah impor modul ini —
// hindari circular import). Jaga tetap sinkron dgn slug 'juragan' & aliasnya di sana.
const JURAGAN_PLAN_VALUES = ['juragan', 'premium', 'enterprise']
const isJuraganPlan = (plan) => JURAGAN_PLAN_VALUES.includes(String(plan || '').trim().toLowerCase())

export async function notifyLowStock({ companyId, branchId, materialName, unit, newStock, stockMin }) {
  try {
    const companyRows = await query('SELECT subscription_plan FROM companies WHERE id = ?', [companyId])
    if (!isJuraganPlan(companyRows[0]?.subscription_plan)) return

    const [recipients, branchRows] = await Promise.all([
      query(
        `SELECT c.telegram_chat_id, c.name
         FROM cashiers c
         JOIN tenants t ON c.tenant_id = t.id
         WHERE t.company_id = ? AND c.notify_low_stock = 1 AND c.telegram_chat_id IS NOT NULL`,
        [companyId]
      ),
      query('SELECT name FROM tenants WHERE id = ?', [branchId]),
    ])

    if (!recipients.length) return

    const branchName = branchRows[0]?.name || `Cabang #${branchId}`
    const text =
      `⚠️ <b>Stok Menipis: ${materialName}</b>\n` +
      `Cabang: ${branchName}\n` +
      `Sisa stok: ${newStock} ${unit} (batas minimum: ${stockMin} ${unit})\n\n` +
      `Segera lakukan pemesanan ulang.`

    await Promise.all(recipients.map((r) => sendTelegramMessage(r.telegram_chat_id, text)))
  } catch (err) {
    console.warn('notifyLowStock failed:', err.message)
  }
}
