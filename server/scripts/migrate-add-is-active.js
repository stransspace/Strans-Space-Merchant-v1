import dotenv from 'dotenv'
import { query } from '../src/db.js'

dotenv.config()

async function ensureIsActiveColumn() {
  const dbName = process.env.DB_NAME || 'pos_coffe'
  const checkSql = `SELECT COUNT(*) AS cnt FROM information_schema.columns 
    WHERE table_schema=? AND table_name='menu_items' AND column_name='is_active'`
  const rows = await query(checkSql, [dbName])
  const exists = Array.isArray(rows) && rows.length ? Number(rows[0].cnt) > 0 : false

  if (exists) {
    console.log('Column is_active already exists.')
    return
  }

  console.log('Adding is_active column to menu_items...')
  await query("ALTER TABLE menu_items ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1")
  await query("UPDATE menu_items SET is_active=1 WHERE is_active IS NULL")
  console.log('Migration done.')
}

ensureIsActiveColumn().then(() => process.exit(0)).catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
