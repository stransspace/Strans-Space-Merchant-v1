// Regression test: gating paket server-authoritative.
// Membuat tenant sementara (free & standard), menandatangani token owner,
// lalu memanggil endpoint ter-gate & bebas, memastikan 403/200 sesuai paket.
//
// Prasyarat: server merchant berjalan. Set BASE (default http://localhost:3801).
// Pakai: node scripts/test-plan-access.mjs

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
  const payload = { sub, username: 'acltest', role, tenantId, companyId, exp: Date.now() + TTL }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url')
  return `${encoded}.${sig}`
}

async function makeTenant(plan) {
  const tag = `_acltest_${plan}_${Date.now()}`
  const comp = await query('INSERT INTO companies (name, subscription_plan, is_active) VALUES (?, ?, 1)', [`ACL ${plan}`, plan])
  const companyId = comp.insertId
  const code = crypto.randomBytes(4).toString('hex').toUpperCase()
  const ten = await query(
    'INSERT INTO tenants (name, domain, subscription_plan, is_active, activation_code, company_id) VALUES (?, ?, ?, 1, ?, ?)',
    [`ACL ${plan}`, tag, plan, code, companyId]
  )
  const tenantId = ten.insertId
  const token = signToken({ sub: 999999, role: 'owner', tenantId, companyId })
  return { plan, companyId, tenantId, token }
}

async function cleanup(t) {
  if (!t) return
  await query('DELETE FROM tenants WHERE id=?', [t.tenantId])
  await query('DELETE FROM companies WHERE id=?', [t.companyId])
}

async function hit(t, method, endpoint) {
  const res = await fetch(`${BASE}/api${endpoint}`, {
    method,
    headers: { Authorization: `Bearer ${t.token}`, 'x-tenant-id': String(t.tenantId), 'Content-Type': 'application/json' },
  })
  return res.status
}

// endpoint, minPlan(1=standard,2=premium,0=bebas)
const GATED = [
  ['GET', '/vouchers', 1],
  ['GET', '/materials', 1],
  ['GET', '/expenses', 1],
  ['GET', '/reports/materials/summary', 1],
  ['GET', '/reports/expenses/summary', 1],
  ['GET', '/activity-logs', 2],
  ['GET', '/reports/profit-loss', 2],
]
const FREEBIE = [
  ['GET', '/reports/daily', 0],
  ['GET', '/vouchers/validate/NOPE', 0], // validate dikecualikan dari gating
]

const run = async () => {
  let free, std, prem
  try {
    free = await makeTenant('free')
    std = await makeTenant('standard')
    prem = await makeTenant('premium')
    console.log(`Tenants: free=${free.tenantId} standard=${std.tenantId} premium=${prem.tenantId}\n`)

    let pass = 0, fail = 0
    const check = (label, cond, detail) => { if (cond) { pass++; console.log(`  ✅ ${label}`) } else { fail++; console.log(`  ❌ ${label} — ${detail}`) } }

    console.log('== Endpoint ter-gate ==')
    for (const [m, ep, min] of GATED) {
      const sFree = await hit(free, m, ep)
      const sStd = await hit(std, m, ep)
      const sPrem = await hit(prem, m, ep)
      // free selalu di bawah -> 403
      check(`${m} ${ep} | free=403`, sFree === 403, `dapat ${sFree}`)
      // standard: 403 hanya bila butuh premium(2)
      if (min >= 2) check(`${m} ${ep} | standard=403 (butuh premium)`, sStd === 403, `dapat ${sStd}`)
      else check(`${m} ${ep} | standard≠403`, sStd !== 403, `dapat ${sStd}`)
      // premium: tak pernah 403 karena paket
      check(`${m} ${ep} | premium≠403`, sPrem !== 403, `dapat ${sPrem}`)
    }

    console.log('\n== Endpoint bebas (tak boleh 403 karena paket) ==')
    for (const [m, ep] of FREEBIE) {
      const sFree = await hit(free, m, ep)
      check(`${m} ${ep} | free≠403`, sFree !== 403, `dapat ${sFree}`)
    }

    console.log(`\nHASIL: ${pass} lulus, ${fail} gagal`)
    process.exitCode = fail === 0 ? 0 : 1
  } catch (e) {
    console.error('ERR', e)
    process.exitCode = 2
  } finally {
    await cleanup(free); await cleanup(std); await cleanup(prem)
    console.log('cleanup selesai')
    process.exit(process.exitCode)
  }
}
run()
