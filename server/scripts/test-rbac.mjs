// Uji ringkas enforcement RBAC merchant (POST /items = produk/create). Server harus jalan.
// BASE=http://localhost:3801 node scripts/test-rbac.mjs
import dotenv from 'dotenv'
import path from 'path'
import crypto from 'crypto'
import { fileURLToPath } from 'url'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })
const { query } = await import('../src/db.js')
const BASE = process.env.BASE || 'http://localhost:3801'
const SECRET = process.env.CASHIER_TOKEN_SECRET || 'dev-secret-change-me'
const TTL = 30 * 24 * 60 * 60 * 1000
const signToken = ({ sub, role, tenantId, companyId }) => {
  const p = { sub, username: 'rbac', role, tenantId, companyId, exp: Date.now() + TTL }
  const enc = Buffer.from(JSON.stringify(p)).toString('base64url')
  return `${enc}.${crypto.createHmac('sha256', SECRET).update(enc).digest('base64url')}`
}
const api = (token, tenantId) => async (method, ep, body) => {
  const res = await fetch(`${BASE}/api${ep}`, { method, headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': String(tenantId), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  return res.status
}
let pass = 0, fail = 0
const check = (l, c, d = '') => { if (c) { pass++; console.log(`  ✅ ${l}`) } else { fail++; console.log(`  ❌ ${l} — ${d}`) } }
const run = async () => {
  let companyId, tenantId, owner, full, restr
  try {
    const comp = await query('INSERT INTO companies (name, subscription_plan, is_active) VALUES (?, ?, 1)', ['RbacM', 'premium'])
    companyId = comp.insertId
    const ten = await query('INSERT INTO tenants (name, domain, subscription_plan, is_active, activation_code, company_id) VALUES (?, ?, ?, 1, ?, ?)', ['RbacM', `_rbacm_${Date.now()}`, 'premium', crypto.randomBytes(4).toString('hex'), companyId])
    tenantId = ten.insertId
    const mk = async (name, role) => { const r = await query('INSERT INTO cashiers (name, username, pin, pin_hash, role, tenant_id) VALUES (?, ?, ?, ?, ?, ?)', [name, name + Date.now(), '', 'scrypt$x$y', role, tenantId]); return { id: r.insertId, token: signToken({ sub: r.insertId, role, tenantId, companyId }) } }
    owner = await mk('Owner', 'owner'); full = await mk('Full', 'kasir'); restr = await mk('Restr', 'kasir')
    const mods = await query("SELECT id, name FROM modules WHERE name='produk'")
    if (!mods.length) throw new Error('modul produk tak ada')
    const produk = mods[0].id
    await query('INSERT INTO user_module_access (cashier_id, module_id, can_view, can_create, can_edit, can_delete) VALUES (?, ?, 1, 1, 1, 1)', [full.id, produk])
    // restr: tanpa baris produk
    const O = api(owner.token, tenantId), F = api(full.token, tenantId), R = api(restr.token, tenantId)
    console.log(`Tenant=${tenantId}\n== POST /items (produk/create) ==`)
    check('Owner bypass ≠403', await O('POST', '/items', {}) !== 403)
    check('Full lolos ≠403', await F('POST', '/items', {}) !== 403)
    check('Restr DIBLOKIR =403', await R('POST', '/items', {}) === 403)
    console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`)
  } catch (e) { console.error('ERR', e); fail++ }
  finally {
    if (owner) await query('DELETE FROM user_module_access WHERE cashier_id IN (?,?,?)', [owner.id, full.id, restr.id])
    if (tenantId) { await query('DELETE FROM cashiers WHERE tenant_id=?', [tenantId]); await query('DELETE FROM tenants WHERE id=?', [tenantId]) }
    if (companyId) await query('DELETE FROM companies WHERE id=?', [companyId])
    console.log('cleanup selesai'); process.exit(fail === 0 ? 0 : 1)
  }
}
run()
