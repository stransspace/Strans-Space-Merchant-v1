import mysql from 'mysql2/promise.js'
import dotenv from 'dotenv'

dotenv.config()

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pos_coffe',
})

const conn = await pool.getConnection()

// Show variants for Caffe Latte
const [variants] = await conn.execute('SELECT * FROM variants WHERE menu_item_id = ? LIMIT 3', ['cf-latte'])
console.log('Varian Caffe Latte:')
variants.forEach(v => console.log(`  - ${v.name}: Rp. ${v.price.toLocaleString('id-ID')} (${v.description})`))

console.log()

// Show variants for Espresso
const [espresso] = await conn.execute('SELECT * FROM variants WHERE menu_item_id = ?', ['cf-esp'])
console.log('Varian Espresso:')
espresso.forEach(v => console.log(`  - ${v.name}: Rp. ${v.price.toLocaleString('id-ID')} (${v.description})`))

console.log()

// Count total variants
const [count] = await conn.execute('SELECT COUNT(*) as total FROM variants')
console.log(`Total varian: ${count[0].total}`)

await conn.release()
await pool.end()
