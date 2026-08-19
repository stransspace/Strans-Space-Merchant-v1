
import express from 'express'
import { query, transaction } from './db.js'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { Client as FtpClient } from 'basic-ftp'
import { Readable } from 'stream'
import crypto from 'crypto'
import { sendTelegramMessage, crossedLowStockThreshold, notifyLowStock } from './telegram.js'
import { rateLimit } from './security.js'
import { sendVerificationEmail } from './mailer.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Batasi percobaan login per IP untuk menahan brute-force PIN.
const loginLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 20,
  message: 'Terlalu banyak percobaan login. Silakan tunggu beberapa menit.',
})


const hashSecret = (secret) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(secret), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
};

const verifySecret = (secret, storedHash) => {
  if (!storedHash || !storedHash.startsWith('scrypt$')) return false;
  const [, salt, hash] = storedHash.split('$');
  const candidate = crypto.scryptSync(String(secret), salt, 64).toString('hex');
  if (!hash || hash.length !== candidate.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidate, 'hex'));
};

const DEFAULT_CASHIER_TOKEN_SECRET = 'dev-cashier-token-secret-change-me';
const CASHIER_TOKEN_SECRET = process.env.CASHIER_TOKEN_SECRET || DEFAULT_CASHIER_TOKEN_SECRET;
if (CASHIER_TOKEN_SECRET === DEFAULT_CASHIER_TOKEN_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: CASHIER_TOKEN_SECRET wajib diset dengan nilai acak yang kuat di production.');
    process.exit(1);
  }
  console.warn('WARNING: CASHIER_TOKEN_SECRET belum diset. Gunakan secret kuat di production.');
}
const CASHIER_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

// Payload menyimpan companyId (bukan cuma tenantId) supaya owner tetap bisa switch-branch
// antar tenant dalam satu company group yang sama tanpa perlu login ulang tiap ganti cabang.
const signCashierToken = (cashier, companyId) => {
  const payload = {
    sub: cashier.id,
    username: cashier.username || cashier.email,
    role: cashier.role,
    tenantId: cashier.tenant_id,
    companyId,
    exp: Date.now() + CASHIER_TOKEN_TTL_MS
  };
  const encoded = base64url(payload);
  const signature = crypto.createHmac('sha256', CASHIER_TOKEN_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
};

const verifyCashierToken = (token) => {
  if (!token || !token.includes('.')) return null;
  const [encoded, signature] = token.split('.');
  const expected = crypto.createHmac('sha256', CASHIER_TOKEN_SECRET).update(encoded).digest('base64url');
  if (!signature || signature.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};

// Durasi trial paket FREE (hari) dihitung dari tanggal daftar (companies.created_at).
const FREE_TRIAL_DAYS = 14

// ==========================================================================
// KONFIGURASI PAKET LANGGANAN — single source of truth, selaras dgn halaman
// harga publik (strans-space.com/#harga). Tier bersifat KUMULATIF: tier lebih
// tinggi otomatis mewarisi semua batas/fitur tier di bawahnya.
// `aliases` menampung nilai lama di kolom companies/tenants.subscription_plan
// supaya tenant existing tidak mendadak terkunci saat tier baru diluncurkan —
// jangan hapus alias tanpa migrasi data terlebih dahulu.
// ==========================================================================
const PLAN_CONFIG = [
  {
    slug: 'rintis',
    rank: 0,
    label: 'Rintis Space',
    aliases: ['free', 'basic', 'starter', ''],
    branchLimit: 1,
    cashierLimit: 1,
    menuItemLimit: 20,
    monthlyPrice: 0, // gratis — tidak lewat jalur checkout Midtrans
  },
  {
    slug: 'toko',
    rank: 1,
    label: 'Toko Space',
    aliases: [],
    branchLimit: 1,
    cashierLimit: 3,
    menuItemLimit: null, // unlimited
    monthlyPrice: 47000,
  },
  {
    slug: 'cabang',
    rank: 2,
    label: 'Cabang Space',
    aliases: ['standard'],
    branchLimit: 3,
    cashierLimit: 10,
    menuItemLimit: null,
    monthlyPrice: 143000,
  },
  {
    slug: 'juragan',
    rank: 3,
    label: 'Juragan Space (AI)',
    aliases: ['premium', 'enterprise'],
    branchLimit: null, // unlimited (dijual sbg "15+ cabang")
    cashierLimit: null,
    menuItemLimit: null,
    monthlyPrice: 279000,
  },
]

const PLAN_BY_SLUG = Object.fromEntries(PLAN_CONFIG.map((p) => [p.slug, p]))
const PLAN_ALIAS_TO_SLUG = PLAN_CONFIG.reduce((acc, p) => {
  for (const alias of p.aliases) acc[alias] = p.slug
  return acc
}, {})

// Normalisasi nilai bebas dari DB (termasuk nilai lama seperti 'standard'/'premium')
// ke slug tier resmi. Nilai tak dikenal jatuh ke tier terendah (fail-safe, bukan fail-open).
const normalizePlan = (plan) => {
  const raw = String(plan || '').trim().toLowerCase()
  if (PLAN_BY_SLUG[raw]) return raw
  return PLAN_ALIAS_TO_SLUG[raw] || 'rintis'
}

const planConfigFor = (plan) => PLAN_BY_SLUG[normalizePlan(plan)]
const planRank = (plan) => planConfigFor(plan).rank
const planLabel = (plan) => planConfigFor(plan).label
const branchLimitFor = (plan) => planConfigFor(plan).branchLimit
const cashierLimitFor = (plan) => planConfigFor(plan).cashierLimit
const monthlyPriceFor = (plan) => planConfigFor(plan).monthlyPrice
const menuItemLimitFor = (plan) => planConfigFor(plan).menuItemLimit

// Label tier pada rank tertentu (untuk pesan "fitur ini butuh paket X").
const planLabelForRank = (rank) => (PLAN_CONFIG.find((p) => p.rank === rank) || PLAN_CONFIG[PLAN_CONFIG.length - 1]).label

// Nama tier satu tingkat di atas tier saat ini (untuk ajakan upgrade).
const nextPlanLabel = (plan) => {
  const next = PLAN_CONFIG.find((p) => p.rank === planRank(plan) + 1)
  return next ? next.label : PLAN_CONFIG[PLAN_CONFIG.length - 1].label
}

// Tanggal berakhir EFEKTIF: tanggal manual menang (semua paket); free tanpa tanggal =
// created_at + FREE_TRIAL_DAYS (trial); berbayar tanpa tanggal = null (tanpa batas).
const effectiveExpiry = (plan, expiresAt, createdAt) => {
  if (expiresAt) { const d = new Date(expiresAt); return Number.isNaN(d.getTime()) ? null : d }
  if (normalizePlan(plan) === 'rintis' && createdAt) {
    const d = new Date(createdAt)
    if (Number.isNaN(d.getTime())) return null
    d.setDate(d.getDate() + FREE_TRIAL_DAYS)
    return d
  }
  return null
}

// Langganan kedaluwarsa bila tanggal berakhir efektif sudah lewat (termasuk trial free).
const isSubscriptionExpired = (plan, expiresAt, createdAt) => {
  const eff = effectiveExpiry(plan, expiresAt, createdAt)
  return !!eff && eff.getTime() < Date.now()
}

/**
 * Middleware SaaS: Mengekstrak tenant_id dari request yang masuk.
 * Wajib membawa Bearer token kasir/owner yang valid. Owner boleh switch-branch
 * (kirim x-tenant-id berbeda dari tenant asal token) HANYA jika tenant tujuan
 * berada di company group yang sama dengan token-nya.
 */
const requireTenant = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const decoded = token ? verifyCashierToken(token) : null;

  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: 'Akses ditolak: Token autentikasi wajib disertakan. Silakan login ulang.'
    });
  }

  req.cashierId = decoded.sub;
  req.callerRole = decoded.role;

  const headerTenantId = req.headers['x-tenant-id'];
  const requestedTenantId = headerTenantId ? parseInt(headerTenantId, 10) : decoded.tenantId;

  if (requestedTenantId) {
    try {
      const rows = await query(
        'SELECT t.company_id, t.is_active AS tenant_active, t.subscription_plan AS tenant_plan, c.is_active AS company_active, c.subscription_plan AS company_plan, c.subscription_expires_at AS company_expires_at, c.created_at AS company_created_at FROM tenants t LEFT JOIN companies c ON t.company_id = c.id WHERE t.id = ? LIMIT 1',
        [requestedTenantId]
      );
      if (rows && rows.length > 0) {
        const row = rows[0];
        const resolvedCompanyId = row.company_id || 1;
        const sameCompanyGroup = decoded.companyId
          ? String(resolvedCompanyId) === String(decoded.companyId)
          : String(requestedTenantId) === String(decoded.tenantId)

        if (!sameCompanyGroup) {
          return res.status(403).json({
            success: false,
            message: 'Akses ditolak: Tenant/cabang ini bukan bagian dari grup bisnis Anda.'
          });
        }

        req.tenantId = requestedTenantId;
        req.companyId = resolvedCompanyId;
        req.subscriptionPlan = row.tenant_plan || row.company_plan || 'free';

        // Runtime enforcement: penangguhan & masa langganan berlaku SEKETIKA (bukan hanya saat login).
        if (resolvedCompanyId && row.company_active === 0) {
          return res.status(403).json({ success: false, code: 'SUBSCRIPTION_SUSPENDED', message: 'Langganan perusahaan ditangguhkan. Silakan hubungi admin.' });
        }
        if (row.tenant_active === 0) {
          return res.status(403).json({ success: false, code: 'OUTLET_SUSPENDED', message: 'Outlet ini ditangguhkan/nonaktif. Silakan hubungi admin.' });
        }
        if (isSubscriptionExpired(req.subscriptionPlan, row.company_expires_at, row.company_created_at)) {
          return res.status(403).json({ success: false, code: 'SUBSCRIPTION_EXPIRED', message: 'Masa langganan telah berakhir. Silakan perpanjang untuk melanjutkan.' });
        }
        return next();
      }
    } catch (dbErr) {
      console.error('Error loading tenant company info:', dbErr);
    }
  }

  // Jika tidak ada identitas toko sama sekali, tolak request
  return res.status(403).json({
    success: false,
    message: 'Akses ditolak: Tenant ID tidak ditemukan. Harap periksa login/sesi Anda.'
  });
};

// Factory middleware generik: tolak request bila rank paket tenant di bawah minRank.
const requireMinPlanRank = (minRank, featureLabel) => async (req, res, next) => {
  try {
    if (planRank(req.subscriptionPlan) < minRank) {
      return res.status(403).json({
        success: false,
        code: 'PLAN_UPGRADE_REQUIRED',
        requiredPlan: planLabelForRank(minRank),
        error: `Fitur "${featureLabel}" membutuhkan paket ${planLabelForRank(minRank)}. Silakan upgrade langganan Anda.`
      })
    }
    next()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

// Pesan Meja & QRIS dinamis: bagian dari "Manajemen Meja, Split Bill & Anti-Void Fraud" — Cabang Space.
const requireAdvancedOrderingPlan = requireMinPlanRank(PLAN_BY_SLUG.cabang.rank, 'Pesan Meja & QRIS Dinamis')

// Notifikasi Telegram: bagian dari paket AI/notifikasi otomatis — Juragan Space (AI).
const requireTelegramNotificationPlan = requireMinPlanRank(PLAN_BY_SLUG.juragan.rank, 'Notifikasi Telegram')

const checkProductLimit = async (req, res, next) => {
  try {
    const plan = req.subscriptionPlan
    const maxItems = menuItemLimitFor(plan)

    if (maxItems !== null) {
      // Hitung jumlah menu item aktif saat ini untuk tenant_id ini
      const rows = await query('SELECT COUNT(*) as total FROM menu_items WHERE tenant_id = ? AND is_active = 1', [req.tenantId])
      const currentTotal = rows[0]?.total || 0

      if (currentTotal >= maxItems) {
        return res.status(403).json({
          success: false,
          code: 'PLAN_UPGRADE_REQUIRED',
          requiredPlan: nextPlanLabel(plan),
          error: `Batas menu untuk paket ${planLabel(plan)} telah tercapai (${maxItems} menu). Upgrade ke ${nextPlanLabel(plan)} untuk menu tanpa batas.`
        })
      }
    }
    next()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const checkCashierLimit = async (req, res, next) => {
  try {
    const plan = req.subscriptionPlan
    const maxCashiers = cashierLimitFor(plan)

    if (maxCashiers !== null) {
      // Hitung jumlah kasir saat ini untuk tenant_id ini
      const rows = await query('SELECT COUNT(*) as total FROM cashiers WHERE tenant_id = ?', [req.tenantId])
      const currentTotal = rows[0]?.total || 0

      if (currentTotal >= maxCashiers) {
        return res.status(403).json({
          success: false,
          code: 'CASHIER_LIMIT_REACHED',
          requiredPlan: nextPlanLabel(plan),
          error: `Batas akun kasir untuk paket ${planLabel(plan)} telah tercapai (${maxCashiers} kasir). Upgrade ke ${nextPlanLabel(plan)} untuk menambah staf.`
        })
      }
    }
    next()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}

const router = express.Router()

const midtransBaseUrl = () => (
  String(process.env.MIDTRANS_IS_PRODUCTION || '').toLowerCase() === 'true'
    ? 'https://api.midtrans.com'
    : 'https://api.sandbox.midtrans.com'
)

// Snap (redirect/popup, banyak metode: kartu, VA, e-wallet) pakai base URL App terpisah dari Core API.
const midtransSnapBaseUrl = () => (
  String(process.env.MIDTRANS_IS_PRODUCTION || '').toLowerCase() === 'true'
    ? 'https://app.midtrans.com'
    : 'https://app.sandbox.midtrans.com'
)

const midtransAuthHeader = () => `Basic ${Buffer.from(`${process.env.MIDTRANS_SERVER_KEY || ''}:`).toString('base64')}`

const extractMidtransQrUrl = (payload = {}) => {
  const actions = Array.isArray(payload.actions) ? payload.actions : []
  const qrAction = actions.find((action) => (
    /qr/i.test(action?.name || '') || /qr/i.test(action?.url || '')
  ))
  return qrAction?.url || payload.qr_url || payload.qrUrl || null
}

const verifyMidtransSignature = (payload = {}) => {
  const signature = payload.signature_key
  if (!signature || !process.env.MIDTRANS_SERVER_KEY) return false
  const raw = `${payload.order_id || ''}${payload.status_code || ''}${payload.gross_amount || ''}${process.env.MIDTRANS_SERVER_KEY}`
  const expected = crypto.createHash('sha512').update(raw).digest('hex')
  return expected === signature
}

// Aktivasi Perangkat (Device Activation)
router.get('/auth/activate/:code', async (req, res) => {
  const code = req.params.code;
  try {
    // Menggunakan kolom activation_code sebagai kode aktivasi
    const rows = await query('SELECT id, name, domain, subscription_plan, is_active FROM tenants WHERE LOWER(activation_code) = LOWER(?) LIMIT 1', [code]);
    
    if (!rows.length) {
      return res.status(200).json({ success: false, message: `Kode aktivasi '${code}' tidak valid atau tidak ditemukan.` });
    }
    
    res.json({ success: true, tenant: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Login kasir (Email & PIN Login)
router.post('/auth/login', loginLimiter, async (req, res) => {
  const { email, pin } = req.body || {};
  console.log('[LOGIN] Request received:', { email, hasPin: !!pin })
  
  if (!email || !pin) {
    console.log('[LOGIN] Missing credentials')
    return res.status(400).json({ success: false, message: 'email dan pin wajib diisi' })
  }
  
  try {
    console.log('[LOGIN] Querying database for user by email:', email)
    const rows = await query('SELECT id, name, username, pin, pin_hash, role, email, tenant_id, email_verified FROM cashiers WHERE email=? LIMIT 1', [email])
    
    let cashier = null
    let isValid = false

    if (rows.length > 0) {
      cashier = rows[0]
      if (cashier.pin_hash && cashier.pin_hash.startsWith('scrypt$')) {
        isValid = verifySecret(pin, cashier.pin_hash)
      } else {
        isValid = Boolean(cashier.pin) && (pin === cashier.pin)
        if (isValid) {
          // Migrasi otomatis: upgrade PIN plaintext lama ke hash begitu berhasil login
          await query('UPDATE cashiers SET pin_hash=?, pin=? WHERE id=?', [hashSecret(pin), '', cashier.id])
        }
      }
    }

    if (!isValid) {
      console.log('[LOGIN] User not found or wrong PIN for email:', email)
      return res.status(200).json({ success: false, message: 'Email atau PIN salah' })
    }
    
    // Fetch tenant details for this cashier (+ status suspend & masa langganan)
    const tenantRows = await query(
      'SELECT t.id, t.name, t.domain, t.subscription_plan, t.is_active AS tenant_active, t.company_id, c.is_active AS company_active, c.subscription_expires_at AS company_expires_at, c.created_at AS company_created_at FROM tenants t LEFT JOIN companies c ON c.id = t.company_id WHERE t.id = ? LIMIT 1',
      [cashier.tenant_id]
    );
    if (!tenantRows.length) {
      return res.status(200).json({ success: false, message: 'Tenant terkait kasir tidak ditemukan. Harap hubungi Admin.' });
    }
    const tenant = tenantRows[0];

    // Blokir login bila ditangguhkan atau langganan/trial berakhir (selaras dgn enforcement runtime).
    if (tenant.company_id && tenant.company_active === 0) {
      return res.status(200).json({ success: false, message: 'Langganan perusahaan ditangguhkan. Silakan hubungi admin.' });
    }
    if (tenant.tenant_active === 0) {
      return res.status(200).json({ success: false, message: 'Outlet ini ditangguhkan/nonaktif. Silakan hubungi admin.' });
    }
    if (isSubscriptionExpired(tenant.subscription_plan, tenant.company_expires_at, tenant.company_created_at)) {
      return res.status(200).json({ success: false, message: 'Masa langganan/trial telah berakhir. Silakan perpanjang untuk melanjutkan.' });
    }

    const cashierData = {
      id: cashier.id,
      name: cashier.name,
      username: cashier.username,
      role: cashier.role,
      email: cashier.email,
      tenant_id: cashier.tenant_id,
      email_verified: Number(cashier.email_verified) === 1 ? 1 : 0
    }

    console.log('[LOGIN] Login successful:', { id: cashierData.id, username: cashierData.username, tenantId: cashierData.tenant_id })
    res.json({
      success: true,
      message: 'Login berhasil!',
      data: {
        token: signCashierToken(cashierData, tenant.company_id || null),
        cashier: cashierData,
        tenant: tenant
      }
    })
  } catch (err) {
    console.error('[LOGIN] Database error:', err.message)
    res.status(500).json({ success: false, message: err.message })
  }
})

// Registrasi mandiri (self-service signup). Publik + rate-limited. Membuat
// company (paket FREE dipaksa di server), tenant (+ activation_code), dan akun
// OWNER, lalu auto-login (balikan bentuknya sama seperti /auth/login).
const slugifyBusiness = (s) =>
  String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '').slice(0, 18) || 'toko'
const genActivationCode = () => crypto.randomBytes(5).toString('hex').toUpperCase() // 10 char
// Slug publik acak untuk URL QR meja (?t=<slug>). Tak bisa ditebak; BUKAN activation_code.
const genPublicSlug = () => crypto.randomBytes(9).toString('base64url').slice(0, 12)

router.post('/auth/register', loginLimiter, async (req, res) => {
  const { businessName, ownerName, email, pin } = req.body || {}
  const bn = String(businessName || '').trim()
  const on = String(ownerName || '').trim()
  const emailNorm = String(email || '').trim().toLowerCase()
  const pinStr = String(pin || '')

  if (!bn || !on || !emailNorm || !pinStr) {
    return res.status(400).json({ success: false, message: 'Nama bisnis, nama, email, dan PIN wajib diisi.' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return res.status(400).json({ success: false, message: 'Format email tidak valid.' })
  }
  if (pinStr.length < 6) {
    return res.status(400).json({ success: false, message: 'PIN minimal 6 karakter.' })
  }

  try {
    const existing = await query('SELECT id FROM cashiers WHERE email = ? LIMIT 1', [emailNorm])
    if (existing.length) {
      return res.status(409).json({ success: false, message: 'Email sudah terdaftar. Silakan login.' })
    }

    const verifyToken = crypto.randomBytes(32).toString('hex')
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 jam

    const result = await transaction(async (conn) => {
      // Paket FREE dipaksa di server (abaikan input apa pun dari client).
      const [companyRes] = await conn.execute(
        'INSERT INTO companies (name, subscription_plan, is_active) VALUES (?, ?, 1)',
        [bn, 'free']
      )
      const companyId = companyRes.insertId

      const domain = `${slugifyBusiness(bn)}${crypto.randomBytes(3).toString('hex')}`
      const activationCode = genActivationCode()
      const [tenantRes] = await conn.execute(
        'INSERT INTO tenants (name, domain, subscription_plan, is_active, activation_code, company_id, public_slug) VALUES (?, ?, ?, 1, ?, ?, ?)',
        [bn, domain, 'free', activationCode, companyId, genPublicSlug()]
      )
      const tenantId = tenantRes.insertId

      const username = (emailNorm.split('@')[0] || 'owner').slice(0, 50)
      const [cashierRes] = await conn.execute(
        `INSERT INTO cashiers (name, username, pin, pin_hash, role, email, tenant_id, email_verified, email_verify_token, email_verify_expires)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [on, username, '', hashSecret(pinStr), 'owner', emailNorm, tenantId, verifyToken, verifyExpires]
      )
      return { companyId, tenantId, cashierId: cashierRes.insertId, domain, activationCode, username }
    })

    // Kirim email verifikasi (SMTP bila dikonfigurasi; jika tidak, link dicatat ke log).
    const baseUrl = process.env.MERCHANT_PUBLIC_URL || `${req.protocol}://${req.get('host')}`
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${verifyToken}`
    let mailResult = { transport: 'log' }
    try {
      mailResult = await sendVerificationEmail({ to: emailNorm, name: on, verifyUrl })
    } catch (mailErr) {
      console.warn('[REGISTER] gagal kirim email verifikasi:', mailErr.message)
    }

    const cashierData = {
      id: result.cashierId,
      name: on,
      username: result.username,
      role: 'owner',
      email: emailNorm,
      tenant_id: result.tenantId,
      email_verified: 0,
    }
    const tenant = {
      id: result.tenantId,
      name: bn,
      domain: result.domain,
      subscription_plan: 'free',
      company_id: result.companyId,
    }
    res.status(201).json({
      success: true,
      message: 'Pendaftaran berhasil!',
      data: {
        token: signCashierToken(cashierData, result.companyId),
        cashier: cashierData,
        tenant,
        activation_code: result.activationCode,
        email_sent: mailResult.transport === 'smtp',
        // Di non-produksi, sertakan link verifikasi agar alur bisa diuji tanpa SMTP.
        ...(process.env.NODE_ENV !== 'production' ? { verify_url: verifyUrl } : {}),
      },
    })
  } catch (err) {
    console.error('[REGISTER] error:', err.message)
    res.status(500).json({ success: false, message: 'Gagal mendaftar: ' + err.message })
  }
})

// Verifikasi email (publik, dibuka dari tautan di email). Menandai email_verified=1.
const verifyPage = (ok, dashboardUrl, message) => `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verifikasi Email STRANS</title></head>
<body style="font-family:Arial,sans-serif;background:#f8fafc;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center">
<div style="background:#fff;max-width:420px;width:90%;padding:32px;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.08);text-align:center">
<div style="font-size:48px">${ok ? '✅' : '⚠️'}</div>
<h1 style="font-size:20px;color:#0f172a;margin:12px 0 6px">${ok ? 'Email Terverifikasi' : 'Verifikasi Gagal'}</h1>
<p style="color:#64748b;font-size:14px;margin:0 0 24px">${message}</p>
<a href="${dashboardUrl}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:bold;display:inline-block">Buka Dashboard</a>
</div></body></html>`

router.get('/auth/verify-email', async (req, res) => {
  const token = String(req.query.token || '')
  const baseUrl = process.env.MERCHANT_PUBLIC_URL || `${req.protocol}://${req.get('host')}`
  const dashboardUrl = `${baseUrl}/?verified=1`
  if (!token) {
    return res.status(400).send(verifyPage(false, baseUrl, 'Token verifikasi tidak ada.'))
  }
  try {
    const rows = await query(
      'SELECT id, email_verified, email_verify_expires FROM cashiers WHERE email_verify_token = ? LIMIT 1',
      [token]
    )
    if (!rows.length) {
      return res.status(400).send(verifyPage(false, baseUrl, 'Tautan verifikasi tidak valid atau sudah dipakai. Silakan login lalu kirim ulang.'))
    }
    const row = rows[0]
    if (Number(row.email_verified) === 1) {
      return res.status(200).send(verifyPage(true, dashboardUrl, 'Email Anda sudah terverifikasi. Silakan lanjut ke dashboard.'))
    }
    if (row.email_verify_expires && new Date(row.email_verify_expires) < new Date()) {
      return res.status(400).send(verifyPage(false, baseUrl, 'Tautan verifikasi sudah kedaluwarsa. Silakan login lalu kirim ulang verifikasi.'))
    }
    await query(
      'UPDATE cashiers SET email_verified = 1, email_verify_token = NULL, email_verify_expires = NULL WHERE id = ?',
      [row.id]
    )
    return res.status(200).send(verifyPage(true, dashboardUrl, 'Terima kasih! Email Anda berhasil diverifikasi.'))
  } catch (err) {
    console.error('[VERIFY-EMAIL] error:', err.message)
    return res.status(500).send(verifyPage(false, baseUrl, 'Terjadi kesalahan. Coba lagi nanti.'))
  }
})

// Login dengan Google (Google OAuth Sign-in)
router.post('/auth/login-google', loginLimiter, async (req, res) => {
  const { credential, tenant_domain } = req.body || {};
  console.log('[LOGIN-GOOGLE] Request received:', { hasCredential: !!credential, tenant_domain })

  if (!credential) {
    return res.status(400).json({ success: false, message: 'credential wajib diisi' })
  }

  try {
    // 1. Verifikasi Google ID Token ke Google API
    const verifyUrl = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    const googleRes = await fetch(verifyUrl)
    if (!googleRes.ok) {
      return res.status(400).json({ success: false, message: 'Verifikasi Token Google gagal' })
    }
    const payload = await googleRes.json()
    if (payload.error_description) {
      return res.status(400).json({ success: false, message: `Token Google tidak valid: ${payload.error_description}` })
    }

    const email = payload.email
    if (!email) {
      return res.status(400).json({ success: false, message: 'Google Account tidak menyediakan data email' })
    }

    console.log('[LOGIN-GOOGLE] Verified Google Account email:', email)

    let tenant;
    let cashier;

    if (tenant_domain) {
      // 2. Validasi Tenant berdasarkan domain yang diberikan
      const tenantRows = await query('SELECT id, name, domain, subscription_plan, company_id FROM tenants WHERE domain = ? LIMIT 1', [tenant_domain]);
      if (!tenantRows.length) {
        return res.status(200).json({ success: false, message: 'Tenant tidak ditemukan. Harap periksa Domain Outlet.' });
      }
      tenant = tenantRows[0];

      // 3. Cari Cashier Owner dengan email ini di tenant tersebut
      const rows = await query(
        'SELECT id, name, username, role, email, tenant_id FROM cashiers WHERE email = ? AND tenant_id = ? LIMIT 1',
        [email, tenant.id]
      )

      if (rows.length === 0) {
        return res.status(200).json({ 
          success: false, 
          message: `Email '${email}' belum terdaftar sebagai Owner di outlet '${tenant.name}'.` 
        })
      }
      cashier = rows[0];
    } else {
      // 2. Auto-discover Tenant tempat email ini terdaftar sebagai Owner
      const rows = await query(
        `SELECT c.id, c.name, c.username, c.role, c.email, c.tenant_id, t.name AS tenant_name, t.domain AS tenant_domain, t.subscription_plan, t.company_id
         FROM cashiers c
         JOIN tenants t ON c.tenant_id = t.id
         WHERE c.email = ? AND c.role = 'owner' LIMIT 1`,
        [email]
      )

      if (rows.length === 0) {
        return res.status(200).json({
          success: false,
          message: `Email '${email}' tidak terdaftar sebagai Owner di cabang outlet mana pun.`
        })
      }
      cashier = rows[0];
      tenant = {
        id: cashier.tenant_id,
        name: cashier.tenant_name,
        domain: cashier.tenant_domain,
        subscription_plan: cashier.subscription_plan,
        company_id: cashier.company_id
      };
    }

    if (cashier.role !== 'owner') {
      return res.status(200).json({ success: false, message: 'Akses ditolak. Hanya Owner yang diizinkan menggunakan Google Login.' })
    }

    // Blokir login bila ditangguhkan atau langganan berakhir (selaras dgn enforcement runtime).
    const statusRows = await query(
      'SELECT t.is_active AS tenant_active, t.company_id, c.is_active AS company_active, c.subscription_expires_at AS company_expires_at, c.created_at AS company_created_at FROM tenants t LEFT JOIN companies c ON c.id = t.company_id WHERE t.id = ? LIMIT 1',
      [tenant.id]
    );
    const st = statusRows[0] || {};
    if (st.company_id && st.company_active === 0) {
      return res.status(200).json({ success: false, message: 'Langganan perusahaan ditangguhkan. Silakan hubungi admin.' });
    }
    if (st.tenant_active === 0) {
      return res.status(200).json({ success: false, message: 'Outlet ini ditangguhkan/nonaktif. Silakan hubungi admin.' });
    }
    if (isSubscriptionExpired(tenant.subscription_plan, st.company_expires_at, st.company_created_at)) {
      return res.status(200).json({ success: false, message: 'Masa langganan/trial telah berakhir. Silakan perpanjang untuk melanjutkan.' });
    }

    const cashierData = {
      id: cashier.id,
      name: cashier.name,
      username: cashier.username,
      role: cashier.role,
      email: cashier.email,
      tenant_id: cashier.tenant_id
    }

    console.log('[LOGIN-GOOGLE] Login successful:', { id: cashierData.id, email: cashierData.email, tenantId: cashierData.tenant_id })
    res.json({
      success: true,
      message: 'Login dengan Google berhasil!',
      data: {
        token: signCashierToken(cashierData, tenant.company_id || null),
        cashier: cashierData,
        tenant: tenant
      }
    })
  } catch (err) {
    console.error('[LOGIN-GOOGLE] Server error:', err.message)
    res.status(500).json({ success: false, message: err.message })
  }
})

// Config publik (tanpa auth) — hanya nilai yang MEMANG boleh dibaca browser, spt Client
// Key Midtrans (bukan Server Key). Dipakai frontend memuat Snap.js sebelum checkout.
router.get('/config/public', (_req, res) => {
  res.json({
    midtransClientKey: process.env.MIDTRANS_CLIENT_KEY || null,
    midtransIsProduction: String(process.env.MIDTRANS_IS_PRODUCTION || '').toLowerCase() === 'true',
  })
})

// Health endpoint
router.get('/health', async (_req, res) => {
  console.log('[GET /health] masuk handler')
  try {
    await query('SELECT 1')
    res.json({ ok: true })
    console.log('[GET /health] sukses')
  } catch (err) {
    console.error('[GET /health] error:', err)
    res.status(500).json({ ok: false, error: err.message })
  }
})

// Webhook Midtrans (Ditempatkan SEBELUM middleware SaaS karena Midtrans tidak mengirim tenant_id)
router.post('/payments/midtrans/webhook', async (req, res) => {
  const payload = req.body || {}
  if (!verifyMidtransSignature(payload)) {
    return res.status(403).json({ error: 'Invalid Midtrans signature' })
  }

  const reference = payload.order_id
  const transactionStatus = payload.transaction_status
  const fraudStatus = payload.fraud_status
  const isSettled = (transactionStatus === 'settlement') || (transactionStatus === 'capture' && fraudStatus === 'accept')
  const isFailed = ['expire', 'cancel', 'deny', 'failure'].includes(transactionStatus)

  try {
    // Checkout upgrade paket langganan (prefix "SUB-") — beda tabel dari order kasir.
    if (String(reference || '').startsWith('SUB-')) {
      const payRows = await query('SELECT id, company_id, plan, months, status FROM subscription_payments WHERE midtrans_order_id = ? LIMIT 1', [reference])
      const payment = payRows?.[0]
      if (!payment) return res.status(404).json({ error: 'Transaksi langganan tidak ditemukan' })

      if (payment.status !== 'paid') {
        if (isSettled) {
          await applyCompanyPlanChange(payment.company_id, payment.plan, payment.months, { action: 'upgrade_subscription', via: 'midtrans_webhook' })
          await query('UPDATE subscription_payments SET status = ?, paid_at = NOW() WHERE id = ?', ['paid', payment.id])
        } else if (isFailed) {
          await query('UPDATE subscription_payments SET status = ? WHERE id = ?', [transactionStatus === 'expire' ? 'expired' : 'cancelled', payment.id])
        } else if (transactionStatus === 'pending') {
          await query('UPDATE subscription_payments SET status = ? WHERE id = ?', ['pending', payment.id])
        }
      }
      return res.json({ success: true })
    }

    const rows = await query('SELECT id FROM orders WHERE payment_reference=? LIMIT 1', [reference])
    const order = rows?.[0]
    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' })

    let orderStatus = 'waiting_payment'
    let paymentStatus = transactionStatus || 'unknown'
    let paidAt = null

    if (isSettled) {
      orderStatus = 'paid'
      paymentStatus = 'paid'
      paidAt = new Date()
    } else if (isFailed) {
      orderStatus = transactionStatus === 'expire' ? 'expired' : 'cancelled'
      paymentStatus = orderStatus
    } else if (transactionStatus === 'pending') {
      orderStatus = 'waiting_payment'
      paymentStatus = 'pending'
    }

    await query(
      'UPDATE orders SET order_status=?, payment_status=?, paid_at=COALESCE(?, paid_at) WHERE id=?',
      [orderStatus, paymentStatus, paidAt, order.id]
    )
    await logActivity(req, 'payment_webhook', 'order', order.id, { reference, transactionStatus, fraudStatus })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Webhook Telegram (Ditempatkan SEBELUM middleware SaaS karena Telegram tidak mengirim tenant_id)
router.post('/telegram/webhook', async (req, res) => {
  try {
    const message = req.body?.message
    const text = message?.text || ''
    const chatId = message?.chat?.id

    if (chatId && text.startsWith('/start ')) {
      const token = text.slice(7).trim()
      const rows = await query('SELECT id, name FROM cashiers WHERE telegram_link_token = ? LIMIT 1', [token])
      const cashier = rows?.[0]

      if (cashier) {
        await query(
          'UPDATE cashiers SET telegram_chat_id = ?, telegram_link_token = NULL WHERE id = ?',
          [String(chatId), cashier.id]
        )
        await sendTelegramMessage(chatId, `✅ Akun Telegram berhasil terhubung ke <b>${cashier.name}</b>. Anda akan menerima notifikasi stok menipis di sini.`)
      } else {
        await sendTelegramMessage(chatId, 'Link tidak valid atau sudah kedaluwarsa. Minta link baru dari halaman Kasir & Staf.')
      }
    }
  } catch (err) {
    console.warn('Telegram webhook error:', err.message)
  }
  // Selalu balas 200 apa pun hasilnya — Telegram akan retry/menonaktifkan webhook kalau sering dapat non-200
  res.json({ ok: true })
})

// =======================================================================
// MIDDLEWARE SAAS: Semua API di bawah ini WAJIB menyertakan x-tenant-id
// (Login dan HealthCheck harus diletakkan DI ATAS baris ini)
// =======================================================================
router.use(requireTenant)

// Kirim ulang email verifikasi (authenticated — untuk owner yang sedang login).
router.post('/auth/resend-verification', async (req, res) => {
  try {
    const rows = await query('SELECT id, name, email, email_verified FROM cashiers WHERE id = ? LIMIT 1', [req.cashierId])
    if (!rows.length) return res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' })
    const c = rows[0]
    if (Number(c.email_verified) === 1) return res.json({ success: true, already: true, message: 'Email sudah terverifikasi.' })
    if (!c.email) return res.status(400).json({ success: false, message: 'Akun ini tidak memiliki email.' })

    const verifyToken = crypto.randomBytes(32).toString('hex')
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await query('UPDATE cashiers SET email_verify_token = ?, email_verify_expires = ? WHERE id = ?', [verifyToken, verifyExpires, c.id])

    const baseUrl = process.env.MERCHANT_PUBLIC_URL || `${req.protocol}://${req.get('host')}`
    const verifyUrl = `${baseUrl}/api/auth/verify-email?token=${verifyToken}`
    let mailResult = { transport: 'log' }
    try {
      mailResult = await sendVerificationEmail({ to: c.email, name: c.name, verifyUrl })
    } catch (mailErr) {
      console.warn('[RESEND] gagal kirim email:', mailErr.message)
    }
    res.json({
      success: true,
      message: 'Email verifikasi telah dikirim ulang.',
      email_sent: mailResult.transport === 'smtp',
      ...(process.env.NODE_ENV !== 'production' ? { verify_url: verifyUrl } : {}),
    })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message })
  }
})

// =======================================================================
// ENFORCEMENT AKSES MODUL (RBAC) — sama seperti pos-coffe.
// Manajemen Akses sebelumnya hanya menyembunyikan menu di UI; endpoint bisnis
// tidak dicek. Middleware ini memetakan (method, path) -> (modul, aksi) lalu
// memverifikasi user_module_access kasir.
// Default = MENEGAKKAN (403). Nonaktifkan sementara ke audit-log dengan
// ENFORCE_MODULE_ACCESS=false. Admin/owner selalu diizinkan; endpoint tak-terpetakan lolos.
// Catatan: requireTenant di merchant mewajibkan token untuk semua request, jadi
// tidak perlu pengecualian path publik.
// =======================================================================
const ENFORCE_MODULE_ACCESS = process.env.ENFORCE_MODULE_ACCESS !== 'false'
const ACTION_COLUMN = { view: 'can_view', create: 'can_create', edit: 'can_edit', delete: 'can_delete' }

const MODULE_ACCESS_MAP = [
  { method: 'POST',   re: /^\/orders$/,                                   module: 'kasir',       action: 'create' },
  { method: 'POST',   re: /^\/items$/,                                    module: 'produk',      action: 'create' },
  { method: 'PUT',    re: /^\/items\/[^/]+$/,                             module: 'produk',      action: 'edit' },
  { method: 'DELETE', re: /^\/items\/[^/]+$/,                             module: 'produk',      action: 'delete' },
  { method: 'PUT',    re: /^\/items\/[^/]+\/restore$/,                    module: 'produk',      action: 'edit' },
  { method: 'POST',   re: /^\/items\/[^/]+\/(variants|materials|stock)$/, module: 'produk',      action: 'edit' },
  { method: 'PUT',    re: /^\/items\/[^/]+\/(stock-min|variants\/[^/]+)$/, module: 'produk',     action: 'edit' },
  { method: 'DELETE', re: /^\/items\/[^/]+\/variants\/[^/]+$/,            module: 'produk',      action: 'edit' },
  { method: 'POST',   re: /^\/items\/branch-status$/,                     module: 'produk',      action: 'edit' },
  { method: 'POST',   re: /^\/materials$/,                                module: 'bahan',       action: 'create' },
  { method: 'PUT',    re: /^\/materials\/[^/]+$/,                         module: 'bahan',       action: 'edit' },
  { method: 'DELETE', re: /^\/materials\/[^/]+$/,                         module: 'bahan',       action: 'delete' },
  { method: 'POST',   re: /^\/materials\/[^/]+\/(in|stock)$/,             module: 'bahan',       action: 'edit' },
  { method: 'PUT',    re: /^\/materials\/[^/]+\/stock-min$/,              module: 'bahan',       action: 'edit' },
  { method: 'POST',   re: /^\/expenses$/,                                 module: 'pengeluaran', action: 'create' },
  { method: 'PUT',    re: /^\/expenses\/[^/]+$/,                          module: 'pengeluaran', action: 'edit' },
  { method: 'DELETE', re: /^\/expenses\/[^/]+$/,                          module: 'pengeluaran', action: 'delete' },
]

const enforceModuleAccess = async (req, res, next) => {
  const role = String(req.callerRole || '').toLowerCase()
  if (['admin', 'owner'].includes(role)) return next()

  const rule = MODULE_ACCESS_MAP.find((r) => r.method === req.method && r.re.test(req.path))
  if (!rule) return next()

  try {
    const cashierId = req.cashierId
    const col = ACTION_COLUMN[rule.action] || 'can_view'
    let allowed = false
    if (cashierId) {
      const rows = await query(
        `SELECT uma.${col} AS allowed
           FROM user_module_access uma
           JOIN modules m ON m.id = uma.module_id
          WHERE uma.cashier_id = ? AND m.name = ? LIMIT 1`,
        [cashierId, rule.module]
      )
      allowed = rows.length > 0 && Number(rows[0].allowed) === 1
    }
    if (!allowed) {
      if (ENFORCE_MODULE_ACCESS) {
        return res.status(403).json({ error: `Akses ditolak: Anda tidak memiliki izin '${rule.action}' untuk modul '${rule.module}'.` })
      }
      console.warn(`[ACCESS AUDIT] cashier ${cashierId} lacks '${rule.action}' on module '${rule.module}' (${req.method} ${req.path}) — akan 403 bila ENFORCE_MODULE_ACCESS=true`)
    }
  } catch (err) {
    console.warn('[ACCESS] enforceModuleAccess error (fail-open):', err.message)
  }
  next()
}

router.use(enforceModuleAccess)

// ==========================================================================
// PENEGAKAN GATING PAKET (server-authoritative) — cegah bypass FE.
// Per-TENANT/paket (bukan per-kasir), jadi admin/owner TIDAK bypass.
// Tier & batasnya didefinisikan satu tempat di PLAN_CONFIG (atas file ini),
// selaras dgn halaman harga publik. Nonaktifkan sementara dg ENFORCE_PLAN_ACCESS=false
// (mis. saat baru migrasi data plan tenant lama ke tier baru — audit dulu via log
// sebelum menyalakan enforcement, supaya tidak mengunci pelanggan bayar scr tiba-tiba).
// ==========================================================================
const ENFORCE_PLAN_ACCESS = process.env.ENFORCE_PLAN_ACCESS === 'true'

const PLAN_ACCESS_MAP = [
  // ---- Toko Space (rank 1) ----
  { re: /^\/vouchers(\/|$)/, except: /^\/vouchers\/validate(\/|$)/, plan: PLAN_BY_SLUG.toko.rank, feature: 'Voucher & Promo' },
  { re: /^\/reports\/expenses(\/|$)/, plan: PLAN_BY_SLUG.toko.rank, feature: 'Laporan Pengeluaran' },
  { re: /^\/expenses(\/|$)/, plan: PLAN_BY_SLUG.toko.rank, feature: 'Pengeluaran' },
  // ---- Cabang Space (rank 2) — Manajemen Resep & Potong Bahan Baku (HPP), Laba Rugi, Perbandingan Cabang ----
  { re: /^\/materials(\/|$)/, plan: PLAN_BY_SLUG.cabang.rank, feature: 'Manajemen Bahan Baku' },
  { re: /^\/items\/[^/]+\/materials$/, plan: PLAN_BY_SLUG.cabang.rank, feature: 'Resep/Bahan Item' },
  { re: /^\/reports\/materials(\/|$)/, plan: PLAN_BY_SLUG.cabang.rank, feature: 'Laporan Stok Bahan' },
  { re: /^\/reports\/profit-loss(\/|$)/, plan: PLAN_BY_SLUG.cabang.rank, feature: 'Laporan Laba Rugi' },
  { re: /^\/reports\/branches-comparison(\/|$)/, plan: PLAN_BY_SLUG.cabang.rank, feature: 'Perbandingan Cabang' },
  // ---- Juragan Space AI (rank 3) — Kitchen Display, audit, manajemen akses lanjutan ----
  { re: /^\/kitchen(\/|$)/, plan: PLAN_BY_SLUG.juragan.rank, feature: 'Kitchen Display' },
  { re: /^\/activity-logs(\/|$)/, plan: PLAN_BY_SLUG.juragan.rank, feature: 'Log Aktivitas / Audit' },
  { re: /^\/(all-)?user-access(\/|$)/, plan: PLAN_BY_SLUG.juragan.rank, feature: 'Manajemen Akses' },
]

const enforcePlanAccess = (req, res, next) => {
  try {
    const rule = PLAN_ACCESS_MAP.find(
      (r) => r.re.test(req.path) && (!r.except || !r.except.test(req.path))
    )
    if (rule && planRank(req.subscriptionPlan) < rule.plan) {
      const needed = planLabelForRank(rule.plan)
      if (ENFORCE_PLAN_ACCESS) {
        return res.status(403).json({
          success: false,
          code: 'PLAN_UPGRADE_REQUIRED',
          requiredPlan: needed,
          error: `Fitur "${rule.feature}" membutuhkan paket ${needed}. Silakan upgrade langganan Anda.`,
        })
      }
      console.warn(`[PLAN AUDIT] tenant ${req.tenantId} plan '${req.subscriptionPlan}' akses '${rule.feature}' (${req.method} ${req.path}) — akan 403 bila ENFORCE_PLAN_ACCESS=true`)
    }
  } catch (err) {
    console.warn('[PLAN] enforcePlanAccess error (fail-open):', err.message)
  }
  next()
}

router.use(enforcePlanAccess)

// Ensure optional columns exist (idempotent)
async function ensureMaterialsColumn() {
  // Kolom verifikasi email (self-service signup). Idempoten.
  for (const sql of [
    'ALTER TABLE cashiers ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0',
    'ALTER TABLE cashiers ADD COLUMN email_verify_token VARCHAR(64) NULL',
    'ALTER TABLE cashiers ADD COLUMN email_verify_expires DATETIME NULL',
    // Slug publik tenant untuk URL QR meja (self-order pelanggan). Diisi saat tenant dibuat.
    'ALTER TABLE tenants ADD COLUMN public_slug VARCHAR(32) NULL',
    // Kolom masa langganan company (dipakai untuk cek expiry & upgrade plan).
    'ALTER TABLE companies ADD COLUMN subscription_started_at DATETIME NULL',
    'ALTER TABLE companies ADD COLUMN subscription_expires_at DATETIME NULL',
  ]) {
    try { await query(sql) } catch (err) {
      if (!/Duplicate column|exists/i.test(err?.message || '')) console.warn('Warning adding email-verify column:', err.message)
    }
  }
  try {
    await query('ALTER TABLE menu_items ADD COLUMN materials TEXT NULL')
  } catch (err) {
    // Ignore if column already exists
    if (!/Duplicate column|exists/i.test(err?.message || '')) {
      // eslint-disable-next-line no-console
      console.warn('Warning adding materials column:', err.message)
    }
  }
  try {
    await query('ALTER TABLE menu_items ADD COLUMN is_active TINYINT(1) DEFAULT 1')
  } catch (err) {
    if (!/Duplicate column|exists/i.test(err?.message || '')) {
      // eslint-disable-next-line no-console
      console.warn('Warning adding is_active column:', err.message)
    }
  }
  try {
    await query('ALTER TABLE menu_items ADD COLUMN cost_price INT NULL DEFAULT 0')
  } catch (err) {
    if (!/Duplicate column|exists/i.test(err?.message || '')) {
      // eslint-disable-next-line no-console
      console.warn('Warning adding cost_price column:', err.message)
    }
  }
  try {
    await query("ALTER TABLE menu_items ADD COLUMN product_type ENUM('recipe','stock','service') NOT NULL DEFAULT 'recipe'")
  } catch (err) {
    if (!/Duplicate column|exists/i.test(err?.message || '')) {
      console.warn('Warning adding product_type column:', err.message)
    }
  }
  try {
    await query('ALTER TABLE menu_items ADD COLUMN unit_label VARCHAR(30) NULL')
  } catch (err) {
    if (!/Duplicate column|exists/i.test(err?.message || '')) {
      console.warn('Warning adding unit_label column:', err.message)
    }
  }
  // Ensure materials and product_materials tables
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS materials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        unit VARCHAR(20) NOT NULL,
        price DECIMAL(10,2) DEFAULT 0,
        stock DECIMAL(10,2) DEFAULT 0,
        stock_min DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS product_materials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        menu_item_id VARCHAR(50) NOT NULL,
        material_id INT NOT NULL,
        qty DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_product_material_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
        CONSTRAINT fk_product_material_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
      )
    `)
    // Create material movements table
    await query(`
      CREATE TABLE IF NOT EXISTS material_movements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        material_id INT NOT NULL,
        type ENUM('in', 'out') NOT NULL,
        qty DECIMAL(10,2) NOT NULL,
        price DECIMAL(10,2) DEFAULT 0,
        notes VARCHAR(255) NULL,
        order_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_movement_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
        CONSTRAINT fk_movement_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
        INDEX idx_material_type (material_id, type),
        INDEX idx_created_at (created_at)
      )
    `)
    // Ensure price column exists (if table already created)
    try {
      await query('ALTER TABLE material_movements ADD COLUMN price DECIMAL(10,2) DEFAULT 0')
    } catch (e) { /* column exists */ }
    // Create expenses table
    await query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category VARCHAR(100) NOT NULL,
        description VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_category (category),
        INDEX idx_created_at (created_at)
      )
    `)
    // Create activity logs table
    await query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cashier_id INT NULL,
        action VARCHAR(50) NOT NULL,
        entity VARCHAR(50) NOT NULL,
        entity_id VARCHAR(50) NULL,
        details TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cashier (cashier_id),
        INDEX idx_entity (entity, entity_id),
        INDEX idx_created_at (created_at),
        CONSTRAINT fk_activity_cashier FOREIGN KEY (cashier_id) REFERENCES cashiers(id) ON DELETE SET NULL
      )
    `)
    // Dompet Fase C: rekening bank, anchor kunci per-tenant (serialisasi penarikan), payout.
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS wallets (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tenant_id INT NOT NULL,
          company_id INT NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uniq_wallet_tenant (tenant_id)
        )
      `)
      await query(`
        CREATE TABLE IF NOT EXISTS bank_accounts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          company_id INT NOT NULL,
          bank_name VARCHAR(60) NOT NULL,
          account_number VARCHAR(40) NOT NULL,
          account_holder VARCHAR(100) NOT NULL,
          is_default TINYINT(1) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          KEY idx_company (company_id)
        )
      `)
      await query(`
        CREATE TABLE IF NOT EXISTS payouts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          company_id INT NOT NULL,
          tenant_id INT NOT NULL,
          amount BIGINT NOT NULL,
          bank_name VARCHAR(60) NOT NULL,
          account_number VARCHAR(40) NOT NULL,
          account_holder VARCHAR(100) NOT NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'pending',
          note VARCHAR(255) NULL,
          admin_note VARCHAR(255) NULL,
          reference VARCHAR(100) NULL,
          requested_by INT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processed_at DATETIME NULL,
          KEY idx_company (company_id),
          KEY idx_status (status)
        )
      `)
    } catch (e) { /* tables exist */ }
    // Add stock columns if not exist
    try {
      await query('ALTER TABLE materials ADD COLUMN stock DECIMAL(10,2) DEFAULT 0')
    } catch (e) { /* column exists */ }
    try {
      await query('ALTER TABLE materials ADD COLUMN stock_min DECIMAL(10,2) DEFAULT 0')
    } catch (e) { /* column exists */ }
    try {
      await query('ALTER TABLE materials ADD COLUMN price DECIMAL(10,2) DEFAULT 0')
    } catch (e) { /* column exists */ }
    // Ensure table order columns exist for QR table ordering
    try {
      await query('ALTER TABLE orders ADD COLUMN table_number VARCHAR(30) NULL')
    } catch (e) { /* column exists */ }
    try {
      await query('ALTER TABLE orders ADD COLUMN customer_name VARCHAR(120) NULL')
    } catch (e) { /* column exists */ }
    try {
      await query("ALTER TABLE orders ADD COLUMN order_type VARCHAR(30) NULL DEFAULT 'kasir'")
    } catch (e) { /* column exists */ }
    try {
      await query("ALTER TABLE orders ADD COLUMN order_status VARCHAR(30) NULL DEFAULT 'paid'")
    } catch (e) { /* column exists */ }
    try {
      await query('ALTER TABLE orders ADD COLUMN notes VARCHAR(255) NULL')
    } catch (e) { /* column exists */ }
    try {
      await query('ALTER TABLE orders ADD COLUMN stock_deducted TINYINT(1) DEFAULT 0')
    } catch (e) { /* column exists */ }
    try {
      await query('ALTER TABLE orders ADD COLUMN payment_gateway VARCHAR(30) NULL')
    } catch (e) { /* column exists */ }
    try {
      await query('ALTER TABLE orders ADD COLUMN payment_reference VARCHAR(100) NULL')
    } catch (e) { /* column exists */ }
    try {
      await query('ALTER TABLE orders ADD COLUMN payment_qr_url TEXT NULL')
    } catch (e) { /* column exists */ }
    try {
      await query('ALTER TABLE orders ADD COLUMN payment_status VARCHAR(30) NULL')
    } catch (e) { /* column exists */ }
    try {
      await query('ALTER TABLE orders ADD COLUMN payment_expired_at DATETIME NULL')
    } catch (e) { /* column exists */ }
    try {
      await query('ALTER TABLE orders ADD COLUMN paid_at DATETIME NULL')
    } catch (e) { /* column exists */ }
    // Kolom shift (dibuat oleh pos-coffe; dipastikan di sini agar monitoring shift aman)
    try {
      await query('ALTER TABLE orders ADD COLUMN shift_id INT NULL')
    } catch (e) { /* column exists */ }
    try {
      await query('ALTER TABLE orders ADD COLUMN cashier_id INT NULL')
    } catch (e) { /* column exists */ }
    // Ensure companies table
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS companies (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          subscription_plan VARCHAR(50) DEFAULT 'free',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `)
      await query(`
        INSERT INTO companies (id, name, subscription_plan)
        VALUES (1, 'Default Business Group', 'premium')
        ON DUPLICATE KEY UPDATE name=name
      `)
    } catch (e) { /* error setting up companies */ }

    // Ensure subscription_payments table (checkout upgrade paket via Midtrans Snap)
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS subscription_payments (
          id INT AUTO_INCREMENT PRIMARY KEY,
          company_id INT NOT NULL,
          plan VARCHAR(50) NOT NULL,
          months INT NOT NULL,
          amount INT NOT NULL,
          midtrans_order_id VARCHAR(100) NOT NULL UNIQUE,
          snap_token VARCHAR(255) NULL,
          status VARCHAR(30) NOT NULL DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          paid_at DATETIME NULL
        )
      `)
    } catch (e) { /* error setting up subscription_payments */ }

    // Ensure company_id columns
    for (const tableName of ['tenants', 'menu_items', 'materials']) {
      try {
        await query(`ALTER TABLE ${tableName} ADD COLUMN company_id INT NOT NULL DEFAULT 1`)
      } catch (e) { /* column exists */ }
    }

    // Ensure branch_menu_items table
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS branch_menu_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          branch_id INT NOT NULL,
          menu_item_id VARCHAR(50) NOT NULL,
          is_available TINYINT(1) DEFAULT 1,
          price_override INT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_branch_menu (branch_id, menu_item_id)
        )
      `)
    } catch (e) { /* table exists */ }

    // Ensure branch_materials table
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS branch_materials (
          id INT AUTO_INCREMENT PRIMARY KEY,
          branch_id INT NOT NULL,
          material_id INT NOT NULL,
          stock DECIMAL(10,2) DEFAULT 0,
          stock_min DECIMAL(10,2) DEFAULT 0,
          UNIQUE KEY unique_branch_material (branch_id, material_id)
        )
      `)
    } catch (e) { /* table exists */ }

    // Ensure branch_stock_items table (direct stock for 'stock'-type/retail products)
    // Charset must match menu_items (utf8mb4) — the DB default is latin1, which breaks the FK (errno 150).
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS branch_stock_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          branch_id INT NOT NULL,
          menu_item_id VARCHAR(50) NOT NULL,
          stock DECIMAL(10,2) DEFAULT 0,
          stock_min DECIMAL(10,2) DEFAULT 0,
          UNIQUE KEY unique_branch_stock_item (branch_id, menu_item_id),
          CONSTRAINT fk_branch_stock_item_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
      `)
    } catch (e) {
      console.warn('Warning creating branch_stock_items table:', e.message)
    }

    for (const tableName of ['menu_items', 'materials', 'orders', 'expenses', 'activity_logs', 'cashiers']) {
      try {
        await query(`ALTER TABLE ${tableName} ADD COLUMN tenant_id INT NULL`)
      } catch (e) { /* column exists */ }
    }
    // Ensure roles/modules/access tables exist
    await query(`
      CREATE TABLE IF NOT EXISTS roles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS modules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        label VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        icon VARCHAR(50) NULL,
        path VARCHAR(100) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await query(`
      CREATE TABLE IF NOT EXISTS user_module_access (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cashier_id INT NOT NULL,
        module_id INT NOT NULL,
        can_view TINYINT(1) DEFAULT 1,
        can_create TINYINT(1) DEFAULT 0,
        can_edit TINYINT(1) DEFAULT 0,
        can_delete TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_module (cashier_id, module_id)
      )
    `)
    try {
      const defaultModules = [
        "('kasir', 'Kasir (POS)', 'Modul transaksi kasir', '🛒', '/kasir')",
        "('produk', 'Manajemen Produk', 'Kelola produk dan harga', '📦', '/produk')",
        "('laporan', 'Laporan Penjualan', 'Lihat laporan transaksi', '📊', '/laporan')",
        "('akun_kasir', 'Akun Kasir', 'Kelola user kasir', '👥', '/akun-kasir')",
        "('bahan', 'Bahan Baku', 'Kelola stok bahan baku', '🌾', '/bahan')",
        "('pengeluaran', 'Pengeluaran', 'Pencatatan pengeluaran operasional', '💸', '/pengeluaran')",
        "('laporan_bahan', 'Laporan Bahan', 'Laporan mutasi bahan baku', '📑', '/laporan-bahan')",
        "('activity_logs', 'Log Aktivitas', 'Lihat log aktivitas user', '🧾', '/activity-logs')",
        "('manajemen_akses', 'Manajemen Akses', 'Atur hak akses modul user', '🔐', '/manajemen-akses')",
        "('kustom_ui', 'Kustom UI', 'Pengaturan tema dan tampilan', '🎨', '/kustom-ui')",
        "('vouchers', 'Voucher Promo', 'Kelola kupon voucher dan diskon', '🎫', '/vouchers')"
      ];
      await query(`INSERT IGNORE INTO modules (name, label, description, icon, path) VALUES ${defaultModules.join(',')}`);
    } catch (e) { /* module table may not exist */ }
    try {
      await query(
        `INSERT IGNORE INTO user_module_access (cashier_id, module_id, can_view, can_create, can_edit, can_delete)
         SELECT c.id, m.id, 1, 1, 1, 1
         FROM cashiers c
         CROSS JOIN modules m
         WHERE c.role IN ('admin', 'owner')`
      )
    } catch (e) { /* access table may not exist */ }

    // Ensure vouchers table
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS vouchers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          code VARCHAR(50) NOT NULL,
          description VARCHAR(255) NULL,
          discount_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage',
          discount_value DECIMAL(10,2) NOT NULL,
          min_order_amount INT DEFAULT 0,
          max_discount_amount INT NULL,
          expiry_date DATETIME NULL,
          usage_limit INT DEFAULT NULL,
          used_count INT DEFAULT 0,
          is_active TINYINT(1) DEFAULT 1,
          tenant_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_tenant_code (tenant_id, code)
        )
      `)
    } catch (e) {
      console.warn('Warning creating vouchers table:', e.message)
    }

    // Ensure columns in orders table
    try {
      await query('ALTER TABLE orders ADD COLUMN discount_amount INT DEFAULT 0')
    } catch (e) { /* column exists */ }
    try {
      await query('ALTER TABLE orders ADD COLUMN voucher_code VARCHAR(50) NULL')
    } catch (e) { /* column exists */ }
    try {
      await query('ALTER TABLE menu_items ADD COLUMN discount_price INT NULL DEFAULT NULL')
    } catch (e) { /* column exists */ }

    // ===== RBAC: normalisasi izin satu-kali sebelum enforcement aktif =====
    // Sama dg pos-coffe (DB bersama). Guard `app_migrations` memastikan hanya jalan
    // sekali secara global — backend mana pun yang boot lebih dulu yang menjalankannya.
    try {
      await query('CREATE TABLE IF NOT EXISTS app_migrations (name VARCHAR(100) PRIMARY KEY, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)')
      const done = await query("SELECT name FROM app_migrations WHERE name='rbac_grant_full_v1'")
      if (!done.length) {
        const upd = await query(
          `UPDATE user_module_access uma
             JOIN cashiers c ON c.id = uma.cashier_id
              SET uma.can_create=1, uma.can_edit=1, uma.can_delete=1
            WHERE uma.can_view=1 AND LOWER(c.role) NOT IN ('admin','owner')`
        )
        await query("INSERT INTO app_migrations (name) VALUES ('rbac_grant_full_v1')")
        console.log(`[RBAC] Normalisasi izin satu-kali: ${upd.affectedRows ?? 0} baris kasir dinaikkan ke full CRUD.`)
      }
    } catch (e) {
      console.warn('[RBAC] Normalisasi izin gagal (dilewati):', e.message)
    }

  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Warning creating materials tables:', err.message)
  }
}
ensureMaterialsColumn()

async function ensureNotificationColumns() {
  try {
    await query('ALTER TABLE cashiers ADD COLUMN telegram_chat_id VARCHAR(50) NULL')
  } catch (err) {
    if (!/Duplicate column|exists/i.test(err?.message || '')) {
      // eslint-disable-next-line no-console
      console.warn('Warning adding telegram_chat_id column:', err.message)
    }
  }
  try {
    await query('ALTER TABLE cashiers ADD COLUMN telegram_link_token VARCHAR(100) NULL')
  } catch (err) {
    if (!/Duplicate column|exists/i.test(err?.message || '')) {
      // eslint-disable-next-line no-console
      console.warn('Warning adding telegram_link_token column:', err.message)
    }
  }
  try {
    await query('ALTER TABLE cashiers ADD COLUMN notify_low_stock TINYINT(1) NOT NULL DEFAULT 0')
  } catch (err) {
    if (!/Duplicate column|exists/i.test(err?.message || '')) {
      // eslint-disable-next-line no-console
      console.warn('Warning adding notify_low_stock column:', err.message)
    }
  }
}
ensureNotificationColumns()

const getCashierIdFromReq = (req) => {
  if (req.cashierId) return req.cashierId
  const raw = req.headers['x-cashier-id'] || req.body?.cashierId || req.query?.cashierId
  const num = Number(raw)
  return Number.isFinite(num) && num > 0 ? num : null
}

const requirePrivilegedCashier = async (req, res, next) => {
  const cashierId = getCashierIdFromReq(req);
  if (!cashierId) {
    return res.status(401).json({ error: 'Kasir pengirim request tidak teridentifikasi. Harap login kembali.' });
  }
  try {
    // Cari role kasir dan company_id dari tenant tempat kasir terdaftar
    const rows = await query(
      `SELECT c.role, t.company_id 
       FROM cashiers c 
       JOIN tenants t ON c.tenant_id = t.id 
       WHERE c.id = ? LIMIT 1`, 
      [cashierId]
    );
    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Pengguna tidak ditemukan.' });
    }
    
    const role = String(rows[0].role).toLowerCase();
    const companyId = rows[0].company_id;

    // Pastikan kasir berasal dari company group yang sama
    if (companyId !== req.companyId) {
      return res.status(403).json({ error: 'Akses ditolak: Kasir tidak terdaftar pada grup bisnis ini.' });
    }

    if (role !== 'admin' && role !== 'owner') {
      return res.status(403).json({ error: 'Akses ditolak: Hanya Admin atau Owner yang diizinkan untuk mengelola akun dan hak akses.' });
    }
    req.callerRole = role;
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const logActivity = async (req, action, entity, entityId = null, details = null) => {
  try {
    const cashierId = getCashierIdFromReq(req)
    await query(
      'INSERT INTO activity_logs (cashier_id, action, entity, entity_id, details, tenant_id) VALUES (?, ?, ?, ?, ?, ?)',
      [cashierId, action, entity, entityId ? String(entityId) : null, details ? JSON.stringify(details) : null, req.tenantId || null]
    )
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Activity log failed:', err.message)
  }
}

// Multer setup (memory storage; limit ~5MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('File harus berupa gambar'))
    }
    cb(null, true)
  },
})

async function uploadBufferToFtp(buffer, filename) {
  const client = new FtpClient()
  try {
    await client.access({
      host: process.env.FTP_HOST,
      port: Number(process.env.FTP_PORT) || 21,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      secure: false,
    })

    const baseDir = process.env.FTP_BASE_DIR || 'public_html/uploads'
    await client.ensureDir(baseDir)
    const stream = Readable.from(buffer)
    await client.uploadFrom(stream, filename)
  } finally {
    client.close()
  }
}

router.post('/upload/image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Tidak ada file yang diunggah' })

    const ext = path.extname(req.file.originalname || '').toLowerCase() || '.jpg'
    const safeBase = (req.body.base || 'img').replace(/[^a-zA-Z0-9-_]/g, '') || 'img'
    const ts = Date.now()
    const filename = `${safeBase}-${ts}${ext}`

    let url = ''
    try {
      if (process.env.FTP_HOST) {
        await uploadBufferToFtp(req.file.buffer, filename)
        const publicBase = process.env.FTP_PUBLIC_BASE_URL || ''
        url = publicBase ? `${publicBase}/${filename}` : filename
      } else {
        throw new Error('FTP Host tidak dikonfigurasi, menggunakan penyimpanan lokal')
      }
    } catch (ftpErr) {
      console.warn('FTP upload failed or not configured, falling back to local storage:', ftpErr.message)
      
      const publicDir = path.join(__dirname, '..', 'public')
      const uploadsDir = path.join(publicDir, 'uploads')
      
      const fs = await import('fs')
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
      }
      
      const filePath = path.join(uploadsDir, filename)
      fs.writeFileSync(filePath, req.file.buffer)
      
      const host = req.get('host')
      const protocol = req.protocol
      const rawBasePath = process.env.BASE_PATH || ''
      const normalizedBasePath = rawBasePath ? `/${rawBasePath.replace(/^\/+|\/+$/g, '')}` : ''
      url = `${protocol}://${host}${normalizedBasePath}/uploads/${filename}`
    }

    res.status(201).json({ filename, url })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Gagal mengunggah gambar' })
  }
})

// Status masa aktif langganan untuk klien (owner) — read-only, company-scoped.
router.get('/subscription', async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, name, subscription_plan, subscription_expires_at, subscription_started_at, created_at FROM companies WHERE id = ? LIMIT 1',
      [req.companyId]
    )
    if (!rows.length) return res.status(404).json({ success: false, message: 'Perusahaan tidak ditemukan' })
    const co = rows[0]
    const eff = effectiveExpiry(co.subscription_plan, co.subscription_expires_at, co.created_at)
    const now = Date.now()
    const isTrial = String(co.subscription_plan || 'free').toLowerCase() === 'free' && !co.subscription_expires_at
    res.json({
      success: true,
      data: {
        plan: co.subscription_plan || 'free',
        isTrial,
        unlimited: !eff,
        expiresAt: eff ? eff.toISOString() : null,
        expired: !!eff && eff.getTime() < now,
        daysLeft: eff ? Math.ceil((eff.getTime() - now) / 86400000) : null,
        startedAt: co.subscription_started_at || null,
        registeredAt: co.created_at || null,
      }
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// Dompet digital (Fase A+B) — owner-only, company-scoped. READ-ONLY.
// SALDO (kumulatif, all-time): total perusahaan + per cabang, tersedia vs tertahan via T+1.
// RINGKASAN (arus per periode): pemasukan kotor, biaya platform, bersih, jumlah transaksi.
// Filter: ?period=today|month|all (default month), ?branch=<tenantId>|all (default all).
// Dana dikreditkan oleh backend pos-coffe saat transaksi gateway lunas (DB bersama).
router.get('/wallet', async (req, res) => {
  if (String(req.callerRole || '').toLowerCase() !== 'owner') {
    return res.status(403).json({ success: false, message: 'Hanya pemilik (owner) yang dapat melihat dompet.' })
  }
  const period = ['today', 'all', 'month'].includes(req.query.period) ? req.query.period : 'month'
  const branch = req.query.branch && req.query.branch !== 'all' ? parseInt(req.query.branch, 10) : null
  // Kondisi periode (dipakai ringkasan & daftar entri; SALDO tetap all-time).
  const periodSql = period === 'today'
    ? 'AND DATE(w.created_at) = CURDATE()'
    : period === 'month'
      ? "AND w.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01')"
      : ''
  const branchSql = branch ? 'AND w.tenant_id = ?' : ''
  try {
    const signed = "CASE WHEN w.direction='credit' THEN w.amount ELSE -w.amount END"
    const availableExpr = `COALESCE(SUM(CASE WHEN (w.available_at IS NULL OR w.available_at <= NOW()) THEN (${signed}) ELSE 0 END),0)`
    const pendingExpr = `COALESCE(SUM(CASE WHEN (w.available_at > NOW()) THEN (${signed}) ELSE 0 END),0)`

    // Saldo per cabang (all-time, kumulatif).
    const branches = await query(
      `SELECT t.id AS tenantId, t.name AS branchName,
              ${availableExpr} AS available, ${pendingExpr} AS pending
         FROM tenants t
         LEFT JOIN wallet_entries w ON w.tenant_id = t.id
        WHERE t.company_id = ?
        GROUP BY t.id, t.name
        ORDER BY t.name`,
      [req.companyId]
    )
    const totals = branches.reduce(
      (a, b) => { a.available += Number(b.available) || 0; a.pending += Number(b.pending) || 0; return a },
      { available: 0, pending: 0 }
    )

    // Ringkasan arus untuk periode (+ cabang) terpilih.
    const sumRows = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN w.type='sale' AND w.direction='credit' THEN w.amount ELSE 0 END),0) AS grossSales,
         COALESCE(SUM(CASE WHEN w.type='platform_fee' AND w.direction='debit' THEN w.amount ELSE 0 END),0) AS platformFees,
         COUNT(DISTINCT CASE WHEN w.type='sale' THEN w.order_id END) AS trxCount
       FROM wallet_entries w
       WHERE w.company_id = ? ${branchSql} ${periodSql}`,
      branch ? [req.companyId, branch] : [req.companyId]
    )
    const s = sumRows[0] || {}
    const grossSales = Number(s.grossSales) || 0
    const platformFees = Number(s.platformFees) || 0

    // Daftar entri (dengan filter periode + cabang).
    const entries = await query(
      `SELECT w.id, w.tenant_id AS tenantId, t.name AS branchName, w.direction, w.type, w.amount,
              w.reference, w.order_id AS orderId, w.available_at AS availableAt, w.note, w.created_at AS createdAt,
              (w.available_at IS NOT NULL AND w.available_at > NOW()) AS isPending
         FROM wallet_entries w
         LEFT JOIN tenants t ON t.id = w.tenant_id
        WHERE w.company_id = ? ${branchSql} ${periodSql}
        ORDER BY w.id DESC
        LIMIT 200`,
      branch ? [req.companyId, branch] : [req.companyId]
    )

    res.json({
      success: true,
      data: {
        company: { available: totals.available, pending: totals.pending, total: totals.available + totals.pending },
        branches: branches.map((b) => ({
          tenantId: b.tenantId, branchName: b.branchName,
          available: Number(b.available) || 0, pending: Number(b.pending) || 0,
        })),
        summary: { period, branch: branch || 'all', grossSales, platformFees, net: grossSales - platformFees, trxCount: Number(s.trxCount) || 0 },
        entries,
      },
    })
  } catch (err) {
    // Bila tabel ledger belum ada (backend pos-coffe belum migrasi), balas dompet kosong.
    if (/wallet_entries.*doesn't exist|ER_NO_SUCH_TABLE/i.test(err?.message || '')) {
      return res.json({ success: true, data: { company: { available: 0, pending: 0, total: 0 }, branches: [], summary: { period, branch: branch || 'all', grossSales: 0, platformFees: 0, net: 0, trxCount: 0 }, entries: [] } })
    }
    res.status(500).json({ success: false, error: err.message })
  }
})

// ===== Dompet Fase C: rekening bank & penarikan (payout) — owner-only =====
const requireOwner = (req, res) => {
  if (String(req.callerRole || '').toLowerCase() !== 'owner') {
    res.status(403).json({ success: false, message: 'Hanya pemilik (owner) yang dapat mengakses fitur ini.' })
    return false
  }
  return true
}
const MIN_PAYOUT = 10000

// Saldo TERSEDIA satu tenant (settled/available) — dipakai untuk validasi penarikan.
const availableExprSingle = "COALESCE(SUM(CASE WHEN (available_at IS NULL OR available_at <= NOW()) THEN (CASE WHEN direction='credit' THEN amount ELSE -amount END) ELSE 0 END),0)"

router.get('/bank-accounts', async (req, res) => {
  if (!requireOwner(req, res)) return
  try {
    const rows = await query(
      'SELECT id, bank_name AS bankName, account_number AS accountNumber, account_holder AS accountHolder, is_default AS isDefault, created_at AS createdAt FROM bank_accounts WHERE company_id=? ORDER BY is_default DESC, id DESC',
      [req.companyId]
    )
    res.json({ success: true, data: rows })
  } catch (err) {
    if (/doesn't exist|ER_NO_SUCH_TABLE/i.test(err?.message || '')) return res.json({ success: true, data: [] })
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/bank-accounts', async (req, res) => {
  if (!requireOwner(req, res)) return
  const bankName = String(req.body?.bankName || '').trim()
  const accountNumber = String(req.body?.accountNumber || '').trim()
  const accountHolder = String(req.body?.accountHolder || '').trim()
  const isDefault = req.body?.isDefault ? 1 : 0
  if (!bankName || !accountNumber || !accountHolder) {
    return res.status(400).json({ success: false, message: 'Nama bank, nomor rekening, dan nama pemilik wajib diisi.' })
  }
  if (!/^[0-9]{6,20}$/.test(accountNumber)) {
    return res.status(400).json({ success: false, message: 'Nomor rekening tidak valid (6–20 digit angka).' })
  }
  try {
    if (isDefault) await query('UPDATE bank_accounts SET is_default=0 WHERE company_id=?', [req.companyId])
    const r = await query(
      'INSERT INTO bank_accounts (company_id, bank_name, account_number, account_holder, is_default) VALUES (?,?,?,?,?)',
      [req.companyId, bankName, accountNumber, accountHolder, isDefault]
    )
    res.status(201).json({ success: true, message: 'Rekening bank ditambahkan.', data: { id: r.insertId } })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.delete('/bank-accounts/:id', async (req, res) => {
  if (!requireOwner(req, res)) return
  const id = parseInt(req.params.id, 10)
  try {
    const rows = await query('SELECT id FROM bank_accounts WHERE id=? AND company_id=? LIMIT 1', [id, req.companyId])
    if (!rows.length) return res.status(404).json({ success: false, message: 'Rekening tidak ditemukan.' })
    await query('DELETE FROM bank_accounts WHERE id=? AND company_id=?', [id, req.companyId])
    res.json({ success: true, message: 'Rekening dihapus.' })
  } catch (err) {
    res.status(500).json({ success: false, error: err.message })
  }
})

// Ajukan penarikan — RESERVASI ATOMIK: lock anchor wallet per-tenant (FOR UPDATE),
// hitung ulang saldo tersedia di dalam transaksi, lalu debit ledger + buat payout.
// Ini mencegah double-spend saat dua permintaan bersamaan.
router.post('/wallet/payouts', async (req, res) => {
  if (!requireOwner(req, res)) return
  const tenantId = parseInt(req.body?.tenantId, 10)
  const amount = Math.round(Number(req.body?.amount))
  const bankAccountId = parseInt(req.body?.bankAccountId, 10)
  const note = String(req.body?.note || '').trim() || null
  if (!Number.isInteger(tenantId) || !Number.isInteger(bankAccountId)) {
    return res.status(400).json({ success: false, message: 'Cabang dan rekening tujuan wajib dipilih.' })
  }
  if (!Number.isInteger(amount) || amount < MIN_PAYOUT) {
    return res.status(400).json({ success: false, message: `Nominal penarikan minimal Rp${MIN_PAYOUT.toLocaleString('id-ID')}.` })
  }
  try {
    const result = await transaction(async (conn) => {
      // Validasi cabang & rekening milik perusahaan ini.
      const [trows] = await conn.execute('SELECT id, name FROM tenants WHERE id=? AND company_id=? LIMIT 1', [tenantId, req.companyId])
      if (!trows.length) { const e = new Error('Cabang tidak ditemukan.'); e.code = 'BAD'; throw e }
      const [brows] = await conn.execute('SELECT bank_name, account_number, account_holder FROM bank_accounts WHERE id=? AND company_id=? LIMIT 1', [bankAccountId, req.companyId])
      if (!brows.length) { const e = new Error('Rekening tujuan tidak ditemukan.'); e.code = 'BAD'; throw e }
      const bank = brows[0]

      // Lock anchor per-tenant (buat bila belum ada) → serialisasi penarikan.
      await conn.execute('INSERT IGNORE INTO wallets (tenant_id, company_id) VALUES (?,?)', [tenantId, req.companyId])
      await conn.execute('SELECT id FROM wallets WHERE tenant_id=? FOR UPDATE', [tenantId])

      // Saldo tersedia SETELAH lock (mencerminkan penarikan lain yang sudah masuk).
      const [arows] = await conn.execute(`SELECT ${availableExprSingle} AS available FROM wallet_entries WHERE tenant_id=?`, [tenantId])
      const available = Number(arows[0]?.available || 0)
      if (amount > available) { const e = new Error(`Saldo tersedia tidak cukup. Tersedia Rp${available.toLocaleString('id-ID')}.`); e.code = 'BAD'; throw e }

      // Buat payout (pending) + debit ledger yang mereservasi dana.
      const [pr] = await conn.execute(
        `INSERT INTO payouts (company_id, tenant_id, amount, bank_name, account_number, account_holder, status, note, requested_by)
         VALUES (?,?,?,?,?,?, 'pending', ?, ?)`,
        [req.companyId, tenantId, amount, bank.bank_name, bank.account_number, bank.account_holder, note, req.cashierId || null]
      )
      const payoutId = pr.insertId
      await conn.execute(
        `INSERT INTO wallet_entries (tenant_id, company_id, direction, type, amount, reference, order_id, available_at, note, idempotency_key)
         VALUES (?,?, 'debit', 'payout', ?, ?, NULL, NULL, ?, ?)`,
        [tenantId, req.companyId, amount, `payout:${payoutId}`, 'Penarikan saldo', `payout:${payoutId}`]
      )
      return { payoutId, branchName: trows[0].name }
    })
    res.status(201).json({ success: true, message: `Penarikan Rp${amount.toLocaleString('id-ID')} diajukan. Menunggu diproses admin.`, data: result })
  } catch (err) {
    if (err.code === 'BAD') return res.status(400).json({ success: false, message: err.message })
    if (/doesn't exist|ER_NO_SUCH_TABLE/i.test(err?.message || '')) {
      return res.status(400).json({ success: false, message: 'Fitur dompet belum aktif. Restart backend.' })
    }
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/wallet/payouts', async (req, res) => {
  if (!requireOwner(req, res)) return
  try {
    const rows = await query(
      `SELECT p.id, p.tenant_id AS tenantId, t.name AS branchName, p.amount, p.bank_name AS bankName,
              p.account_number AS accountNumber, p.account_holder AS accountHolder, p.status, p.note, p.admin_note AS adminNote,
              p.reference, p.created_at AS createdAt, p.processed_at AS processedAt
         FROM payouts p LEFT JOIN tenants t ON t.id = p.tenant_id
        WHERE p.company_id=? ORDER BY p.id DESC LIMIT 100`,
      [req.companyId]
    )
    res.json({ success: true, data: rows })
  } catch (err) {
    if (/doesn't exist|ER_NO_SUCH_TABLE/i.test(err?.message || '')) return res.json({ success: true, data: [] })
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/branches', async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, name, domain, subscription_plan, is_active, activation_code FROM tenants WHERE company_id = ? ORDER BY name',
      [req.companyId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Tambah cabang mandiri (self-service) — MODEL A / COMPANY-TIER.
// Hanya OWNER. Cabang baru mewarisi paket perusahaan (tanpa bayar tambahan
// selama masih dalam kuota paket). Bila kuota penuh → 403 BRANCH_LIMIT_REACHED
// dengan ajakan upgrade tier. Cabang langsung aktif + punya activation_code sendiri.
router.post('/branches', async (req, res) => {
  if (String(req.callerRole || '').toLowerCase() !== 'owner') {
    return res.status(403).json({ success: false, message: 'Hanya pemilik (owner) yang dapat menambah cabang.' })
  }
  const name = String(req.body?.name || '').trim()
  if (!name) {
    return res.status(400).json({ success: false, message: 'Nama cabang wajib diisi.' })
  }
  if (name.length > 100) {
    return res.status(400).json({ success: false, message: 'Nama cabang terlalu panjang (maks. 100 karakter).' })
  }

  try {
    // Paket perusahaan = sumber kebenaran kuota. Semua tenant sudah tersinkron ke
    // paket perusahaan, jadi ambil dari companies langsung.
    const companyRows = await query('SELECT subscription_plan FROM companies WHERE id = ? LIMIT 1', [req.companyId])
    if (!companyRows.length) {
      return res.status(404).json({ success: false, message: 'Perusahaan tidak ditemukan.' })
    }
    const companyPlan = companyRows[0].subscription_plan
    const limit = branchLimitFor(companyPlan)

    const [{ cnt }] = await query('SELECT COUNT(*) AS cnt FROM tenants WHERE company_id = ?', [req.companyId])
    if (limit !== null && cnt >= limit) {
      const nextTier = nextPlanLabel(companyPlan)
      return res.status(403).json({
        success: false,
        code: 'BRANCH_LIMIT_REACHED',
        message: `Paket ${planLabel(companyPlan)} dibatasi ${limit} cabang. Upgrade ke ${nextTier} untuk menambah cabang lagi.`,
        data: { plan: normalizePlan(companyPlan), limit, current: cnt, nextTier },
      })
    }

    const companyPlanSlug = normalizePlan(companyPlan)
    const domain = `${slugifyBusiness(name)}${crypto.randomBytes(3).toString('hex')}`
    const activationCode = genActivationCode()
    const result = await query(
      'INSERT INTO tenants (name, domain, subscription_plan, is_active, activation_code, company_id, public_slug) VALUES (?, ?, ?, 1, ?, ?, ?)',
      [name, domain, companyPlanSlug, activationCode, req.companyId, genPublicSlug()]
    )
    const newId = result.insertId

    // Audit ke activity_logs (tenant baru sebagai entity_id).
    try {
      await query(
        'INSERT INTO activity_logs (cashier_id, tenant_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [req.cashierId || null, newId, 'branch_create', 'branch', newId, JSON.stringify({ name, plan: companyPlanSlug, domain })]
      )
    } catch { /* log gagal tidak boleh menggagalkan pembuatan cabang */ }

    res.status(201).json({
      success: true,
      message: `Cabang "${name}" berhasil ditambahkan (paket ${companyPlan.toUpperCase()}).`,
      data: { id: newId, name, domain, subscription_plan: companyPlan, is_active: 1, activation_code: activationCode },
    })
  } catch (err) {
    console.error('[BRANCH-CREATE] error:', err.message)
    res.status(500).json({ success: false, message: 'Gagal menambah cabang: ' + err.message })
  }
})

// Aktif/nonaktifkan cabang (reversible) — owner-only. Cabang nonaktif langsung
// memblokir login/akses kasirnya (OUTLET_SUSPENDED). Tidak boleh menonaktifkan
// cabang AKTIF terakhir agar perusahaan selalu punya minimal 1 outlet beroperasi.
router.put('/branches/:id/status', async (req, res) => {
  if (String(req.callerRole || '').toLowerCase() !== 'owner') {
    return res.status(403).json({ success: false, message: 'Hanya pemilik (owner) yang dapat mengubah status cabang.' })
  }
  const id = parseInt(req.params.id, 10)
  const active = req.body?.is_active ? 1 : 0
  if (!Number.isInteger(id)) return res.status(400).json({ success: false, message: 'ID cabang tidak valid.' })

  try {
    const rows = await query('SELECT id, name, is_active FROM tenants WHERE id = ? AND company_id = ? LIMIT 1', [id, req.companyId])
    if (!rows.length) return res.status(404).json({ success: false, message: 'Cabang tidak ditemukan.' })

    if (active === 0) {
      const [{ activeCnt }] = await query('SELECT COUNT(*) AS activeCnt FROM tenants WHERE company_id = ? AND is_active = 1', [req.companyId])
      // Bila cabang ini satu-satunya yang aktif, blokir.
      if (Number(rows[0].is_active) === 1 && activeCnt <= 1) {
        return res.status(400).json({ success: false, message: 'Tidak dapat menonaktifkan cabang aktif terakhir. Minimal 1 cabang harus aktif.' })
      }
    }

    await query('UPDATE tenants SET is_active = ? WHERE id = ?', [active, id])
    try {
      await query(
        'INSERT INTO activity_logs (cashier_id, tenant_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [req.cashierId || null, id, active ? 'branch_activate' : 'branch_deactivate', 'branch', id, JSON.stringify({ name: rows[0].name })]
      )
    } catch { /* noop */ }

    res.json({ success: true, message: `Cabang "${rows[0].name}" ${active ? 'diaktifkan' : 'dinonaktifkan'}.`, data: { id, is_active: active } })
  } catch (err) {
    console.error('[BRANCH-STATUS] error:', err.message)
    res.status(500).json({ success: false, message: 'Gagal mengubah status cabang: ' + err.message })
  }
})

// Hapus cabang — owner-only. Proteksi: (1) tidak boleh menghapus cabang terakhir,
// (2) blokir bila masih ada akun kasir (cegah akun yatim; sarankan nonaktifkan).
// Bersihkan pemetaan modul & data cabang-scoped (mirror admin SaaS).
router.delete('/branches/:id', async (req, res) => {
  if (String(req.callerRole || '').toLowerCase() !== 'owner') {
    return res.status(403).json({ success: false, message: 'Hanya pemilik (owner) yang dapat menghapus cabang.' })
  }
  const id = parseInt(req.params.id, 10)
  if (!Number.isInteger(id)) return res.status(400).json({ success: false, message: 'ID cabang tidak valid.' })

  try {
    const rows = await query('SELECT id, name FROM tenants WHERE id = ? AND company_id = ? LIMIT 1', [id, req.companyId])
    if (!rows.length) return res.status(404).json({ success: false, message: 'Cabang tidak ditemukan.' })

    const [{ total }] = await query('SELECT COUNT(*) AS total FROM tenants WHERE company_id = ?', [req.companyId])
    if (total <= 1) {
      return res.status(400).json({ success: false, message: 'Tidak dapat menghapus cabang terakhir. Perusahaan harus punya minimal 1 cabang.' })
    }

    const [{ cashierCnt }] = await query('SELECT COUNT(*) AS cashierCnt FROM cashiers WHERE tenant_id = ?', [id])
    if (cashierCnt > 0) {
      return res.status(409).json({
        success: false,
        code: 'BRANCH_HAS_CASHIERS',
        message: `Cabang ini masih punya ${cashierCnt} akun kasir. Hapus akun kasirnya dulu, atau cukup nonaktifkan cabang.`,
      })
    }

    // Best-effort cleanup data cabang-scoped, lalu hapus tenant.
    await query('DELETE FROM tenant_modules WHERE tenant_id = ?', [id]).catch(() => {})
    await query('DELETE FROM branch_menu_items WHERE branch_id = ?', [id]).catch(() => {})
    await query('DELETE FROM branch_materials WHERE branch_id = ?', [id]).catch(() => {})
    await query('DELETE FROM tenants WHERE id = ?', [id])

    try {
      await query(
        'INSERT INTO activity_logs (cashier_id, tenant_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
        [req.cashierId || null, req.tenantId || null, 'branch_delete', 'branch', id, JSON.stringify({ name: rows[0].name })]
      )
    } catch { /* noop */ }

    res.json({ success: true, message: `Cabang "${rows[0].name}" berhasil dihapus.` })
  } catch (err) {
    console.error('[BRANCH-DELETE] error:', err.message)
    res.status(500).json({ success: false, message: 'Gagal menghapus cabang: ' + err.message })
  }
})

// Terapkan perubahan paket ke companies + sinkron semua tenant di bawahnya. Dipakai
// oleh DUA jalur: (1) downgrade instan/gratis (POST /subscription/upgrade), dan
// (2) setelah pembayaran upgrade/perpanjangan lunas dikonfirmasi webhook Midtrans
// (POST /subscription/checkout). Tidak melakukan guard arah — pemanggil wajib sudah
// memvalidasi sebelum memanggil fungsi ini.
// extendMonths=0 → plan berubah tapi masa aktif TIDAK diperpanjang (dipakai saat
// downgrade gratis, supaya downgrade tidak diam-diam memberi tambahan masa aktif).
async function applyCompanyPlanChange(companyId, planNorm, extendMonths, meta = {}) {
  const companyRows = await query(
    'SELECT id, name, subscription_plan, subscription_expires_at, created_at FROM companies WHERE id = ? LIMIT 1',
    [companyId]
  )
  if (!companyRows.length) {
    const err = new Error('Perusahaan tidak ditemukan.')
    err.status = 404
    throw err
  }
  const co = companyRows[0]

  let newExpiry = co.subscription_expires_at ? new Date(co.subscription_expires_at) : null
  if (extendMonths > 0) {
    // Base perpanjangan: bila masih aktif, tambahkan dari tanggal berakhir berjalan;
    // bila sudah lewat/kosong, mulai dari sekarang.
    const currentEff = effectiveExpiry(co.subscription_plan, co.subscription_expires_at, co.created_at)
    const base = (currentEff && currentEff.getTime() > Date.now()) ? currentEff : new Date()
    newExpiry = new Date(base)
    newExpiry.setMonth(newExpiry.getMonth() + extendMonths)
  }

  await query(
    'UPDATE companies SET subscription_plan = ?, subscription_started_at = COALESCE(subscription_started_at, NOW()), subscription_expires_at = ? WHERE id = ?',
    [planNorm, newExpiry, companyId]
  )
  // Sinkron semua cabang ke paket perusahaan.
  await query('UPDATE tenants SET subscription_plan = ? WHERE company_id = ?', [planNorm, companyId])

  try {
    await query(
      'INSERT INTO activity_logs (cashier_id, tenant_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)',
      [
        meta.cashierId || null,
        meta.tenantId || null,
        meta.action || 'change_subscription',
        'subscription',
        companyId,
        JSON.stringify({ plan: planNorm, extend_months: extendMonths, expires_at: newExpiry, scope: 'company', via: meta.via || 'manual' })
      ]
    )
  } catch { /* log gagal tidak menggagalkan proses */ }

  return { company: co, newExpiry }
}

// Downgrade paket — GRATIS & INSTAN, hanya untuk pindah ke tier LEBIH RENDAH dari
// saat ini (tidak ada pembayaran, jadi tidak lewat Midtrans). Untuk upgrade atau
// perpanjangan paket berbayar, pakai POST /subscription/checkout.
router.post('/subscription/upgrade', async (req, res) => {
  if (String(req.callerRole || '').toLowerCase() !== 'owner') {
    return res.status(403).json({ success: false, error: 'Hanya pemilik (owner) yang dapat mengubah paket langganan.' });
  }
  const { plan } = req.body;
  const planNorm = String(plan || '').toLowerCase();
  const purchasablePlans = PLAN_CONFIG.filter((p) => p.rank > 0).map((p) => p.slug)
  if (!purchasablePlans.includes(planNorm)) {
    return res.status(400).json({ error: `Paket tidak valid. Pilih salah satu: ${purchasablePlans.join('/')}.` });
  }

  try {
    const companyRows = await query('SELECT subscription_plan FROM companies WHERE id = ? LIMIT 1', [req.companyId])
    if (!companyRows.length) return res.status(404).json({ error: 'Perusahaan tidak ditemukan.' })
    const currentPlan = companyRows[0].subscription_plan

    if (planRank(planNorm) >= planRank(currentPlan)) {
      return res.status(400).json({
        success: false,
        code: 'PAYMENT_REQUIRED',
        error: 'Upgrade atau perpanjangan paket berbayar wajib melalui pembayaran. Gunakan tombol Upgrade untuk checkout.'
      })
    }

    // Guard downgrade: pemakaian saat ini (jumlah cabang & staf per cabang) harus
    // masih muat di kuota paket baru yang lebih rendah itu.
    const targetBranchLimit = branchLimitFor(planNorm)
    const targetCashierLimit = cashierLimitFor(planNorm)

    const [{ branchCount }] = await query('SELECT COUNT(*) AS branchCount FROM tenants WHERE company_id = ?', [req.companyId])
    if (targetBranchLimit !== null && branchCount > targetBranchLimit) {
      return res.status(400).json({
        success: false,
        code: 'DOWNGRADE_BLOCKED_BRANCHES',
        error: `Tidak bisa downgrade ke ${planLabel(planNorm)}: Anda punya ${branchCount} cabang, paket ini hanya mengizinkan ${targetBranchLimit}. Nonaktifkan/hapus cabang berlebih terlebih dahulu.`
      })
    }

    if (targetCashierLimit !== null) {
      const overLimitTenants = await query(
        `SELECT t.name, COUNT(c.id) AS cnt FROM tenants t LEFT JOIN cashiers c ON c.tenant_id = t.id
         WHERE t.company_id = ? GROUP BY t.id HAVING cnt > ? LIMIT 1`,
        [req.companyId, targetCashierLimit]
      )
      if (overLimitTenants.length) {
        return res.status(400).json({
          success: false,
          code: 'DOWNGRADE_BLOCKED_STAFF',
          error: `Tidak bisa downgrade ke ${planLabel(planNorm)}: cabang "${overLimitTenants[0].name}" punya lebih dari ${targetCashierLimit} akun staf. Kurangi jumlah staf terlebih dahulu.`
        })
      }
    }

    const { newExpiry } = await applyCompanyPlanChange(req.companyId, planNorm, 0, {
      cashierId: req.cashierId, tenantId: req.tenantId, action: 'downgrade_subscription', via: 'manual'
    })

    res.json({
      success: true,
      message: `Paket berhasil diturunkan ke ${planLabel(planNorm)}.`,
      data: { plan: planNorm, expires_at: newExpiry }
    });
  } catch (err) {
    console.error('Downgrade subscription error:', err);
    res.status(err.status || 500).json({ error: err.message });
  }
})

// Checkout upgrade/perpanjangan paket BERBAYAR via Midtrans Snap. Membuat transaksi
// Snap (token dipakai frontend utk buka popup pembayaran); paket baru BARU diterapkan
// setelah pembayaran lunas dikonfirmasi lewat webhook (lihat /payments/midtrans/webhook).
router.post('/subscription/checkout', async (req, res) => {
  if (String(req.callerRole || '').toLowerCase() !== 'owner') {
    return res.status(403).json({ success: false, error: 'Hanya pemilik (owner) yang dapat mengubah paket langganan.' });
  }
  if (!process.env.MIDTRANS_SERVER_KEY) {
    return res.status(500).json({ error: 'MIDTRANS_SERVER_KEY belum diset di server.' })
  }
  const { plan, months } = req.body;
  const planNorm = String(plan || '').toLowerCase();
  const dur = Number(months);
  const purchasablePlans = PLAN_CONFIG.filter((p) => p.rank > 0).map((p) => p.slug)
  if (!purchasablePlans.includes(planNorm) || !Number.isInteger(dur) || dur <= 0 || dur > 60) {
    return res.status(400).json({ error: `Paket (${purchasablePlans.join('/')}) dan durasi (1–60 bulan) wajib valid.` });
  }

  try {
    const companyRows = await query('SELECT id, name, subscription_plan FROM companies WHERE id = ? LIMIT 1', [req.companyId])
    if (!companyRows.length) return res.status(404).json({ error: 'Perusahaan tidak ditemukan.' })
    const co = companyRows[0]

    if (planRank(planNorm) < planRank(co.subscription_plan)) {
      return res.status(400).json({
        success: false,
        error: 'Ini menurunkan paket — gunakan jalur downgrade gratis, bukan checkout pembayaran.'
      })
    }

    // Harga ditentukan SERVER, bukan dari input client — cegah manipulasi nominal bayar.
    const unitPrice = monthlyPriceFor(planNorm)
    const amount = unitPrice * dur
    if (!(amount > 0)) {
      return res.status(400).json({ error: 'Paket ini tidak memiliki harga berbayar.' })
    }

    const cashierRows = await query('SELECT name, email FROM cashiers WHERE id = ? LIMIT 1', [req.cashierId])
    const owner = cashierRows[0] || {}
    const midtransOrderId = `SUB-${req.companyId}-${Date.now()}`

    await query(
      'INSERT INTO subscription_payments (company_id, plan, months, amount, midtrans_order_id, status) VALUES (?, ?, ?, ?, ?, ?)',
      [req.companyId, planNorm, dur, amount, midtransOrderId, 'pending']
    )

    const snapPayload = {
      transaction_details: { order_id: midtransOrderId, gross_amount: amount },
      item_details: [{
        id: planNorm,
        price: unitPrice,
        quantity: dur,
        name: `Paket ${planLabel(planNorm)} (${dur} bulan)`.slice(0, 50),
      }],
      customer_details: {
        first_name: (owner.name || co.name || 'Owner').slice(0, 50),
        email: owner.email || undefined,
      },
    }

    const snapRes = await fetch(`${midtransSnapBaseUrl()}/snap/v1/transactions`, {
      method: 'POST',
      headers: {
        Authorization: midtransAuthHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(snapPayload),
    })
    const snapBody = await snapRes.json()
    if (!snapRes.ok || !snapBody.token) {
      await query('UPDATE subscription_payments SET status = ? WHERE midtrans_order_id = ?', ['failed', midtransOrderId])
      const midtransMessage = Array.isArray(snapBody?.status_message) ? snapBody.status_message.join(', ') : snapBody?.status_message
      return res.status(502).json({ error: midtransMessage || 'Gagal membuat transaksi Midtrans.', details: snapBody })
    }

    await query('UPDATE subscription_payments SET snap_token = ? WHERE midtrans_order_id = ?', [snapBody.token, midtransOrderId])

    res.status(201).json({
      success: true,
      paymentReference: midtransOrderId,
      token: snapBody.token,
      redirectUrl: snapBody.redirect_url,
      amount,
    })
  } catch (err) {
    console.error('Subscription checkout error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Polling fallback status pembayaran checkout paket (jaga-jaga webhook telat/gagal terkirim).
router.get('/subscription/checkout/:reference/status', async (req, res) => {
  const reference = req.params.reference
  try {
    const rows = await query(
      'SELECT id, company_id, plan, months, status FROM subscription_payments WHERE midtrans_order_id = ? AND company_id = ? LIMIT 1',
      [reference, req.companyId]
    )
    if (!rows.length) return res.status(404).json({ error: 'Transaksi tidak ditemukan.' })
    let payment = rows[0]

    if (payment.status === 'pending' && process.env.MIDTRANS_SERVER_KEY) {
      const statusRes = await fetch(`${midtransBaseUrl()}/v2/${encodeURIComponent(reference)}/status`, {
        headers: { Authorization: midtransAuthHeader(), Accept: 'application/json' },
      })
      const statusPayload = await statusRes.json()
      if (statusRes.ok) {
        const transactionStatus = statusPayload.transaction_status
        const fraudStatus = statusPayload.fraud_status
        if ((transactionStatus === 'settlement') || (transactionStatus === 'capture' && fraudStatus === 'accept')) {
          await applyCompanyPlanChange(payment.company_id, payment.plan, payment.months, { action: 'upgrade_subscription', via: 'midtrans_poll' })
          await query('UPDATE subscription_payments SET status = ?, paid_at = NOW() WHERE id = ?', ['paid', payment.id])
          payment = { ...payment, status: 'paid' }
        } else if (['expire', 'cancel', 'deny', 'failure'].includes(transactionStatus)) {
          await query('UPDATE subscription_payments SET status = ? WHERE id = ?', [transactionStatus === 'expire' ? 'expired' : 'cancelled', payment.id])
          payment = { ...payment, status: transactionStatus === 'expire' ? 'expired' : 'cancelled' }
        }
      }
    }

    res.json({ success: true, status: payment.status, plan: payment.plan })
  } catch (err) {
    console.error('Subscription status poll error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.get('/activity-logs', requireTenant, async (req, res) => {
  const isCompanyScope = req.query.scope === 'company'
  const { startDate, endDate, cashierId, action, entity, limit = 200 } = req.query
  try {
    let sql = `
      SELECT al.id, al.cashier_id AS cashierId, c.name AS cashierName, 
             al.action, al.entity, al.entity_id AS entityId, 
             al.details, al.created_at AS createdAt, t.name AS tenantName 
      FROM activity_logs al 
      LEFT JOIN cashiers c ON al.cashier_id = c.id 
      LEFT JOIN tenants t ON al.tenant_id = t.id
    `
    const params = []
    if (isCompanyScope) {
      sql += ' WHERE t.company_id = ?'
      params.push(req.companyId)
    } else {
      sql += ' WHERE al.tenant_id = ?'
      params.push(req.tenantId)
    }

    if (startDate) {
      sql += ' AND DATE(al.created_at) >= ?'
      params.push(startDate)
    }
    if (endDate) {
      sql += ' AND DATE(al.created_at) <= ?'
      params.push(endDate)
    }
    if (cashierId) {
      sql += ' AND al.cashier_id = ?'
      params.push(Number(cashierId))
    }
    if (action) {
      sql += ' AND al.action = ?'
      params.push(action)
    }
    if (entity) {
      sql += ' AND al.entity = ?'
      params.push(entity)
    }

    sql += ' ORDER BY al.created_at DESC LIMIT ?'
    params.push(Math.min(Number(limit) || 200, 1000))

    const rows = await query(sql, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


// ===== VOUCHER ROUTES =====
router.get('/vouchers', async (req, res) => {
  const isCompanyScope = req.query.scope === 'company'
  try {
    let sql = `
      SELECT v.id, v.code, v.description, v.discount_type AS discountType, 
             v.discount_value AS discountValue, v.min_order_amount AS minOrderAmount, 
             v.max_discount_amount AS maxDiscountAmount, v.expiry_date AS expiryDate, 
             v.usage_limit AS usageLimit, v.used_count AS usedCount, 
             v.is_active AS isActive, v.tenant_id AS tenantId, t.name AS tenantName 
      FROM vouchers v
      LEFT JOIN tenants t ON v.tenant_id = t.id
    `
    const params = []
    if (isCompanyScope) {
      sql += ' WHERE t.company_id = ?'
      params.push(req.companyId)
    } else {
      sql += ' WHERE v.tenant_id = ?'
      params.push(req.tenantId)
    }
    sql += ' ORDER BY v.created_at DESC'
    const rows = await query(sql, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/vouchers/validate/:code', async (req, res) => {
  const code = String(req.params.code).trim().toUpperCase()
  try {
    const rows = await query(
      `SELECT id, code, discount_type AS discountType, discount_value AS discountValue,
              min_order_amount AS minOrderAmount, max_discount_amount AS maxDiscountAmount,
              expiry_date AS expiryDate, usage_limit AS usageLimit, used_count AS usedCount, is_active AS isActive
       FROM vouchers 
       WHERE LOWER(code) = LOWER(?) AND tenant_id = ? LIMIT 1`,
      [code, req.tenantId]
    )
    if (rows.length === 0) {
      return res.status(200).json({ valid: false, message: 'Voucher tidak ditemukan' })
    }
    const v = rows[0]
    if (!v.isActive) {
      return res.status(200).json({ valid: false, message: 'Voucher sudah tidak aktif' })
    }
    if (v.expiryDate && new Date(v.expiryDate) < new Date()) {
      return res.status(200).json({ valid: false, message: 'Voucher sudah kedaluwarsa' })
    }
    if (v.usageLimit && v.usedCount >= v.usageLimit) {
      return res.status(200).json({ valid: false, message: 'Batas kuota penggunaan voucher telah habis' })
    }
    res.json({ valid: true, voucher: v })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/vouchers', async (req, res) => {
  const { 
    code, description, discount_type, discount_value, 
    min_order_amount, max_discount_amount, expiry_date, usage_limit 
  } = req.body || {}
  
  if (!code || !discount_type || discount_value === undefined) {
    return res.status(400).json({ error: 'code, discount_type, dan discount_value wajib diisi' })
  }

  try {
    const result = await query(
      `INSERT INTO vouchers (
        code, description, discount_type, discount_value, 
        min_order_amount, max_discount_amount, expiry_date, usage_limit, tenant_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        code.trim().toUpperCase(),
        description || null,
        discount_type,
        Number(discount_value),
        min_order_amount ? Number(min_order_amount) : 0,
        max_discount_amount ? Number(max_discount_amount) : null,
        expiry_date || null,
        usage_limit ? Number(usage_limit) : null,
        req.tenantId
      ]
    )
    await logActivity(req, 'create', 'voucher', result.insertId, { code })
    res.status(201).json({ id: result.insertId })
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Kode voucher sudah ada di cabang ini' })
    }
    res.status(500).json({ error: err.message })
  }
})

router.put('/vouchers/:id', async (req, res) => {
  const voucherId = req.params.id
  const { 
    code, description, discount_type, discount_value, 
    min_order_amount, max_discount_amount, expiry_date, usage_limit, is_active 
  } = req.body || {}

  if (!code || !discount_type || discount_value === undefined) {
    return res.status(400).json({ error: 'code, discount_type, dan discount_value wajib diisi' })
  }

  try {
    await query(
      `UPDATE vouchers SET 
         code = ?, description = ?, discount_type = ?, discount_value = ?, 
         min_order_amount = ?, max_discount_amount = ?, expiry_date = ?, 
         usage_limit = ?, is_active = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        code.trim().toUpperCase(),
        description || null,
        discount_type,
        Number(discount_value),
        min_order_amount ? Number(min_order_amount) : 0,
        max_discount_amount ? Number(max_discount_amount) : null,
        expiry_date || null,
        usage_limit ? Number(usage_limit) : null,
        is_active !== undefined ? Number(is_active) : 1,
        Number(voucherId),
        req.tenantId
      ]
    )
    await logActivity(req, 'update', 'voucher', voucherId, { code })
    res.json({ id: voucherId })
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Kode voucher sudah ada di cabang ini' })
    }
    res.status(500).json({ error: err.message })
  }
})

router.delete('/vouchers/:id', async (req, res) => {
  const voucherId = req.params.id
  try {
    await query('DELETE FROM vouchers WHERE id = ? AND tenant_id = ?', [Number(voucherId), req.tenantId])
    await logActivity(req, 'delete', 'voucher', voucherId, null)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ===== EXPENSES ROUTES =====
router.get('/expenses', async (req, res) => {
  const isCompanyScope = req.query.scope === 'company'
  try {
    let sql = `
      SELECT e.id, e.category, e.description, e.amount, e.created_at AS createdAt, 
             e.tenant_id AS tenantId, t.name AS tenantName 
      FROM expenses e
      LEFT JOIN tenants t ON e.tenant_id = t.id
    `
    const params = []
    if (isCompanyScope) {
      sql += ' WHERE t.company_id = ?'
      params.push(req.companyId)
    } else {
      sql += ' WHERE e.tenant_id = ?'
      params.push(req.tenantId)
    }
    sql += ' ORDER BY e.created_at DESC'
    const rows = await query(sql, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/expenses', async (req, res) => {
  const { category, description, amount } = req.body || {}
  
  if (!category || !description || amount === undefined) {
    return res.status(400).json({ error: 'category, description, dan amount wajib diisi' })
  }

  try {
    const result = await query(
      'INSERT INTO expenses (category, description, amount, tenant_id) VALUES (?, ?, ?, ?)',
      [category.trim(), description.trim(), Number(amount), req.tenantId]
    )
    await logActivity(req, 'create', 'expense', result.insertId, { category, amount: Number(amount) })
    res.status(201).json({ id: result.insertId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/expenses/:id', async (req, res) => {
  const expenseId = req.params.id
  const { category, description, amount } = req.body || {}

  if (!category || !description || amount === undefined) {
    return res.status(400).json({ error: 'category, description, dan amount wajib diisi' })
  }

  try {
    await query(
      'UPDATE expenses SET category = ?, description = ?, amount = ? WHERE id = ? AND tenant_id = ?',
      [category.trim(), description.trim(), Number(amount), Number(expenseId), req.tenantId]
    )
    await logActivity(req, 'update', 'expense', expenseId, { category, amount: Number(amount) })
    res.json({ id: expenseId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/expenses/:id', async (req, res) => {
  const expenseId = req.params.id
  try {
    await query('DELETE FROM expenses WHERE id = ? AND tenant_id = ?', [Number(expenseId), req.tenantId])
    await logActivity(req, 'delete', 'expense', expenseId, null)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/menu', async (req, res) => {
  console.log('[GET /menu] masuk handler')
  try {
    const rows = await query(
      `SELECT mi.id, mi.name,
              COALESCE(bmi.price_override, mi.price) AS price,
              COALESCE((
                SELECT SUM(pm.qty * m.price)
                FROM product_materials pm
                JOIN materials m ON pm.material_id = m.id
                WHERE pm.menu_item_id = mi.id AND m.company_id = mi.company_id
              ), 0) AS costPrice,
              mi.category, mi.tag, mi.image_url AS imageUrl, mi.materials,
              mi.discount_price AS discountPrice,
              mi.product_type AS type, mi.unit_label AS unitLabel,
              COALESCE(bsi.stock, 0) AS stock, COALESCE(bsi.stock_min, 0) AS stockMin
       FROM menu_items mi
       LEFT JOIN branch_menu_items bmi ON mi.id = bmi.menu_item_id AND bmi.branch_id = ?
       LEFT JOIN branch_stock_items bsi ON mi.id = bsi.menu_item_id AND bsi.branch_id = ?
       WHERE mi.is_active=1 AND mi.company_id=?
         AND (bmi.is_available IS NULL OR bmi.is_available = 1)
       ORDER BY mi.name`,
       [req.tenantId, req.tenantId, req.companyId]
    )
    res.json(rows)
    console.log('[GET /menu] sukses')
  } catch (err) {
    console.error('[GET /menu] error:', err)
    res.status(500).json({ error: err.message })
  }
})

// Flattened recipe rows (menu item x material x live stock) for client-side stock gating in Kasir
router.get('/menu/recipes', async (req, res) => {
  try {
    const rows = await query(
      `SELECT pm.id, pm.menu_item_id AS menuItemId, pm.material_id AS materialId, pm.qty,
              m.name AS materialName, m.unit,
              COALESCE(bm.stock, 0) AS stock, COALESCE(bm.stock_min, 0) AS stockMin
       FROM product_materials pm
       JOIN menu_items mi ON mi.id = pm.menu_item_id
       JOIN materials m ON pm.material_id = m.id
       LEFT JOIN branch_materials bm ON m.id = bm.material_id AND bm.branch_id = ?
       WHERE mi.company_id = ? AND m.company_id = mi.company_id AND mi.is_active = 1`,
      [req.tenantId, req.companyId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/items', async (req, res) => {
  try {
    const rows = await query(
      `SELECT mi.id, mi.name,
              COALESCE(bmi.price_override, mi.price) AS price,
              mi.price AS basePrice,
              COALESCE((
                SELECT SUM(pm.qty * m.price)
                FROM product_materials pm
                JOIN materials m ON pm.material_id = m.id
                WHERE pm.menu_item_id = mi.id AND m.company_id = mi.company_id
              ), 0) AS costPrice,
              mi.category, mi.tag, mi.image_url AS imageUrl, mi.materials,
              COALESCE(bmi.is_available, 1) AS isAvailableInBranch,
              bmi.price_override AS branchPriceOverride,
              mi.discount_price AS discountPrice,
              mi.product_type AS type, mi.unit_label AS unitLabel,
              COALESCE(bsi.stock, 0) AS stock, COALESCE(bsi.stock_min, 0) AS stockMin
       FROM menu_items mi
       LEFT JOIN branch_menu_items bmi ON mi.id = bmi.menu_item_id AND bmi.branch_id = ?
       LEFT JOIN branch_stock_items bsi ON mi.id = bsi.menu_item_id AND bsi.branch_id = ?
       WHERE mi.is_active=1 AND mi.company_id=?
       ORDER BY mi.name`,
      [req.tenantId, req.tenantId, req.companyId]
    )
    
    // Load bahan baku untuk setiap item
    const itemsWithMaterials = await Promise.all(
      rows.map(async (item) => {
        const materials = await query(
          `SELECT pm.id, pm.material_id AS materialId, pm.qty, m.name, m.unit 
           FROM product_materials pm 
           JOIN materials m ON pm.material_id = m.id 
           WHERE pm.menu_item_id=? AND m.company_id=?
           ORDER BY m.name`,
          [item.id, req.companyId]
        )
        return {
          ...item,
          productMaterials: materials.length > 0 ? materials : null
        }
      })
    )
    
    res.json(itemsWithMaterials)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/items/archived', async (req, res) => {
  try {
    const rows = await query(
      `SELECT mi.id, mi.name,
              COALESCE(bmi.price_override, mi.price) AS price,
              mi.price AS basePrice,
              COALESCE((
                SELECT SUM(pm.qty * m.price)
                FROM product_materials pm
                JOIN materials m ON pm.material_id = m.id
                WHERE pm.menu_item_id = mi.id AND m.company_id = mi.company_id
              ), 0) AS costPrice,
              mi.category, mi.tag, mi.image_url AS imageUrl, mi.materials,
              COALESCE(bmi.is_available, 1) AS isAvailableInBranch,
              bmi.price_override AS branchPriceOverride,
              mi.product_type AS type, mi.unit_label AS unitLabel,
              COALESCE(bsi.stock, 0) AS stock, COALESCE(bsi.stock_min, 0) AS stockMin
       FROM menu_items mi
       LEFT JOIN branch_menu_items bmi ON mi.id = bmi.menu_item_id AND bmi.branch_id = ?
       LEFT JOIN branch_stock_items bsi ON mi.id = bsi.menu_item_id AND bsi.branch_id = ?
       WHERE mi.is_active=0 AND mi.company_id=?
       ORDER BY mi.name`,
      [req.tenantId, req.tenantId, req.companyId]
    )
    
    // Load bahan baku untuk setiap item
    const itemsWithMaterials = await Promise.all(
      rows.map(async (item) => {
        const materials = await query(
          `SELECT pm.id, pm.material_id AS materialId, pm.qty, m.name, m.unit 
           FROM product_materials pm 
           JOIN materials m ON pm.material_id = m.id 
           WHERE pm.menu_item_id=? AND m.company_id=?
           ORDER BY m.name`,
          [item.id, req.companyId]
        )
        return {
          ...item,
          productMaterials: materials.length > 0 ? materials : null
        }
      })
    )
    
    res.json(itemsWithMaterials)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

const VALID_PRODUCT_TYPES = ['recipe', 'stock', 'service']

router.post('/items', checkProductLimit, async (req, res) => {
  const { id, name, price, costPrice, category, tag, imageUrl, materials, discountPrice, type, unitLabel } = req.body || {}
  if (!id || !name || !price) return res.status(400).json({ error: 'id, name, price wajib diisi' })
  const productType = VALID_PRODUCT_TYPES.includes(type) ? type : 'recipe'

  try {
    await query(
      'INSERT INTO menu_items (id, name, price, cost_price, category, tag, image_url, materials, tenant_id, company_id, discount_price, product_type, unit_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), price=VALUES(price), cost_price=VALUES(cost_price), category=VALUES(category), tag=VALUES(tag), image_url=VALUES(image_url), materials=VALUES(materials), discount_price=VALUES(discount_price), product_type=VALUES(product_type), unit_label=VALUES(unit_label)',
      [
        id,
        name,
        Number(price),
        costPrice === '' || costPrice === undefined ? null : Number(costPrice),
        category || null,
        tag || null,
        imageUrl || null,
        materials || null,
        req.tenantId,
        req.companyId,
        discountPrice === '' || discountPrice === undefined || discountPrice === null ? null : Number(discountPrice),
        productType,
        unitLabel || null,
      ],
    )
    await logActivity(req, 'upsert', 'item', id, { name, price: Number(price), costPrice: costPrice === '' || costPrice === undefined ? null : Number(costPrice), category, tag, type: productType })
    res.status(201).json({ id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/items/:id', async (req, res) => {
  const itemId = req.params.id
  const { name, price, costPrice, category, tag, imageUrl, materials, discountPrice, type, unitLabel } = req.body || {}
  if (!name || !price) return res.status(400).json({ error: 'name, price wajib diisi' })
  const productType = VALID_PRODUCT_TYPES.includes(type) ? type : 'recipe'

  try {
    await query(
      'UPDATE menu_items SET name=?, price=?, cost_price=?, category=?, tag=?, image_url=?, materials=?, discount_price=?, product_type=?, unit_label=? WHERE id=? AND company_id=?',
      [
        name,
        Number(price),
        costPrice === '' || costPrice === undefined ? null : Number(costPrice),
        category || null,
        tag || null,
        imageUrl || null,
        materials || null,
        discountPrice === '' || discountPrice === undefined || discountPrice === null ? null : Number(discountPrice),
        productType,
        unitLabel || null,
        itemId,
        req.companyId,
      ],
    )
    await logActivity(req, 'update', 'item', itemId, { name, price: Number(price), costPrice: costPrice === '' || costPrice === undefined ? null : Number(costPrice), category, tag, type: productType })
    res.json({ id: itemId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/items/:id', async (req, res) => {
  const itemId = req.params.id
  try {
    // Soft-delete: tandai tidak aktif agar riwayat transaksi tetap utuh
    const result = await query('UPDATE menu_items SET is_active=0 WHERE id=? AND company_id=?', [itemId, req.companyId])
    const affected = result?.affectedRows ?? 0
    if (affected === 0) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' })
    }
    await logActivity(req, 'archive', 'item', itemId, null)
    res.json({ success: true, archived: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/items/:id/restore', async (req, res) => {
  const itemId = req.params.id
  try {
    const result = await query('UPDATE menu_items SET is_active=1 WHERE id=? AND company_id=?', [itemId, req.companyId])
    const affected = result?.affectedRows ?? 0
    if (affected === 0) {
      return res.status(404).json({ error: 'Produk tidak ditemukan' })
    }
    await logActivity(req, 'restore', 'item', itemId, null)
    res.json({ success: true, restored: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/items/:id/variants', async (req, res) => {
  const itemId = req.params.id
  try {
    const rows = await query('SELECT v.id, v.name, v.price, v.description FROM variants v JOIN menu_items mi ON mi.id = v.menu_item_id WHERE v.menu_item_id=? AND mi.company_id=? ORDER BY v.name', [itemId, req.companyId])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/items/:id/variants', async (req, res) => {
  const itemId = req.params.id
  const { name, price, description } = req.body || {}
  if (!name || !price) return res.status(400).json({ error: 'name, price wajib diisi' })

  try {
    const itemRows = await query('SELECT id FROM menu_items WHERE id=? AND company_id=? LIMIT 1', [itemId, req.companyId])
    if (!itemRows.length) return res.status(404).json({ error: 'Produk tidak ditemukan' })
    const result = await query(
      'INSERT INTO variants (menu_item_id, name, price, description) VALUES (?, ?, ?, ?)',
      [itemId, name, Number(price), description || null],
    )
    await logActivity(req, 'create', 'variant', result.insertId, { itemId, name, price: Number(price) })
    res.status(201).json({ id: result.insertId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/items/:id/variants/:variantId', async (req, res) => {
  const { id, variantId } = req.params
  const { name, price, description } = req.body || {}
  if (!name || !price) return res.status(400).json({ error: 'name, price wajib diisi' })

  try {
    await query(
      `UPDATE variants v
       JOIN menu_items mi ON mi.id = v.menu_item_id
       SET v.name=?, v.price=?, v.description=?
       WHERE v.id=? AND v.menu_item_id=? AND mi.company_id=?`,
      [name, Number(price), description || null, Number(variantId), id, req.companyId]
    )
    await logActivity(req, 'update', 'variant', variantId, { itemId: id, name, price: Number(price) })
    res.json({ id: variantId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/items/:id/variants/:variantId', async (req, res) => {
  const { id, variantId } = req.params
  try {
    await query(
      `DELETE v FROM variants v
       JOIN menu_items mi ON mi.id = v.menu_item_id
       WHERE v.id=? AND v.menu_item_id=? AND mi.company_id=?`,
      [Number(variantId), id, req.companyId]
    )
    await logActivity(req, 'delete', 'variant', variantId, { itemId: id })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Endpoint untuk mengatur ketersediaan & harga khusus menu di cabang tertentu
router.post('/items/branch-status', async (req, res) => {
  const { menu_item_id, is_available, price_override } = req.body || {}
  if (!menu_item_id) return res.status(400).json({ error: 'menu_item_id wajib diisi' })

  try {
    await query(
      `INSERT INTO branch_menu_items (branch_id, menu_item_id, is_available, price_override)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         is_available = COALESCE(VALUES(is_available), is_available),
         price_override = VALUES(price_override)`,
      [
        req.tenantId,
        menu_item_id,
        is_available !== undefined ? Number(is_available) : 1,
        price_override !== undefined && price_override !== '' ? Number(price_override) : null
      ]
    )
    res.json({ success: true, message: 'Status menu cabang berhasil diperbarui' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ===== MATERIALS MASTER ROUTES =====
router.get('/materials/central-stock', async (req, res) => {
  try {
    const branches = await query('SELECT id, name FROM tenants WHERE company_id = ? ORDER BY name', [req.companyId])
    const materials = await query('SELECT id, name, unit, price FROM materials WHERE company_id = ? ORDER BY name', [req.companyId])
    const stocks = await query(
      `SELECT bm.material_id, bm.branch_id, bm.stock, bm.stock_min 
       FROM branch_materials bm
       JOIN tenants t ON bm.branch_id = t.id
       WHERE t.company_id = ?`,
      [req.companyId]
    )
    res.json({ branches, materials, stocks })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/materials', async (req, res) => {
  try {
    const rows = await query(
      `SELECT m.id, m.name, m.unit, m.price, 
              COALESCE(bm.stock, 0) AS stock, 
              COALESCE(bm.stock_min, 0) AS stock_min, 
              (m.price * COALESCE(bm.stock, 0)) AS saldo 
       FROM materials m
       LEFT JOIN branch_materials bm ON m.id = bm.material_id AND bm.branch_id = ?
       WHERE m.company_id = ? 
       ORDER BY m.name`,
      [req.tenantId, req.companyId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/materials', async (req, res) => {
  const rawName = (req.body?.name || '').trim()
  const rawUnit = (req.body?.unit || '').trim()
  if (!rawName || !rawUnit) return res.status(400).json({ error: 'name, unit wajib diisi' })

  try {
    const result = await query(
      'INSERT INTO materials (name, unit, company_id) VALUES (?, ?, ?)',
      [rawName, rawUnit, req.companyId],
    )
    await logActivity(req, 'create', 'material', result.insertId, { name: rawName, unit: rawUnit })
    res.status(201).json({ id: result.insertId })
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Bahan baku sudah ada, gunakan nama lain' })
    }
    res.status(500).json({ error: err.message })
  }
})

router.put('/materials/:id', async (req, res) => {
  const materialId = req.params.id
  const rawName = (req.body?.name || '').trim()
  const rawUnit = (req.body?.unit || '').trim()
  if (!rawName || !rawUnit) return res.status(400).json({ error: 'name, unit wajib diisi' })

  try {
    await query('UPDATE materials SET name=?, unit=? WHERE id=? AND company_id=?', [rawName, rawUnit, Number(materialId), req.companyId])
    await logActivity(req, 'update', 'material', materialId, { name: rawName, unit: rawUnit })
    res.json({ id: materialId })
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Bahan baku sudah ada, gunakan nama lain' })
    }
    res.status(500).json({ error: err.message })
  }
})

router.delete('/materials/:id', async (req, res) => {
  const materialId = req.params.id
  try {
    await query('DELETE FROM materials WHERE id=? AND company_id=?', [Number(materialId), req.companyId])
    await logActivity(req, 'delete', 'material', materialId, null)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update stock material
router.post('/materials/:id/stock', async (req, res) => {
  const materialId = req.params.id
  const { qty, type = 'add', notes = '' } = req.body || {}
  
  if (qty === undefined || qty === null) {
    return res.status(400).json({ error: 'qty wajib diisi' })
  }

  try {
    const qtyNum = Number(qty)
    if (isNaN(qtyNum)) {
      return res.status(400).json({ error: 'qty harus berupa angka' })
    }

    // Get current stock from branch_materials
    const current = await query(
      `SELECT COALESCE(bm.stock, 0) AS stock, COALESCE(bm.stock_min, 0) AS stock_min, m.name, m.unit
       FROM materials m
       LEFT JOIN branch_materials bm ON m.id = bm.material_id AND bm.branch_id = ?
       WHERE m.id = ? AND m.company_id = ?`,
      [req.tenantId, Number(materialId), req.companyId]
    )
    if (current.length === 0) {
      return res.status(404).json({ error: 'Material tidak ditemukan' })
    }

    const currentStock = Number(current[0].stock || 0)
    const stockMin = Number(current[0].stock_min || 0)
    let newStock = currentStock

    if (type === 'add') {
      newStock = currentStock + qtyNum
    } else if (type === 'subtract') {
      newStock = currentStock - qtyNum
      if (newStock < 0) {
        return res.status(400).json({ error: 'Stok tidak boleh negatif' })
      }
    } else if (type === 'set') {
      newStock = qtyNum
    } else {
      return res.status(400).json({ error: 'type harus add, subtract, atau set' })
    }

    // Update or Insert stock into branch_materials
    await query(
      `INSERT INTO branch_materials (branch_id, material_id, stock)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE stock = VALUES(stock)`,
      [req.tenantId, Number(materialId), newStock]
    )

    await logActivity(req, 'adjust_stock', 'material', materialId, {
      type,
      qty: qtyNum,
      oldStock: currentStock,
      newStock
    })

    if (crossedLowStockThreshold(currentStock, newStock, stockMin)) {
      await notifyLowStock({
        companyId: req.companyId,
        branchId: req.tenantId,
        materialName: current[0].name,
        unit: current[0].unit,
        newStock,
        stockMin,
      })
    }

    res.json({
      id: materialId,
      oldStock: currentStock,
      newStock: newStock,
      qty: qtyNum,
      type: type
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Material masuk (restok)
router.post('/materials/:id/in', async (req, res) => {
  const materialId = req.params.id
  const { qty, notes = '', price = 0 } = req.body || {}
  
  if (qty === undefined || qty === null || isNaN(Number(qty))) {
    return res.status(400).json({ error: 'qty harus berupa angka' })
  }

  try {
    const qtyNum = Number(qty)
    const priceNum = Number(price) || 0

    // Verify material exists
    const mRows = await query('SELECT name FROM materials WHERE id=? AND company_id=?', [Number(materialId), req.companyId])
    if (!mRows.length) return res.status(404).json({ error: 'Material tidak ditemukan' })
    
    // Update or Insert stock in branch_materials
    await query(
      `INSERT INTO branch_materials (branch_id, material_id, stock)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE stock = stock + VALUES(stock)`,
      [req.tenantId, Number(materialId), qtyNum]
    )

    // Update global catalog price if provided
    if (priceNum > 0) {
      await query('UPDATE materials SET price = ? WHERE id = ?', [priceNum, Number(materialId)])
    }
    
    // Log movement with price
    await query(
      'INSERT INTO material_movements (material_id, type, qty, price, notes) VALUES (?, ?, ?, ?, ?)',
      [Number(materialId), 'in', qtyNum, priceNum, notes || 'Restok bahan baku']
    )
    await logActivity(req, 'restock', 'material', materialId, {
      qty: qtyNum,
      price: priceNum,
      notes: notes || 'Restok bahan baku'
    })
    
    res.status(201).json({ 
      id: materialId, 
      qty: qtyNum,
      price: priceNum,
      type: 'in',
      notes: notes || 'Restok bahan baku'
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update stock minimum
router.put('/materials/:id/stock-min', async (req, res) => {
  const materialId = req.params.id
  const { stockMin } = req.body || {}
  
  if (stockMin === undefined || stockMin === null) {
    return res.status(400).json({ error: 'stockMin wajib diisi' })
  }

  try {
    const stockMinNum = Number(stockMin)
    if (isNaN(stockMinNum) || stockMinNum < 0) {
      return res.status(400).json({ error: 'stockMin harus berupa angka positif' })
    }

    // Verify material exists
    const mRows = await query('SELECT name FROM materials WHERE id=? AND company_id=?', [Number(materialId), req.companyId])
    if (!mRows.length) return res.status(404).json({ error: 'Material tidak ditemukan' })

    // Update or Insert stock_min in branch_materials
    await query(
      `INSERT INTO branch_materials (branch_id, material_id, stock_min)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE stock_min = VALUES(stock_min)`,
      [req.tenantId, Number(materialId), stockMinNum]
    )

    await logActivity(req, 'update_stock_min', 'material', materialId, { stockMin: stockMinNum })
    res.json({ id: materialId, stockMin: stockMinNum })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ===== PRODUCT MATERIALS ROUTES =====
router.get('/items/:id/materials', async (req, res) => {
  const itemId = req.params.id
  try {
    const rows = await query(
      `SELECT pm.id, pm.material_id AS materialId, pm.qty, m.name, m.unit 
       FROM product_materials pm 
       JOIN materials m ON pm.material_id = m.id 
       WHERE pm.menu_item_id=? AND m.company_id=?
       ORDER BY m.name`,
      [itemId, req.companyId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/items/:id/materials', async (req, res) => {
  const itemId = req.params.id
  const { materials } = req.body || {}
  if (!Array.isArray(materials)) return res.status(400).json({ error: 'materials harus array' })

  try {
    // Delete existing materials for this product
    const itemRows = await query('SELECT id FROM menu_items WHERE id=? AND company_id=? LIMIT 1', [itemId, req.companyId])
    if (!itemRows.length) return res.status(404).json({ error: 'Produk tidak ditemukan' })

    await query('DELETE pm FROM product_materials pm JOIN materials m ON m.id = pm.material_id WHERE pm.menu_item_id=? AND m.company_id=?', [itemId, req.companyId])
    
    // Insert new materials
    for (const mat of materials) {
      if (mat.materialId && mat.qty) {
        const materialRows = await query('SELECT id FROM materials WHERE id=? AND company_id=? LIMIT 1', [Number(mat.materialId), req.companyId])
        if (!materialRows.length) continue
        await query(
          'INSERT INTO product_materials (menu_item_id, material_id, qty) VALUES (?, ?, ?)',
          [itemId, Number(mat.materialId), Number(mat.qty)]
        )
      }
    }
    await logActivity(req, 'update', 'product_materials', itemId, { count: materials.length })

    res.status(201).json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update stock for a 'stock'-type (retail) product, per branch
router.post('/items/:id/stock', async (req, res) => {
  const itemId = req.params.id
  const { qty, type = 'add' } = req.body || {}

  if (qty === undefined || qty === null) {
    return res.status(400).json({ error: 'qty wajib diisi' })
  }

  try {
    const qtyNum = Number(qty)
    if (isNaN(qtyNum)) {
      return res.status(400).json({ error: 'qty harus berupa angka' })
    }

    const itemRows = await query(
      'SELECT product_type FROM menu_items WHERE id=? AND company_id=? LIMIT 1',
      [itemId, req.companyId]
    )
    if (!itemRows.length) return res.status(404).json({ error: 'Produk tidak ditemukan' })
    if (itemRows[0].product_type !== 'stock') {
      return res.status(400).json({ error: "Stok hanya berlaku untuk produk bertipe 'stock'" })
    }

    const current = await query(
      `SELECT mi.name, mi.unit_label, COALESCE(bsi.stock, 0) AS stock, COALESCE(bsi.stock_min, 0) AS stock_min
       FROM menu_items mi
       LEFT JOIN branch_stock_items bsi ON mi.id = bsi.menu_item_id AND bsi.branch_id = ?
       WHERE mi.id = ? AND mi.company_id = ?`,
      [req.tenantId, itemId, req.companyId]
    )

    const currentStock = Number(current[0]?.stock || 0)
    const stockMin = Number(current[0]?.stock_min || 0)
    let newStock = currentStock

    if (type === 'add') {
      newStock = currentStock + qtyNum
    } else if (type === 'subtract') {
      newStock = currentStock - qtyNum
      if (newStock < 0) {
        return res.status(400).json({ error: 'Stok tidak boleh negatif' })
      }
    } else if (type === 'set') {
      newStock = qtyNum
    } else {
      return res.status(400).json({ error: 'type harus add, subtract, atau set' })
    }

    await query(
      `INSERT INTO branch_stock_items (branch_id, menu_item_id, stock)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE stock = VALUES(stock)`,
      [req.tenantId, itemId, newStock]
    )

    await logActivity(req, 'adjust_stock', 'item', itemId, { type, qty: qtyNum, oldStock: currentStock, newStock })

    if (crossedLowStockThreshold(currentStock, newStock, stockMin)) {
      await notifyLowStock({
        companyId: req.companyId,
        branchId: req.tenantId,
        materialName: current[0]?.name || `Produk #${itemId}`,
        unit: current[0]?.unit_label || '',
        newStock,
        stockMin,
      })
    }

    res.json({ id: itemId, oldStock: currentStock, newStock, qty: qtyNum, type })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update stock minimum for a 'stock'-type (retail) product, per branch
router.put('/items/:id/stock-min', async (req, res) => {
  const itemId = req.params.id
  const { stockMin } = req.body || {}

  if (stockMin === undefined || stockMin === null || isNaN(Number(stockMin))) {
    return res.status(400).json({ error: 'stockMin harus berupa angka' })
  }

  try {
    const itemRows = await query(
      'SELECT product_type FROM menu_items WHERE id=? AND company_id=? LIMIT 1',
      [itemId, req.companyId]
    )
    if (!itemRows.length) return res.status(404).json({ error: 'Produk tidak ditemukan' })

    await query(
      `INSERT INTO branch_stock_items (branch_id, menu_item_id, stock_min)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE stock_min = VALUES(stock_min)`,
      [req.tenantId, itemId, Number(stockMin)]
    )

    await logActivity(req, 'update_stock_min', 'item', itemId, { stockMin: Number(stockMin) })

    res.json({ id: itemId, stockMin: Number(stockMin) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/orders', async (req, res) => {
  const {
    items = [],
    cash = 0,
    paymentMethod = 'tunai',
    tableNumber = null,
    customerName = null,
    orderType = 'kasir',
    orderStatus = paymentMethod === 'pesan_meja' ? 'pending' : 'paid',
    notes = null,
    voucherCode = null
  } = req.body || {}
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items wajib diisi' })
  }
  if ((paymentMethod === 'pesan_meja' || orderType === 'meja') && !String(tableNumber || '').trim()) {
    return res.status(400).json({ error: 'Nomor meja wajib ada. Silakan scan QR meja yang valid.' })
  }

  const advancedPaymentRequested = String(paymentMethod || '').toLowerCase() === 'pesan_meja' || String(orderType || '').toLowerCase() === 'meja'
  if (advancedPaymentRequested && planRank(req.subscriptionPlan) < PLAN_BY_SLUG.cabang.rank) {
    return res.status(403).json({
      success: false,
      code: 'PLAN_UPGRADE_REQUIRED',
      requiredPlan: PLAN_BY_SLUG.cabang.label,
      error: `Fitur Pesan Meja & QRIS dinamis membutuhkan paket ${PLAN_BY_SLUG.cabang.label}. Silakan upgrade langganan Anda.`
    })
  }

  try {
    const orderTxResult = await transaction(async (conn) => {
      const invalidItems = []
      const materialCache = new Map()
      const stockItemCache = new Map()
      const priceCache = new Map()
      const typeCache = new Map()
      const lowStockEvents = []
      const shouldDeductStock = orderStatus !== 'pending'

      const requestedQtyById = new Map()
      for (const item of items) {
        const qty = Number(item.qty) || 1
        requestedQtyById.set(item.id, (requestedQtyById.get(item.id) || 0) + qty)
      }

      for (const item of items) {
        const qty = Number(item.qty) || 1
        const priceKey = `${item.id}::${item.variantId || ''}`
        const [itemRows] = await conn.execute('SELECT name, price, discount_price, product_type FROM menu_items WHERE id = ? AND company_id=?', [item.id, req.companyId])
        if (!itemRows?.length) {
          invalidItems.push({ id: item.id, name: String(item.id), reasons: ['Produk tidak ditemukan untuk tenant ini'] })
          continue
        }
        const itemName = itemRows?.[0]?.name || String(item.id)
        const productType = itemRows[0].product_type || 'recipe'
        typeCache.set(item.id, productType)

        // Hitung harga resmi di server (JANGAN percaya item.price dari client)
        let resolvedPrice = Number(itemRows[0].price) || 0
        const discountPrice = itemRows[0].discount_price
        if (discountPrice !== null && discountPrice !== undefined && Number(discountPrice) > 0) {
          resolvedPrice = Number(discountPrice)
        }

        if (item.variantId) {
          const [variantRows] = await conn.execute(
            'SELECT price FROM variants WHERE id = ? AND menu_item_id = ?',
            [item.variantId, item.id]
          )
          if (!variantRows?.length) {
            invalidItems.push({ id: item.id, name: itemName, reasons: ['Varian tidak ditemukan untuk produk ini'] })
            continue
          }
          resolvedPrice = Number(variantRows[0].price) || 0
        }
        priceCache.set(priceKey, resolvedPrice)

        const [materialRows] = await conn.execute(
          `SELECT pm.material_id, pm.qty as material_qty, m.price, m.name, m.unit,
                  COALESCE(bm.stock, 0) as stock, COALESCE(bm.stock_min, 0) as stock_min
           FROM product_materials pm
           JOIN materials m ON pm.material_id = m.id
           LEFT JOIN branch_materials bm ON m.id = bm.material_id AND bm.branch_id = ?
           WHERE pm.menu_item_id = ? AND m.company_id=?`,
          [req.tenantId, item.id, req.companyId]
        )
        materialCache.set(item.id, materialRows)

        if (materialRows && materialRows.length > 0) {
          const reasons = new Set()
          for (const mat of materialRows) {
            const materialQty = Number(mat.material_qty) || 0
            const materialPrice = Number(mat.price) || 0
            const materialStock = Number(mat.stock) || 0
            const reduction = materialQty * qty
            const saldo = materialPrice * materialStock

            if (materialQty <= 0 || reduction <= 0) {
              reasons.add('Qty bahan baku tidak valid')
            }
            if (materialPrice <= 0) {
              reasons.add('Harga bahan baku kosong')
            }
            if (materialStock <= 0) {
              reasons.add('Stok bahan baku habis')
            }
            if (saldo <= 0) {
              reasons.add('Saldo bahan baku kosong')
            }
            if (materialStock < reduction) {
              reasons.add('Stok bahan baku tidak mencukupi')
            }
          }

          if (reasons.size > 0) {
            invalidItems.push({ id: item.id, name: itemName, reasons: Array.from(reasons) })
          }
        }

        if (productType === 'stock') {
          const [stockRows] = await conn.execute(
            `SELECT mi.name, mi.unit_label, COALESCE(bsi.stock, 0) AS stock, COALESCE(bsi.stock_min, 0) AS stock_min
             FROM menu_items mi
             LEFT JOIN branch_stock_items bsi ON mi.id = bsi.menu_item_id AND bsi.branch_id = ?
             WHERE mi.id = ? AND mi.company_id = ?`,
            [req.tenantId, item.id, req.companyId]
          )
          stockItemCache.set(item.id, stockRows?.[0] || null)
          const availableStock = Number(stockRows?.[0]?.stock || 0)
          const requestedQty = requestedQtyById.get(item.id) || qty
          const reasons = new Set()
          if (availableStock <= 0) reasons.add('Stok produk habis')
          else if (requestedQty > availableStock) reasons.add('Stok produk tidak mencukupi')
          if (reasons.size > 0) {
            invalidItems.push({ id: item.id, name: itemName, reasons: Array.from(reasons) })
          }
        }
      }

      if (invalidItems.length > 0) {
        const err = new Error('Produk tidak memenuhi syarat bahan baku. Transaksi dibatalkan.')
        err.status = 400
        err.details = invalidItems
        throw err
      }

      // Validasi voucher jika dikirimkan (pakai harga resmi dari server, bukan dari client)
      let discountAmount = 0
      let resolvedVoucherCode = null
      let voucherId = null

      if (voucherCode && String(voucherCode).trim()) {
        const cleanCode = String(voucherCode).trim().toUpperCase()
        const [vRows] = await conn.execute(
          'SELECT id, code, discount_type, discount_value, min_order_amount, max_discount_amount, expiry_date, usage_limit, used_count, is_active FROM vouchers WHERE code = ? AND tenant_id = ? LIMIT 1',
          [cleanCode, req.tenantId]
        )

        if (vRows.length === 0) {
          throw new Error('Kode voucher tidak valid')
        }

        const v = vRows[0]
        if (v.is_active !== 1) {
          throw new Error('Voucher saat ini tidak aktif')
        }
        if (v.expiry_date && new Date(v.expiry_date) < new Date()) {
          throw new Error('Voucher telah kedaluwarsa')
        }
        if (v.usage_limit !== null && v.used_count >= v.usage_limit) {
          throw new Error('Kuota penggunaan voucher telah habis')
        }

        // Hitung total belanja sebelum diskon (dari harga resmi server, bukan item.price kiriman client)
        let subtotal = 0
        for (const item of items) {
          const qty = Number(item.qty) || 1
          const itemPrice = priceCache.get(`${item.id}::${item.variantId || ''}`) || 0
          subtotal += (itemPrice * qty)
        }

        if (subtotal < Number(v.min_order_amount)) {
          throw new Error(`Minimal belanja untuk voucher ini adalah Rp ${Number(v.min_order_amount).toLocaleString('id-ID')}`)
        }

        // Hitung diskon nominal
        if (v.discount_type === 'fixed') {
          discountAmount = Number(v.discount_value)
        } else {
          discountAmount = Math.round((subtotal * Number(v.discount_value)) / 100)
          if (v.max_discount_amount !== null && discountAmount > Number(v.max_discount_amount)) {
            discountAmount = Number(v.max_discount_amount)
          }
        }

        if (discountAmount > subtotal) {
          discountAmount = subtotal
        }

        resolvedVoucherCode = v.code
        voucherId = v.id
      }

      const [orderResult] = await conn.execute(
        `INSERT INTO orders
          (cash, payment_method, table_number, customer_name, order_type, order_status, notes, stock_deducted, tenant_id, discount_amount, voucher_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          cash || 0,
          paymentMethod,
          String(tableNumber || '').trim() || null,
          customerName || null,
          orderType || 'kasir',
          orderStatus || (paymentMethod === 'pesan_meja' ? 'pending' : 'paid'),
          notes || null,
          shouldDeductStock ? 1 : 0,
          req.tenantId,
          discountAmount,
          resolvedVoucherCode
        ],
      )
      const insertedId = orderResult.insertId

      // Increment voucher usage
      if (voucherId) {
        await conn.execute('UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?', [voucherId])
      }

      for (const item of items) {
        const qty = Number(item.qty) || 1
        const materialRows = materialCache.get(item.id) || []
        const resolvedPrice = priceCache.get(`${item.id}::${item.variantId || ''}`) || 0
        const productType = typeCache.get(item.id) || 'recipe'

        if (shouldDeductStock && productType === 'recipe' && materialRows.length > 0) {
          for (const mat of materialRows) {
            const reduction = Number(mat.material_qty) * qty
            await conn.execute(
              'UPDATE branch_materials SET stock = stock - ? WHERE material_id = ? AND branch_id = ?',
              [reduction, mat.material_id, req.tenantId]
            )
            await conn.execute(
              'INSERT INTO material_movements (material_id, type, qty, price, order_id, notes, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [mat.material_id, 'out', reduction, Number(mat.price || 0), insertedId, `Order #${insertedId}`, req.tenantId]
            )

            const stockMin = Number(mat.stock_min || 0)
            if (stockMin > 0) {
              const [afterRows] = await conn.execute(
                'SELECT stock FROM branch_materials WHERE material_id = ? AND branch_id = ?',
                [mat.material_id, req.tenantId]
              )
              const oldStock = Number(mat.stock || 0)
              const newMaterialStock = Number(afterRows?.[0]?.stock || 0)
              if (crossedLowStockThreshold(oldStock, newMaterialStock, stockMin)) {
                lowStockEvents.push({ materialName: mat.name, unit: mat.unit, newStock: newMaterialStock, stockMin })
              }
            }
          }
        } else if (shouldDeductStock && productType === 'stock') {
          await conn.execute(
            'UPDATE branch_stock_items SET stock = stock - ? WHERE menu_item_id = ? AND branch_id = ?',
            [qty, item.id, req.tenantId]
          )

          const stockInfo = stockItemCache.get(item.id)
          const stockMin = Number(stockInfo?.stock_min || 0)
          if (stockInfo && stockMin > 0) {
            const [afterRows] = await conn.execute(
              'SELECT stock FROM branch_stock_items WHERE menu_item_id = ? AND branch_id = ?',
              [item.id, req.tenantId]
            )
            const oldStock = Number(stockInfo.stock || 0)
            const newItemStock = Number(afterRows?.[0]?.stock || 0)
            if (crossedLowStockThreshold(oldStock, newItemStock, stockMin)) {
              lowStockEvents.push({ materialName: stockInfo.name, unit: stockInfo.unit_label, newStock: newItemStock, stockMin })
            }
          }
        }

        await conn.execute(
          'INSERT INTO order_items (order_id, menu_item_id, qty, price_each, discount_each) VALUES (?, ?, ?, ?, ?)',
          [insertedId, item.id, qty, resolvedPrice, Number(item.discount) || 0],
        )

      }

      return { insertedId, lowStockEvents }
    })

    const { insertedId, lowStockEvents } = orderTxResult

    // Kirim notifikasi SETELAH transaksi commit & koneksi dilepas — jangan pernah
    // menahan koneksi MySQL dari pool selagi menunggu HTTP round-trip ke Telegram.
    for (const event of lowStockEvents) {
      await notifyLowStock({
        companyId: req.companyId,
        branchId: req.tenantId,
        materialName: event.materialName,
        unit: event.unit,
        newStock: event.newStock,
        stockMin: event.stockMin,
      })
    }

    res.status(201).json({ orderId: insertedId })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details })
  }
})

router.post('/table-orders/payment', requireAdvancedOrderingPlan, async (req, res) => {
  const { items = [], tableNumber = null, customerName = null, notes = null } = req.body || {}
  if (!process.env.MIDTRANS_SERVER_KEY) {
    return res.status(500).json({ error: 'MIDTRANS_SERVER_KEY belum diset di server' })
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Items wajib diisi' })
  }
  if (!String(tableNumber || '').trim()) {
    return res.status(400).json({ error: 'Nomor meja wajib ada. Silakan scan QR meja yang valid.' })
  }

  try {
    const orderPayload = {
      items,
      cash: 0,
      paymentMethod: 'qris',
      tableNumber,
      customerName,
      orderType: 'meja',
      orderStatus: 'waiting_payment',
      notes,
    }

    const orderId = await transaction(async (conn) => {
      const invalidItems = []
      for (const item of items) {
        const qty = Number(item.qty) || 1
        const [itemRows] = await conn.execute('SELECT name, product_type FROM menu_items WHERE id = ? AND company_id=?', [item.id, req.companyId])
        if (!itemRows?.length) {
          invalidItems.push({ id: item.id, name: String(item.id), reasons: ['Produk tidak ditemukan untuk tenant ini'] })
          continue
        }
        const itemName = itemRows?.[0]?.name || String(item.id)
        const productType = itemRows[0].product_type || 'recipe'
        const [materialRows] = await conn.execute(
          `SELECT pm.material_id, pm.qty as material_qty, m.price, COALESCE(bm.stock, 0) as stock
           FROM product_materials pm
           JOIN materials m ON pm.material_id = m.id
           LEFT JOIN branch_materials bm ON m.id = bm.material_id AND bm.branch_id = ?
           WHERE pm.menu_item_id = ? AND m.company_id=?`,
          [req.tenantId, item.id, req.companyId]
        )

        if (materialRows && materialRows.length > 0) {
          const reasons = new Set()
          for (const mat of materialRows) {
            const materialQty = Number(mat.material_qty) || 0
            const materialPrice = Number(mat.price) || 0
            const materialStock = Number(mat.stock) || 0
            const reduction = materialQty * qty
            const saldo = materialPrice * materialStock

            if (materialQty <= 0 || reduction <= 0) reasons.add('Qty bahan baku tidak valid')
            if (materialPrice <= 0) reasons.add('Harga bahan baku kosong')
            if (materialStock <= 0) reasons.add('Stok bahan baku habis')
            if (saldo <= 0) reasons.add('Saldo bahan baku kosong')
            if (materialStock < reduction) reasons.add('Stok bahan baku tidak mencukupi')
          }

          if (reasons.size > 0) {
            invalidItems.push({ id: item.id, name: itemName, reasons: Array.from(reasons) })
          }
        }

        if (productType === 'stock') {
          const [stockRows] = await conn.execute(
            `SELECT COALESCE(bsi.stock, 0) AS stock
             FROM menu_items mi
             LEFT JOIN branch_stock_items bsi ON mi.id = bsi.menu_item_id AND bsi.branch_id = ?
             WHERE mi.id = ? AND mi.company_id = ?`,
            [req.tenantId, item.id, req.companyId]
          )
          const availableStock = Number(stockRows?.[0]?.stock || 0)
          const reasons = new Set()
          if (availableStock <= 0) reasons.add('Stok produk habis')
          else if (qty > availableStock) reasons.add('Stok produk tidak mencukupi')
          if (reasons.size > 0) {
            invalidItems.push({ id: item.id, name: itemName, reasons: Array.from(reasons) })
          }
        }
      }

      if (invalidItems.length > 0) {
        const err = new Error('Produk tidak memenuhi syarat bahan baku. Pembayaran belum dibuat.')
        err.status = 400
        err.details = invalidItems
        throw err
      }

      const [orderResult] = await conn.execute(
        `INSERT INTO orders
          (cash, payment_method, table_number, customer_name, order_type, order_status, notes, stock_deducted, payment_gateway, payment_status, payment_expired_at, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'midtrans', 'waiting_payment', DATE_ADD(NOW(), INTERVAL ? MINUTE), ?)`,
        [
          orderPayload.cash,
          orderPayload.paymentMethod,
          String(tableNumber || '').trim(),
          customerName || null,
          orderPayload.orderType,
          orderPayload.orderStatus,
          notes || null,
          Number(process.env.PAYMENT_EXPIRE_MINUTES) || 15,
          req.tenantId,
        ],
      )
      const insertedId = orderResult.insertId

      for (const item of items) {
        const qty = Number(item.qty) || 1
        await conn.execute(
          'INSERT INTO order_items (order_id, menu_item_id, qty, price_each, discount_each) VALUES (?, ?, ?, ?, ?)',
          [insertedId, item.id, qty, Number(item.price) || 0, Number(item.discount) || 0],
        )
      }


      return insertedId
    })

    const totalAmount = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.qty) || 1), 0)
    const midtransOrderId = `ORDER-${orderId}-${Date.now()}`
    const chargePayload = {
      payment_type: 'qris',
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: totalAmount,
      },
      item_details: items.map((item) => ({
        id: String(item.id),
        price: Number(item.price) || 0,
        quantity: Number(item.qty) || 1,
        name: String(item.name || item.id).slice(0, 50),
      })),
      customer_details: {
        first_name: customerName || `Meja ${tableNumber}`,
      },
    }

    const mtRes = await fetch(`${midtransBaseUrl()}/v2/charge`, {
      method: 'POST',
      headers: {
        Authorization: midtransAuthHeader(),
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(chargePayload),
    })
    const mtPayload = await mtRes.json()
    if (!mtRes.ok) {
      await query('UPDATE orders SET order_status=?, payment_status=? WHERE id=? AND tenant_id=?', ['cancelled', 'failed', orderId, req.tenantId])
      const midtransMessage = Array.isArray(mtPayload?.status_message)
        ? mtPayload.status_message.join(', ')
        : mtPayload?.status_message
      const friendlyMessage = /unknown merchant|server_key|merchant server/i.test(midtransMessage || '')
        ? 'Server Key Midtrans tidak dikenali. Pastikan key sesuai mode Sandbox/Production dan restart server.'
        : midtransMessage || 'Gagal membuat QRIS Midtrans'
      return res.status(502).json({ error: friendlyMessage, details: mtPayload })
    }

    const qrUrl = extractMidtransQrUrl(mtPayload)
    await query(
      'UPDATE orders SET payment_reference=?, payment_qr_url=?, payment_status=? WHERE id=? AND tenant_id=?',
      [midtransOrderId, qrUrl, mtPayload.transaction_status || 'waiting_payment', orderId, req.tenantId]
    )

    res.status(201).json({
      orderId,
      paymentReference: midtransOrderId,
      status: 'waiting_payment',
      paymentStatus: mtPayload.transaction_status || 'waiting_payment',
      qrUrl,
      expiredMinutes: Number(process.env.PAYMENT_EXPIRE_MINUTES) || 15,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/orders/:id/payment-status', async (req, res) => {
  const orderId = Number(req.params.id)
  if (!orderId) return res.status(400).json({ error: 'Order ID tidak valid' })

  try {
    const rows = await query(
      `SELECT id, order_status AS orderStatus, payment_status AS paymentStatus,
              payment_reference AS paymentReference, payment_qr_url AS qrUrl,
              payment_expired_at AS paymentExpiredAt, paid_at AS paidAt
       FROM orders WHERE id=? AND tenant_id=?`,
      [orderId, req.tenantId]
    )
    if (!rows?.[0]) return res.status(404).json({ error: 'Order tidak ditemukan' })

    let order = rows[0]
    const currentStatus = String(order.orderStatus || '').toLowerCase()
    const canCheckGateway = order.paymentReference && process.env.MIDTRANS_SERVER_KEY && !['paid', 'processing', 'completed', 'cancelled', 'expired'].includes(currentStatus)

    if (canCheckGateway) {
      const statusRes = await fetch(`${midtransBaseUrl()}/v2/${encodeURIComponent(order.paymentReference)}/status`, {
        method: 'GET',
        headers: {
          Authorization: midtransAuthHeader(),
          Accept: 'application/json',
        },
      })
      const statusPayload = await statusRes.json()

      if (statusRes.ok) {
        const transactionStatus = statusPayload.transaction_status
        const fraudStatus = statusPayload.fraud_status
        let orderStatus = order.orderStatus
        let paymentStatus = transactionStatus || order.paymentStatus
        let paidAt = null

        if ((transactionStatus === 'settlement') || (transactionStatus === 'capture' && fraudStatus === 'accept')) {
          orderStatus = 'paid'
          paymentStatus = 'paid'
          paidAt = new Date()
        } else if (['expire', 'cancel', 'deny', 'failure'].includes(transactionStatus)) {
          orderStatus = transactionStatus === 'expire' ? 'expired' : 'cancelled'
          paymentStatus = orderStatus
        } else if (transactionStatus === 'pending') {
          orderStatus = 'waiting_payment'
          paymentStatus = 'pending'
        }

        await query(
          'UPDATE orders SET order_status=?, payment_status=?, paid_at=COALESCE(?, paid_at) WHERE id=? AND tenant_id=?',
          [orderStatus, paymentStatus, paidAt, orderId, req.tenantId]
        )

        order = {
          ...order,
          orderStatus,
          paymentStatus,
          paidAt: paidAt || order.paidAt,
          gatewayStatus: transactionStatus,
        }
      }
    }

    res.json(order)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/orders', async (req, res) => {
  try {
    const rows = await query(
      `SELECT o.id, o.cash, o.payment_method AS paymentMethod,
              o.table_number AS tableNumber, o.customer_name AS customerName,
              o.order_type AS orderType, o.order_status AS orderStatus, o.notes,
              o.created_at AS createdAt,
              COUNT(oi.id) AS totalItems, SUM(oi.qty * oi.price_each) AS totalPrice
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.tenant_id=?
       GROUP BY o.id, o.cash, o.payment_method, o.table_number, o.customer_name, o.order_type, o.order_status, o.notes, o.created_at
       ORDER BY o.id DESC`,
      [req.tenantId],
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/reports/daily', async (req, res) => {
  try {
    const rows = await query(
      `SELECT 
        DATE_FORMAT(o.created_at, '%Y-%m-%d') as date,
        COUNT(o.id) as totalOrders,
        SUM(oi.qty * oi.price_each) as totalRevenue,
        COUNT(DISTINCT oi.menu_item_id) as uniqueItems,
        SUM(oi.qty) as totalItemsSold
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.tenant_id=?
       GROUP BY DATE_FORMAT(o.created_at, '%Y-%m-%d')
       ORDER BY date DESC`,
      [req.tenantId],
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/orders/:id', async (req, res) => {
  const orderId = Number(req.params.id)
  if (!orderId) return res.status(400).json({ error: 'Order ID tidak valid' })
  try {
    const [order] = await query(
      `SELECT id, cash, payment_method AS paymentMethod,
              table_number AS tableNumber, customer_name AS customerName,
              order_type AS orderType, order_status AS orderStatus, notes,
              created_at AS createdAt
       FROM orders
       WHERE id = ? AND tenant_id=?`,
      [orderId, req.tenantId],
    )
    if (!order) return res.status(404).json({ error: 'Order tidak ditemukan' })

    const items = await query(
      `SELECT oi.menu_item_id AS menuItemId, mi.name, oi.variant_id AS variantId, 
              v.name AS variantName, oi.qty, oi.price_each AS priceEach, oi.discount_each AS discountEach
       FROM order_items oi
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       LEFT JOIN variants v ON v.id = oi.variant_id
       WHERE oi.order_id = ? AND mi.tenant_id=?`,
      [orderId, req.tenantId],
    )

    res.json({ ...order, items })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/orders/:id/status', async (req, res) => {
  const orderId = Number(req.params.id)
  const { status } = req.body || {}
  const allowedStatuses = ['pending', 'processing', 'paid', 'completed', 'cancelled']

  if (!orderId) return res.status(400).json({ error: 'Order ID tidak valid' })
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status order tidak valid' })
  }

  try {
    await transaction(async (conn) => {
      const [orderRows] = await conn.execute(
        'SELECT id, order_status AS orderStatus, stock_deducted AS stockDeducted FROM orders WHERE id=? AND tenant_id=?',
        [orderId, req.tenantId]
      )
      const order = orderRows?.[0]
      if (!order) {
        const err = new Error('Order tidak ditemukan')
        err.status = 404
        throw err
      }

      const shouldDeductStock = ['processing', 'paid', 'completed'].includes(status) && !Number(order.stockDeducted || 0)

      if (shouldDeductStock) {
        const [items] = await conn.execute(
          'SELECT menu_item_id AS id, qty FROM order_items WHERE order_id=?',
          [orderId]
        )
        const invalidItems = []
        const typeCache = new Map()

        for (const item of items || []) {
          const qty = Number(item.qty) || 1
          const [itemRows] = await conn.execute('SELECT name, product_type FROM menu_items WHERE id = ? AND tenant_id=?', [item.id, req.tenantId])
          const itemName = itemRows?.[0]?.name || String(item.id)
          const productType = itemRows?.[0]?.product_type || 'recipe'
          typeCache.set(item.id, productType)

          const [materialRows] = await conn.execute(
            `SELECT pm.material_id, pm.qty as material_qty, m.price, m.stock
             FROM product_materials pm
             JOIN materials m ON pm.material_id = m.id
             WHERE pm.menu_item_id = ? AND m.tenant_id=?`,
            [item.id, req.tenantId]
          )

          if (materialRows && materialRows.length > 0) {
            const reasons = new Set()
            for (const mat of materialRows) {
              const materialQty = Number(mat.material_qty) || 0
              const materialPrice = Number(mat.price) || 0
              const materialStock = Number(mat.stock) || 0
              const reduction = materialQty * qty
              const saldo = materialPrice * materialStock

              if (materialQty <= 0 || reduction <= 0) reasons.add('Qty bahan baku tidak valid')
              if (materialPrice <= 0) reasons.add('Harga bahan baku kosong')
              if (materialStock <= 0) reasons.add('Stok bahan baku habis')
              if (saldo <= 0) reasons.add('Saldo bahan baku kosong')
              if (materialStock < reduction) reasons.add('Stok bahan baku tidak mencukupi')
            }

            if (reasons.size > 0) {
              invalidItems.push({ id: item.id, name: itemName, reasons: Array.from(reasons) })
            }
          }

          if (productType === 'stock') {
            const [stockRows] = await conn.execute(
              `SELECT COALESCE(bsi.stock, 0) AS stock
               FROM menu_items mi
               LEFT JOIN branch_stock_items bsi ON mi.id = bsi.menu_item_id AND bsi.branch_id = ?
               WHERE mi.id = ? AND mi.tenant_id = ?`,
              [req.tenantId, item.id, req.tenantId]
            )
            const availableStock = Number(stockRows?.[0]?.stock || 0)
            const reasons = new Set()
            if (availableStock <= 0) reasons.add('Stok produk habis')
            else if (qty > availableStock) reasons.add('Stok produk tidak mencukupi')
            if (reasons.size > 0) {
              invalidItems.push({ id: item.id, name: itemName, reasons: Array.from(reasons) })
            }
          }
        }

        if (invalidItems.length > 0) {
          const err = new Error('Produk tidak memenuhi syarat bahan baku. Pesanan belum bisa diproses.')
          err.status = 400
          err.details = invalidItems
          throw err
        }

        for (const item of items || []) {
          const qty = Number(item.qty) || 1
          const productType = typeCache.get(item.id) || 'recipe'

          if (productType === 'stock') {
            await conn.execute(
              'UPDATE branch_stock_items SET stock = stock - ? WHERE menu_item_id = ? AND branch_id = ?',
              [qty, item.id, req.tenantId]
            )
            continue
          }

          const [materialRows] = await conn.execute(
            `SELECT pm.material_id, pm.qty as material_qty, m.price
             FROM product_materials pm
             JOIN materials m ON pm.material_id = m.id
             WHERE pm.menu_item_id = ? AND m.tenant_id=?`,
            [item.id, req.tenantId]
          )

          for (const mat of materialRows || []) {
            const reduction = Number(mat.material_qty) * qty
            await conn.execute('UPDATE materials SET stock = stock - ? WHERE id = ? AND tenant_id=?', [reduction, mat.material_id, req.tenantId])
            await conn.execute(
              'INSERT INTO material_movements (material_id, type, qty, price, order_id, notes) VALUES (?, ?, ?, ?, ?, ?)',
              [mat.material_id, 'out', reduction, Number(mat.price || 0), orderId, `Order #${orderId}`]
            )
          }
        }

        await conn.execute('UPDATE orders SET order_status=?, stock_deducted=1 WHERE id=? AND tenant_id=?', [status, orderId, req.tenantId])
      } else {
        await conn.execute('UPDATE orders SET order_status=? WHERE id=? AND tenant_id=?', [status, orderId, req.tenantId])
      }
    })
    await logActivity(req, 'update_status', 'order', orderId, { status })
    res.json({ id: orderId, status })
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details })
  }
})

// ===== EXPENSES ENDPOINTS =====

// Create expense
router.post('/expenses', async (req, res) => {
  const { category, description, amount } = req.body || {}
  if (!category || !description || !amount) {
    return res.status(400).json({ error: 'category, description, amount wajib diisi' })
  }

  try {
    const result = await query(
      'INSERT INTO expenses (category, description, amount, tenant_id) VALUES (?, ?, ?, ?)',
      [category, description, Number(amount), req.tenantId]
    )
    await logActivity(req, 'create', 'expense', result.insertId, {
      category,
      description,
      amount: Number(amount)
    })
    res.status(201).json({ id: result.insertId, category, description, amount: Number(amount) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Update expense
router.put('/expenses/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { category, description, amount } = req.body || {}
  if (!category || !description || !amount) {
    return res.status(400).json({ error: 'category, description, amount wajib diisi' })
  }
  try {
    await query(
      'UPDATE expenses SET category=?, description=?, amount=? WHERE id=? AND tenant_id=?',
      [category, description, Number(amount), id, req.tenantId]
    )
    await logActivity(req, 'update', 'expense', id, {
      category,
      description,
      amount: Number(amount)
    })
    res.json({ id, category, description, amount: Number(amount) })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Delete expense
router.delete('/expenses/:id', async (req, res) => {
  const id = Number(req.params.id)
  try {
    await query('DELETE FROM expenses WHERE id=? AND tenant_id=?', [id, req.tenantId])
    await logActivity(req, 'delete', 'expense', id, null)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get all expenses
router.get('/expenses', async (req, res) => {
  const { startDate, endDate, category } = req.query
  try {
    let sql = 'SELECT id, category, description, amount, created_at FROM expenses WHERE tenant_id=?'
    const params = [req.tenantId]
    
    if (startDate) {
      sql += ' AND DATE(created_at) >= ?'
      params.push(startDate)
    }
    if (endDate) {
      sql += ' AND DATE(created_at) <= ?'
      params.push(endDate)
    }
    if (category) {
      sql += ' AND category = ?'
      params.push(category)
    }
    
    sql += ' ORDER BY created_at DESC'
    const rows = await query(sql, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ===== ACTIVITY LOGS =====

// ===== MATERIAL MOVEMENTS REPORT =====

// Get material movements
router.get('/reports/materials/movements', async (req, res) => {
  const { startDate, endDate, type, materialId } = req.query
  
  try {
    let sql = `SELECT 
      mm.id, mm.material_id, m.name as materialName, m.unit,
      mm.type, mm.qty, mm.price, mm.notes, mm.order_id, mm.created_at
      FROM material_movements mm
      JOIN materials m ON m.id = mm.material_id
      WHERE m.tenant_id=?`
    const params = [req.tenantId]
    
    if (startDate) {
      sql += ' AND DATE(mm.created_at) >= ?'
      params.push(startDate)
    }
    if (endDate) {
      sql += ' AND DATE(mm.created_at) <= ?'
      params.push(endDate)
    }
    if (type) {
      sql += ' AND mm.type = ?'
      params.push(type)
    }
    if (materialId) {
      sql += ' AND mm.material_id = ?'
      params.push(Number(materialId))
    }
    
    sql += ' ORDER BY mm.created_at DESC'
    const rows = await query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error('[GET /reports/materials/movements] Error:', err.message, err.code)
    res.status(500).json({ error: err.message, code: err.code })
  }
})

// Get material summary (masuk/keluar)
router.get('/reports/materials/summary', async (req, res) => {
  const { startDate, endDate } = req.query
  
  try {
    let sql = `SELECT 
      m.id, m.name, m.unit, m.stock,
      COALESCE(SUM(CASE WHEN mm.type = 'in' THEN mm.qty ELSE 0 END), 0) as totalIn,
      COALESCE(SUM(CASE WHEN mm.type = 'out' THEN mm.qty ELSE 0 END), 0) as totalOut
      FROM materials m
      LEFT JOIN material_movements mm ON m.id = mm.material_id
      WHERE m.tenant_id=?`
    const params = [req.tenantId]
    
    if (startDate) {
      sql += ' AND DATE(mm.created_at) >= ?'
      params.push(startDate)
    }
    if (endDate) {
      sql += ' AND DATE(mm.created_at) <= ?'
      params.push(endDate)
    }
    
    sql += ' GROUP BY m.id, m.name, m.unit, m.stock ORDER BY m.name'
    const rows = await query(sql, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get expense summary
router.get('/reports/expenses/summary', async (req, res) => {
  const { startDate, endDate } = req.query
  
  try {
    let sql = `SELECT 
      category,
      COUNT(*) as count,
      SUM(amount) as total
      FROM expenses
      WHERE tenant_id=?`
    const params = [req.tenantId]
    
    if (startDate) {
      sql += ' AND DATE(created_at) >= ?'
      params.push(startDate)
    }
    if (endDate) {
      sql += ' AND DATE(created_at) <= ?'
      params.push(endDate)
    }
    
    sql += ' GROUP BY category ORDER BY total DESC'
    const rows = await query(sql, params)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ===== REPORTING ENDPOINTS =====

router.get('/reports/daily', async (req, res) => {
  const isCompanyScope = req.query.scope === 'company'
  const filterSql = isCompanyScope 
    ? 'o.tenant_id IN (SELECT id FROM tenants WHERE company_id = ?)' 
    : 'o.tenant_id = ?'
  const filterParam = isCompanyScope ? req.companyId : req.tenantId

  try {
    const rows = await query(
      `SELECT 
        DATE_FORMAT(o.created_at, '%Y-%m-%d') as date,
        COUNT(o.id) as totalOrders,
        SUM(oi.qty * oi.price_each) as totalRevenue,
        COUNT(DISTINCT oi.menu_item_id) as uniqueItems,
        SUM(oi.qty) as totalItemsSold
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE ${filterSql}
       GROUP BY DATE_FORMAT(o.created_at, '%Y-%m-%d')
       ORDER BY date DESC`,
      [filterParam],
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/reports/daily/:date', async (req, res) => {
  let targetDate = req.params.date
  const page = Math.max(1, Number(req.query.page) || 1)
  const pageSize = 10
  const offset = (page - 1) * pageSize

  // DEBUG LOG: parameter date
  // Report detail date param

  if (!targetDate) return res.status(400).json({ error: 'Date parameter required (YYYY-MM-DD)' })

  // Handle both YYYY-MM-DD and ISO datetime format (e.g. 2025-12-14T17:00:00.000Z)
  // Extract just the YYYY-MM-DD part if it's an ISO string
  if (targetDate.includes('T')) {
    targetDate = targetDate.split('T')[0]
  }

  // DEBUG LOG: after normalization
  // Normalized date

  try {
    const [summary] = await query(
      `SELECT 
        DATE_FORMAT(o.created_at, '%Y-%m-%d') as date,
        COUNT(o.id) as totalOrders,
        SUM(oi.qty * oi.price_each) as totalRevenue,
        COUNT(DISTINCT oi.menu_item_id) as uniqueItems,
        SUM(oi.qty) as totalItemsSold
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE DATE_FORMAT(o.created_at, '%Y-%m-%d') = ? AND o.tenant_id=?
       GROUP BY DATE_FORMAT(o.created_at, '%Y-%m-%d')`,
      [targetDate, req.tenantId],
    )

    // Get shift info dan kasir untuk hari itu
    const shiftInfo = await query(
      `SELECT 
        s.id,
        c.name as cashierName,
        s.opening_cash as openingCash,
        s.closing_cash as closingCash,
        s.start_time as startTime,
        s.end_time as endTime
       FROM cashier_shifts s
       JOIN cashiers c ON s.cashier_id = c.id
       WHERE DATE_FORMAT(s.start_time, '%Y-%m-%d') = ? AND c.tenant_id=?
       ORDER BY s.start_time DESC`,
      [targetDate, req.tenantId],
    )

    const paymentBreakdown = await query(
      `SELECT 
        o.payment_method as paymentMethod,
        COUNT(o.id) as count,
        SUM(oi.qty * oi.price_each) as total
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE DATE_FORMAT(o.created_at, '%Y-%m-%d') = ? AND o.tenant_id=?
       GROUP BY o.payment_method`,
      [targetDate, req.tenantId],
    )

    // Get all items sold dengan detail
    const itemsSummary = await query(
      `SELECT 
        mi.id,
        mi.name,
        v.name as variantName,
        SUM(oi.qty) as totalQty,
        SUM(oi.qty * oi.price_each) as revenue
       FROM order_items oi
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       LEFT JOIN variants v ON v.id = oi.variant_id
       JOIN orders o ON o.id = oi.order_id
       WHERE DATE_FORMAT(o.created_at, '%Y-%m-%d') = ? AND o.tenant_id=?
       GROUP BY oi.menu_item_id, oi.variant_id
       ORDER BY revenue DESC`,
      [targetDate, req.tenantId],
    )

    const topItems = itemsSummary.slice(0, 10)

    // Get total orders count for pagination
    const [countResult] = await query(
      `SELECT COUNT(DISTINCT o.id) as total
       FROM orders o
       WHERE DATE_FORMAT(o.created_at, '%Y-%m-%d') = ? AND o.tenant_id=?`,
      [targetDate, req.tenantId],
    )
    const totalOrders = countResult?.total || 0
    const totalPages = Math.ceil(totalOrders / pageSize)

    // Get paginated orders list
    const orders = await query(
      `SELECT 
        o.id,
        o.created_at,
        o.payment_method as paymentMethod,
        o.cash,
        SUM(oi.qty * oi.price_each) as total,
        SUM(oi.qty) as totalItems
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE DATE_FORMAT(o.created_at, '%Y-%m-%d') = ? AND o.tenant_id=?
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [targetDate, req.tenantId, pageSize, offset],
    )

    res.json({
      summary,
      shiftInfo,
      paymentBreakdown,
      topItems,
      itemsSummary,
      orders,
      pagination: {
        page,
        pageSize,
        totalOrders,
        totalPages,
      },
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/reports/weekly', async (req, res) => {
  try {
    const rows = await query(
      `SELECT 
        DATE_FORMAT(o.created_at, '%Y-W%v') as week,
        YEAR(o.created_at) as year,
        WEEK(o.created_at) as weekNum,
        COUNT(o.id) as totalOrders,
        SUM(oi.qty * oi.price_each) as totalRevenue,
        COUNT(DISTINCT oi.menu_item_id) as uniqueItems,
        SUM(oi.qty) as totalItemsSold
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.tenant_id=?
       GROUP BY YEAR(o.created_at), WEEK(o.created_at)
       ORDER BY year DESC, weekNum DESC`,
      [req.tenantId],
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/reports/monthly', async (req, res) => {
  try {
    const rows = await query(
      `SELECT 
        DATE_FORMAT(o.created_at, '%Y-%m') as month,
        YEAR(o.created_at) as year,
        MONTH(o.created_at) as monthNum,
        COUNT(o.id) as totalOrders,
        SUM(oi.qty * oi.price_each) as totalRevenue,
        COUNT(DISTINCT oi.menu_item_id) as uniqueItems,
        SUM(oi.qty) as totalItemsSold
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.tenant_id=?
       GROUP BY YEAR(o.created_at), MONTH(o.created_at)
       ORDER BY year DESC, monthNum DESC`,
      [req.tenantId],
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/reports/monthly/:month', async (req, res) => {
  const targetMonth = req.params.month
  if (!targetMonth) return res.status(400).json({ error: 'Month parameter required (YYYY-MM)' })

  try {
    const [summary] = await query(
      `SELECT 
        DATE_FORMAT(o.created_at, '%Y-%m') as month,
        COUNT(o.id) as totalOrders,
        SUM(oi.qty * oi.price_each) as totalRevenue,
        COUNT(DISTINCT oi.menu_item_id) as uniqueItems,
        SUM(oi.qty) as totalItemsSold,
        COUNT(DISTINCT DATE(o.created_at)) as daysActive
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE DATE_FORMAT(o.created_at, '%Y-%m') = ? AND o.tenant_id=?
       GROUP BY DATE_FORMAT(o.created_at, '%Y-%m')`,
      [targetMonth, req.tenantId],
    )

    const dailyBreakdown = await query(
      `SELECT 
        DATE(o.created_at) as date,
        COUNT(o.id) as orders,
        SUM(oi.qty * oi.price_each) as revenue
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE DATE_FORMAT(o.created_at, '%Y-%m') = ? AND o.tenant_id=?
       GROUP BY DATE(o.created_at)
       ORDER BY date`,
      [targetMonth, req.tenantId],
    )

    const paymentBreakdown = await query(
      `SELECT 
        o.payment_method as paymentMethod,
        COUNT(o.id) as count,
        SUM(oi.qty * oi.price_each) as total
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE DATE_FORMAT(o.created_at, '%Y-%m') = ? AND o.tenant_id=?
       GROUP BY o.payment_method`,
      [targetMonth, req.tenantId],
    )

    const topItems = await query(
      `SELECT 
        mi.name,
        v.name as variantName,
        SUM(oi.qty) as totalQty,
        SUM(oi.qty * oi.price_each) as revenue
       FROM order_items oi
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       LEFT JOIN variants v ON v.id = oi.variant_id
       JOIN orders o ON o.id = oi.order_id
       WHERE DATE_FORMAT(o.created_at, '%Y-%m') = ? AND o.tenant_id=?
       GROUP BY oi.menu_item_id, oi.variant_id
       ORDER BY totalQty DESC
       LIMIT 15`,
      [targetMonth, req.tenantId],
    )

    res.json({
      summary,
      dailyBreakdown,
      paymentBreakdown,
      topItems,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/reports/yearly', async (req, res) => {
  try {
    const rows = await query(
      `SELECT 
        YEAR(o.created_at) as year,
        COUNT(o.id) as totalOrders,
        SUM(oi.qty * oi.price_each) as totalRevenue,
        COUNT(DISTINCT oi.menu_item_id) as uniqueItems,
        SUM(oi.qty) as totalItemsSold
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.tenant_id=?
       GROUP BY YEAR(o.created_at)
       ORDER BY year DESC`,
      [req.tenantId],
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/reports/summary', async (req, res) => {
  const isCompanyScope = req.query.scope === 'company'
  const filterSql = isCompanyScope 
    ? 'o.tenant_id IN (SELECT id FROM tenants WHERE company_id = ?)' 
    : 'o.tenant_id = ?'
  const filterParam = isCompanyScope ? req.companyId : req.tenantId

  try {
    const [overall] = await query(
      `SELECT 
        COUNT(o.id) as totalOrders,
        SUM(oi.qty * oi.price_each) as totalRevenue,
        COUNT(DISTINCT DATE(o.created_at)) as totalDaysActive,
        COUNT(DISTINCT oi.menu_item_id) as totalProductsSold,
        SUM(oi.qty) as totalItemsSold,
        AVG(oi.qty * oi.price_each) as avgOrderValue,
        SUM(oi.qty * COALESCE(mi.cost_price, (
          SELECT SUM(pm.qty * m.price)
          FROM product_materials pm
          JOIN materials m ON pm.material_id = m.id
          WHERE pm.menu_item_id = mi.id AND m.company_id = mi.company_id
        ), 0)) as totalCOGS
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE ${filterSql}`,
      [filterParam],
    )

    const paymentSummary = await query(
      `SELECT 
        o.payment_method as paymentMethod,
        COUNT(o.id) as count,
        SUM(oi.qty * oi.price_each) as total
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE ${filterSql}
       GROUP BY o.payment_method`,
      [filterParam],
    )

    const topProducts = await query(
      `SELECT 
        mi.name,
        v.name as variantName,
        SUM(oi.qty) as totalQty,
        SUM(oi.qty * oi.price_each) as revenue
       FROM order_items oi
       JOIN menu_items mi ON mi.id = oi.menu_item_id
       LEFT JOIN variants v ON v.id = oi.variant_id
       JOIN orders o ON o.id = oi.order_id
       WHERE ${filterSql}
       GROUP BY oi.menu_item_id, oi.variant_id
       ORDER BY totalQty DESC
       LIMIT 10`,
      [filterParam],
    )

    res.json({
      overall,
      paymentSummary,
      topProducts,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/reports/branches-comparison', requireTenant, async (req, res) => {
  try {
    const branches = await query(
      'SELECT id, name FROM tenants WHERE company_id = ? ORDER BY name',
      [req.companyId]
    )

    const comparison = []
    for (const b of branches) {
      const [metrics] = await query(
        `SELECT 
          COALESCE(SUM(oi.qty * oi.price_each), 0) AS totalRevenue,
          COUNT(DISTINCT o.id) AS totalOrders,
          COALESCE(SUM(oi.qty * COALESCE(mi.cost_price, 0)), 0) AS totalCOGS
         FROM orders o
         LEFT JOIN order_items oi ON o.id = oi.order_id
         LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
         WHERE o.tenant_id = ?`,
        [b.id]
      )

      const [expensesMetrics] = await query(
        `SELECT COALESCE(SUM(amount), 0) AS totalExpenses FROM expenses WHERE tenant_id = ?`,
        [b.id]
      )

      const totalRevenue = Number(metrics.totalRevenue || 0)
      const totalCOGS = Number(metrics.totalCOGS || 0)
      const totalExpenses = Number(expensesMetrics.totalExpenses || 0)
      const netProfit = totalRevenue - totalCOGS - totalExpenses

      comparison.push({
        branchId: b.id,
        branchName: b.name,
        totalRevenue,
        totalOrders: Number(metrics.totalOrders || 0),
        totalExpenses,
        totalCOGS,
        netProfit
      })
    }

    // Daily trends for the last 7 days grouped by branch and date
    const dailyRaw = await query(
      `SELECT 
        DATE_FORMAT(o.created_at, '%Y-%m-%d') AS date,
        o.tenant_id AS branchId,
        t.name AS branchName,
        COALESCE(SUM(oi.qty * oi.price_each), 0) AS revenue
       FROM orders o
       JOIN order_items oi ON o.id = oi.order_id
       JOIN tenants t ON o.tenant_id = t.id
       WHERE t.company_id = ?
         AND o.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE_FORMAT(o.created_at, '%Y-%m-%d'), o.tenant_id, t.name
       ORDER BY date ASC`,
      [req.companyId]
    )

    // Pivot daily data by date
    const dailyMap = {}
    dailyRaw.forEach(row => {
      if (!dailyMap[row.date]) {
        dailyMap[row.date] = { date: row.date, branches: {} }
      }
      dailyMap[row.date].branches[row.branchName] = Number(row.revenue)
    })
    const dailyTrends = Object.values(dailyMap)

    res.json({
      comparison,
      dailyTrends
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/reports/profit-loss', requireTenant, async (req, res) => {
  const isCompanyScope = req.query.scope === 'company'
  const filterSqlBase = isCompanyScope 
    ? 'o.tenant_id IN (SELECT id FROM tenants WHERE company_id = ?)' 
    : 'o.tenant_id = ?'
  const filterParam = isCompanyScope ? req.companyId : req.tenantId

  const { startDate, endDate } = req.query
  let dateFilter = ''
  const dateParams = []

  if (startDate) {
    dateFilter += ' AND DATE(o.created_at) >= ?'
    dateParams.push(startDate)
  }
  if (endDate) {
    dateFilter += ' AND DATE(o.created_at) <= ?'
    dateParams.push(endDate)
  }

  try {
    // 1. Overall metrics
    const [overallResult] = await query(
      `SELECT 
        COUNT(o.id) as totalOrders,
        COALESCE(SUM(oi.qty * oi.price_each), 0) as totalRevenue,
        COALESCE(SUM(oi.qty * COALESCE(mi.cost_price, 0)), 0) as totalCOGS
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
       WHERE ${filterSqlBase} ${dateFilter}`,
      [filterParam, ...dateParams]
    )

    // 2. Expenses total
    let expenseSql = isCompanyScope 
      ? 'SELECT SUM(amount) as total FROM expenses WHERE tenant_id IN (SELECT id FROM tenants WHERE company_id = ?)' 
      : 'SELECT SUM(amount) as total FROM expenses WHERE tenant_id = ?'
    const expenseParams = [filterParam]
    
    if (startDate) {
      expenseSql += ' AND DATE(created_at) >= ?'
      expenseParams.push(startDate)
    }
    if (endDate) {
      expenseSql += ' AND DATE(created_at) <= ?'
      expenseParams.push(endDate)
    }

    const [expenseResult] = await query(expenseSql, expenseParams)

    // 3. Product-wise P&L breakdown
    const productSql = `
      SELECT 
        mi.id,
        mi.name,
        mi.category,
        COALESCE(mi.cost_price, 0) AS costPrice,
        SUM(oi.qty) AS qtySold,
        SUM(oi.qty * oi.price_each) AS revenue,
        SUM(oi.qty * COALESCE(mi.cost_price, 0)) AS totalCOGS
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      JOIN orders o ON o.id = oi.order_id
      WHERE ${filterSqlBase} ${dateFilter}
      GROUP BY mi.id, mi.name, mi.category, mi.cost_price
      ORDER BY qtySold DESC
    `
    const productBreakdown = await query(productSql, [filterParam, ...dateParams])

    // 4. Category-wise P&L breakdown
    const categorySql = `
      SELECT 
        mi.category,
        SUM(oi.qty) AS qtySold,
        SUM(oi.qty * oi.price_each) AS revenue,
        SUM(oi.qty * COALESCE(mi.cost_price, 0)) AS totalCOGS
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      JOIN orders o ON o.id = oi.order_id
      WHERE ${filterSqlBase} ${dateFilter}
      GROUP BY mi.category
      ORDER BY revenue DESC
    `
    const categoryBreakdown = await query(categorySql, [filterParam, ...dateParams])

    const totalRevenue = Number(overallResult.totalRevenue || 0)
    const totalCOGS = Number(overallResult.totalCOGS || 0)
    const totalExpenses = Number(expenseResult.total || 0)
    const grossProfit = totalRevenue - totalCOGS
    const netProfit = grossProfit - totalExpenses

    res.json({
      summary: {
        totalOrders: Number(overallResult.totalOrders || 0),
        totalRevenue,
        totalCOGS,
        totalExpenses,
        grossProfit,
        netProfit,
        netMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
      },
      productBreakdown,
      categoryBreakdown
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ===== CASHIER ACCOUNTS =====
router.get('/cashiers', async (req, res) => {
  const isCompanyScope = req.query.scope === 'company'
  try {
    let rows;
    if (isCompanyScope) {
      rows = await query(
        `SELECT c.id, c.name, c.username, c.role, c.email, c.tenant_id, t.name AS tenantName, c.created_at AS createdAt,
                c.telegram_chat_id, c.notify_low_stock
         FROM cashiers c
         JOIN tenants t ON c.tenant_id = t.id
         WHERE t.company_id = ?
         ORDER BY c.name`,
        [req.companyId]
      )
    } else {
      rows = await query(
        `SELECT c.id, c.name, c.username, c.role, c.email, c.tenant_id, t.name AS tenantName, c.created_at AS createdAt,
                c.telegram_chat_id, c.notify_low_stock
         FROM cashiers c
         JOIN tenants t ON c.tenant_id = t.id
         WHERE c.tenant_id = ?
         ORDER BY c.name`,
        [req.tenantId]
      )
    }
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/cashiers', requirePrivilegedCashier, checkCashierLimit, async (req, res) => {
  const { name, username, pin, role = 'kasir', email } = req.body || {}
  if (!name || !username || !pin) {
    return res.status(400).json({ error: 'name, username, pin wajib diisi' })
  }
  try {
    const result = await query(
      'INSERT INTO cashiers (name, username, pin, pin_hash, role, email, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, username, '', hashSecret(pin), role, email || null, req.tenantId]
    )
    await logActivity(req, 'create', 'cashier', result.insertId, { name, username, role, email })
    res.status(201).json({ id: result.insertId, name, username, role, email })
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username sudah digunakan' })
    }
    res.status(500).json({ error: err.message })
  }
})

router.put('/cashiers/:id', requirePrivilegedCashier, async (req, res) => {
  const id = Number(req.params.id)
  const { name, username, pin, role = 'kasir', email } = req.body || {}
  if (!name || !username) {
    return res.status(400).json({ error: 'name, username wajib diisi' })
  }
  try {
    const target = await query('SELECT role FROM cashiers WHERE id=? AND tenant_id=?', [id, req.tenantId])
    if (target.length > 0) {
      const targetRole = String(target[0].role).toLowerCase();
      if (targetRole === 'owner' && req.callerRole !== 'owner') {
        return res.status(403).json({ error: 'Akun Owner hanya dapat dimodifikasi oleh sesama Owner.' })
      }
      if (targetRole === 'owner' && String(role).toLowerCase() !== 'owner') {
        return res.status(400).json({ error: 'Role akun Owner tidak dapat diturunkan.' })
      }
    }

    if (pin) {
      await query(
        'UPDATE cashiers SET name=?, username=?, pin=?, pin_hash=?, role=?, email=? WHERE id=? AND tenant_id=?',
        [name, username, '', hashSecret(pin), role, email || null, id, req.tenantId]
      )
    } else {
      await query(
        'UPDATE cashiers SET name=?, username=?, role=?, email=? WHERE id=? AND tenant_id=?',
        [name, username, role, email || null, id, req.tenantId]
      )
    }
    await logActivity(req, 'update', 'cashier', id, { name, username, role, email })
    res.json({ id, name, username, role, email })
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username sudah digunakan' })
    }
    res.status(500).json({ error: err.message })
  }
})

router.post('/cashiers/:id/telegram-link', requirePrivilegedCashier, requireTelegramNotificationPlan, async (req, res) => {
  const id = Number(req.params.id)
  if (!process.env.TELEGRAM_BOT_USERNAME || !process.env.TELEGRAM_BOT_TOKEN) {
    return res.status(503).json({ error: 'Bot Telegram belum dikonfigurasi. Set TELEGRAM_BOT_TOKEN dan TELEGRAM_BOT_USERNAME di server terlebih dahulu.' })
  }
  try {
    const token = crypto.randomBytes(16).toString('hex')
    const result = await query(
      'UPDATE cashiers SET telegram_link_token = ? WHERE id = ? AND tenant_id = ?',
      [token, id, req.tenantId]
    )
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Staf tidak ditemukan' })
    }
    await logActivity(req, 'generate_telegram_link', 'cashier', id)
    res.json({
      token,
      deepLink: `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=${token}`
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/cashiers/:id/notify-low-stock', requirePrivilegedCashier, requireTelegramNotificationPlan, async (req, res) => {
  const id = Number(req.params.id)
  const { enabled } = req.body || {}
  try {
    const result = await query(
      'UPDATE cashiers SET notify_low_stock = ? WHERE id = ? AND tenant_id = ?',
      [enabled ? 1 : 0, id, req.tenantId]
    )
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Staf tidak ditemukan' })
    }
    await logActivity(req, 'update_notify_low_stock', 'cashier', id, { enabled: !!enabled })
    res.json({ id, notifyLowStock: !!enabled })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/cashiers/:id', requirePrivilegedCashier, async (req, res) => {
  const id = Number(req.params.id)
  try {
    const target = await query('SELECT role FROM cashiers WHERE id=? AND tenant_id=?', [id, req.tenantId])
    if (target.length > 0 && String(target[0].role).toLowerCase() === 'owner') {
      return res.status(400).json({ error: 'Akun Owner tidak dapat dihapus demi alasan keamanan.' })
    }

    await query('DELETE FROM cashiers WHERE id=? AND tenant_id=?', [id, req.tenantId])
    await logActivity(req, 'delete', 'cashier', id, null)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/cashier/shifts/open', async (req, res) => {
  const { cashierId, openingCash = 0 } = req.body || {}
  if (!cashierId) return res.status(400).json({ error: 'cashierId wajib diisi' })
  try {
    const cashierCheck = await query('SELECT id FROM cashiers WHERE id=? AND tenant_id=?', [Number(cashierId), req.tenantId])
    if (!cashierCheck.length) return res.status(403).json({ error: 'Kasir tidak ditemukan' })

    const active = await query('SELECT cs.id FROM cashier_shifts cs JOIN cashiers c ON c.id = cs.cashier_id WHERE cs.end_time IS NULL AND c.tenant_id=? LIMIT 1', [req.tenantId])
    if (active.length > 0) return res.status(409).json({ error: 'Ada shift yang masih aktif' })
    const result = await query('INSERT INTO cashier_shifts (cashier_id, opening_cash) VALUES (?, ?)', [Number(cashierId), Number(openingCash)])
    res.status(201).json({ id: result.insertId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/cashier/shifts/close', async (req, res) => {
  const { closingCash = 0, notes = null } = req.body || {}
  try {
    const rows = await query('SELECT cs.id FROM cashier_shifts cs JOIN cashiers c ON c.id = cs.cashier_id WHERE cs.end_time IS NULL AND c.tenant_id=? ORDER BY cs.start_time DESC LIMIT 1', [req.tenantId])
    const active = rows[0]
    if (!active) return res.status(409).json({ error: 'Tidak ada shift aktif' })
    await query('UPDATE cashier_shifts SET closing_cash=?, end_time=NOW(), notes=? WHERE id=?', [Number(closingCash), notes, active.id])
    res.json({ id: active.id, closed: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/cashier/shifts/active', async (req, res) => {
  try {
    const rows = await query(
      `SELECT cs.id, cs.cashier_id AS cashierId, c.name AS cashierName, cs.opening_cash AS openingCash, cs.start_time AS startTime
       FROM cashier_shifts cs
       JOIN cashiers c ON c.id = cs.cashier_id
       WHERE cs.end_time IS NULL AND c.tenant_id=?
       LIMIT 1`,
      [req.tenantId]
    )
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Tidak ada shift aktif' })
    }
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/cashier/shifts', async (req, res) => {
  try {
    const rows = await query(
      `SELECT cs.id, cs.cashier_id AS cashierId, c.name AS cashierName, cs.opening_cash AS openingCash,
              cs.closing_cash AS closingCash, cs.start_time AS startTime, cs.end_time AS endTime, cs.notes
       FROM cashier_shifts cs
       JOIN cashiers c ON c.id = cs.cashier_id
       WHERE c.tenant_id=?
       ORDER BY cs.start_time DESC`,
      [req.tenantId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Pantau kasir yang sedang online (punya shift terbuka). Read-only, khusus owner/admin.
// scope=company => semua cabang milik company; selain itu => cabang aktif (req.tenantId).
router.get('/cashier/shifts/online', requirePrivilegedCashier, async (req, res) => {
  const isCompanyScope = req.query.scope === 'company'
  const branchFilter = isCompanyScope
    ? 'c.tenant_id IN (SELECT id FROM tenants WHERE company_id = ?)'
    : 'c.tenant_id = ?'
  const branchParam = isCompanyScope ? req.companyId : req.tenantId
  try {
    const rows = await query(
      `SELECT cs.id,
              cs.cashier_id       AS cashierId,
              c.name              AS cashierName,
              c.role              AS cashierRole,
              c.tenant_id         AS tenantId,
              t.name              AS branchName,
              cs.opening_cash     AS openingCash,
              cs.start_time       AS startTime,
              COUNT(DISTINCT o.id)                       AS orderCount,
              COALESCE(SUM(oi.qty * oi.price_each), 0)   AS salesTotal,
              MAX(o.created_at)                          AS lastOrderAt
       FROM cashier_shifts cs
       JOIN cashiers c ON c.id = cs.cashier_id
       JOIN tenants  t ON t.id = c.tenant_id
       LEFT JOIN orders o        ON o.shift_id = cs.id
       LEFT JOIN order_items oi  ON oi.order_id = o.id
       WHERE cs.end_time IS NULL AND ${branchFilter}
       GROUP BY cs.id, cs.cashier_id, c.name, c.role, c.tenant_id, t.name, cs.opening_cash, cs.start_time
       ORDER BY cs.start_time ASC`,
      [branchParam]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ===== MODULE & ACCESS CONTROL =====
router.get('/modules', async (_req, res) => {
  try {
    const rows = await query('SELECT id, name, label, description, icon, path FROM modules ORDER BY id')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get roles
router.get('/roles', async (_req, res) => {
  try {
    const rows = await query('SELECT id, name, description FROM roles ORDER BY name')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get user module access
router.get('/user-access/:cashierId', async (req, res) => {
  let cashierId = Number(req.params.cashierId)
  
  // Fallback: Jika frontend mengirim parameter "undefined", coba ambil identitas dari Headers
  if (!cashierId || isNaN(cashierId)) {
    cashierId = getCashierIdFromReq(req)
  }
  if (!cashierId) return res.json([])

  try {
    // [AUTO-HEAL] Jika user adalah admin/owner, pastikan mereka selalu punya akses ke seluruh modul yang ada
    const checkCashier = await query('SELECT role FROM cashiers WHERE id=? AND tenant_id=?', [cashierId, req.tenantId])
    if (checkCashier.length > 0 && ['admin', 'owner'].includes(String(checkCashier[0].role).toLowerCase())) {
      await query(
        `INSERT INTO user_module_access (cashier_id, module_id, can_view, can_create, can_edit, can_delete)
         SELECT ?, id, 1, 1, 1, 1 FROM modules
         ON DUPLICATE KEY UPDATE can_view=1, can_create=1, can_edit=1, can_delete=1`,
        [cashierId]
      )
    } else if (checkCashier.length > 0) {
      try {
        // Sync from SaaS cashier_modules
        const allowedModules = await query('SELECT module_id FROM cashier_modules WHERE cashier_id = ?', [cashierId])
        const allowedIds = allowedModules.map(m => m.module_id)

        if (allowedIds.length > 0) {
          // Insert missing modules into user_module_access. Default = akses PENUH
          // (grant modul = boleh operasikan); admin membatasi aksi lewat Manajemen
          // Akses. Penting sejak enforcement RBAC aktif agar kasir tak terputus.
          for (const moduleId of allowedIds) {
            await query(
              `INSERT IGNORE INTO user_module_access (cashier_id, module_id, can_view, can_create, can_edit, can_delete)
               VALUES (?, ?, 1, 1, 1, 1)`,
              [cashierId, moduleId]
            )
          }
          // Remove modules from user_module_access that are not in cashier_modules anymore
          await query(
            `DELETE FROM user_module_access 
             WHERE cashier_id = ? AND module_id NOT IN (${allowedIds.map(() => '?').join(',')})`,
            [cashierId, ...allowedIds]
          )
        } else {
          // No modules assigned in SaaS, remove all access in user_module_access
          await query('DELETE FROM user_module_access WHERE cashier_id = ?', [cashierId])
        }
      } catch (syncErr) {
        console.warn('[SYNC WARNING] Failed to sync from cashier_modules:', syncErr.message)
      }
    }

    const rows = await query(`
      SELECT 
        uma.id, uma.module_id AS moduleId, uma.can_view AS canView, uma.can_create AS canCreate, 
        uma.can_edit AS canEdit, uma.can_delete AS canDelete,
        m.name AS moduleName, m.label, m.path, m.icon
      FROM user_module_access uma
      JOIN modules m ON uma.module_id = m.id
      JOIN cashiers c ON c.id = uma.cashier_id
      WHERE uma.cashier_id = ? AND c.tenant_id = ?
      ORDER BY m.label
    `, [cashierId, req.tenantId])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Set user module access
router.post('/user-access/:cashierId', requirePrivilegedCashier, async (req, res) => {
  const cashierId = Number(req.params.cashierId)
  const { moduleId, canView, canCreate, canEdit, canDelete } = req.body || {}
  if (!moduleId) return res.status(400).json({ error: 'moduleId wajib diisi' })
  try {
    const check = await query('SELECT role FROM cashiers WHERE id=? AND tenant_id=?', [cashierId, req.tenantId])
    if (!check.length) return res.status(403).json({ error: 'Kasir tidak ditemukan' })

    const targetRole = String(check[0].role).toLowerCase()
    if (['admin', 'owner'].includes(targetRole)) {
      return res.status(400).json({ error: 'Hak akses akun Owner atau Admin selalu aktif penuh secara permanen dan tidak dapat dimodifikasi.' })
    }

    await query(`
      INSERT INTO user_module_access (cashier_id, module_id, can_view, can_create, can_edit, can_delete)
      VALUES (?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
        can_view=VALUES(can_view), 
        can_create=VALUES(can_create), 
        can_edit=VALUES(can_edit), 
        can_delete=VALUES(can_delete),
        updated_at=NOW()
    `, [cashierId, moduleId, canView ? 1 : 0, canCreate ? 1 : 0, canEdit ? 1 : 0, canDelete ? 1 : 0])
    await logActivity(req, 'update', 'user_access', `${cashierId}:${moduleId}`, {
      cashierId,
      moduleId,
      canView: !!canView,
      canCreate: !!canCreate,
      canEdit: !!canEdit,
      canDelete: !!canDelete
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Revoke user module access
router.delete('/user-access/:cashierId/:moduleId', requirePrivilegedCashier, async (req, res) => {
  const cashierId = Number(req.params.cashierId)
  const moduleId = Number(req.params.moduleId)
  try {
    const check = await query('SELECT role FROM cashiers WHERE id=? AND tenant_id=?', [cashierId, req.tenantId])
    if (!check.length) return res.status(403).json({ error: 'Kasir tidak ditemukan' })

    const targetRole = String(check[0].role).toLowerCase()
    if (['admin', 'owner'].includes(targetRole)) {
      return res.status(400).json({ error: 'Hak akses akun Owner atau Admin selalu aktif penuh secara permanen dan tidak dapat dimodifikasi.' })
    }

    await query('DELETE FROM user_module_access WHERE cashier_id = ? AND module_id = ?', [cashierId, moduleId])
    await logActivity(req, 'delete', 'user_access', `${cashierId}:${moduleId}`, { cashierId, moduleId })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get all user accesses
router.get('/all-user-access', async (req, res) => {
  try {
    const rows = await query(`
      SELECT 
        c.id AS cashierId, c.name AS cashierName, c.username,
        uma.module_id AS moduleId, m.label AS moduleLabel, 
        uma.can_view AS canView, uma.can_create AS canCreate, 
        uma.can_edit AS canEdit, uma.can_delete AS canDelete
      FROM cashiers c
      LEFT JOIN user_module_access uma ON c.id = uma.cashier_id
      LEFT JOIN modules m ON uma.module_id = m.id
      WHERE c.tenant_id = ?
      ORDER BY c.name, m.label
    `, [req.tenantId])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ===== VOUCHERS & DISCOUNTS =====

// 1. Get all vouchers
router.get('/vouchers', async (req, res) => {
  try {
    const rows = await query(
      'SELECT id, code, description, discount_type AS discountType, discount_value AS discountValue, min_order_amount AS minOrderAmount, max_discount_amount AS maxDiscountAmount, expiry_date AS expiryDate, usage_limit AS usageLimit, used_count AS usedCount, is_active AS isActive, created_at AS createdAt FROM vouchers WHERE tenant_id = ? ORDER BY created_at DESC',
      [req.tenantId]
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 2. Create voucher
router.post('/vouchers', requirePrivilegedCashier, async (req, res) => {
  const { code, description, discountType, discountValue, minOrderAmount = 0, maxDiscountAmount = null, expiryDate = null, usageLimit = null } = req.body || {}
  if (!code || !discountType || discountValue === undefined) {
    return res.status(400).json({ error: 'code, discountType, dan discountValue wajib diisi' })
  }
  try {
    const result = await query(
      'INSERT INTO vouchers (code, description, discount_type, discount_value, min_order_amount, max_discount_amount, expiry_date, usage_limit, is_active, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)',
      [
        String(code).trim().toUpperCase(),
        description || null,
        discountType,
        Number(discountValue),
        Number(minOrderAmount),
        maxDiscountAmount ? Number(maxDiscountAmount) : null,
        expiryDate || null,
        usageLimit ? Number(usageLimit) : null,
        req.tenantId
      ]
    )
    await logActivity(req, 'create', 'voucher', result.insertId, { code, discountType, discountValue })
    res.status(201).json({ id: result.insertId, code: String(code).trim().toUpperCase() })
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Kode voucher sudah digunakan di outlet ini' })
    }
    res.status(500).json({ error: err.message })
  }
})

// 3. Update voucher
router.put('/vouchers/:id', requirePrivilegedCashier, async (req, res) => {
  const id = Number(req.params.id)
  const { code, description, discountType, discountValue, minOrderAmount = 0, maxDiscountAmount = null, expiryDate = null, usageLimit = null, isActive = 1 } = req.body || {}
  if (!code || !discountType || discountValue === undefined) {
    return res.status(400).json({ error: 'code, discountType, dan discountValue wajib diisi' })
  }
  try {
    const check = await query('SELECT id FROM vouchers WHERE id=? AND tenant_id=?', [id, req.tenantId])
    if (!check.length) return res.status(404).json({ error: 'Voucher tidak ditemukan' })

    await query(
      'UPDATE vouchers SET code=?, description=?, discount_type=?, discount_value=?, min_order_amount=?, max_discount_amount=?, expiry_date=?, usage_limit=?, is_active=? WHERE id=? AND tenant_id=?',
      [
        String(code).trim().toUpperCase(),
        description || null,
        discountType,
        Number(discountValue),
        Number(minOrderAmount),
        maxDiscountAmount ? Number(maxDiscountAmount) : null,
        expiryDate || null,
        usageLimit ? Number(usageLimit) : null,
        isActive ? 1 : 0,
        id,
        req.tenantId
      ]
    )
    await logActivity(req, 'update', 'voucher', id, { code, discountType, discountValue })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 4. Delete voucher
router.delete('/vouchers/:id', requirePrivilegedCashier, async (req, res) => {
  const id = Number(req.params.id)
  try {
    const check = await query('SELECT code FROM vouchers WHERE id=? AND tenant_id=?', [id, req.tenantId])
    if (!check.length) return res.status(404).json({ error: 'Voucher tidak ditemukan' })

    await query('DELETE FROM vouchers WHERE id=? AND tenant_id=?', [id, req.tenantId])
    await logActivity(req, 'delete', 'voucher', id, { code: check[0].code })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// 5. Validate voucher code
router.post('/vouchers/validate', async (req, res) => {
  const { code, orderAmount } = req.body || {}
  if (!code || orderAmount === undefined) {
    return res.status(400).json({ error: 'code dan orderAmount wajib diisi' })
  }
  try {
    const cleanCode = String(code).trim().toUpperCase()
    const rows = await query(
      'SELECT id, code, discount_type, discount_value, min_order_amount, max_discount_amount, expiry_date, usage_limit, used_count, is_active FROM vouchers WHERE code = ? AND tenant_id = ? LIMIT 1',
      [cleanCode, req.tenantId]
    )

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Kode voucher tidak valid atau tidak ditemukan' })
    }

    const v = rows[0]

    if (v.is_active !== 1) {
      return res.status(400).json({ error: 'Voucher saat ini tidak aktif' })
    }

    if (v.expiry_date && new Date(v.expiry_date) < new Date()) {
      return res.status(400).json({ error: 'Voucher telah kedaluwarsa' })
    }

    if (v.usage_limit !== null && v.used_count >= v.usage_limit) {
      return res.status(400).json({ error: 'Kuota penggunaan voucher telah habis' })
    }

    const subtotal = Number(orderAmount)
    if (subtotal < Number(v.min_order_amount)) {
      return res.status(400).json({ error: `Minimal belanja untuk menggunakan voucher ini adalah Rp ${Number(v.min_order_amount).toLocaleString('id-ID')}` })
    }

    // Hitung diskon
    let discountAmount = 0
    if (v.discount_type === 'fixed') {
      discountAmount = Number(v.discount_value)
    } else {
      // Percentage
      discountAmount = Math.round((subtotal * Number(v.discount_value)) / 100)
      if (v.max_discount_amount !== null && discountAmount > Number(v.max_discount_amount)) {
        discountAmount = Number(v.max_discount_amount)
      }
    }

    // Nominal diskon tidak boleh melebihi nilai belanjaan
    if (discountAmount > subtotal) {
      discountAmount = subtotal
    }

    res.json({
      valid: true,
      voucherId: v.id,
      code: v.code,
      discountType: v.discount_type,
      discountValue: v.discount_value,
      discountAmount: discountAmount
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
