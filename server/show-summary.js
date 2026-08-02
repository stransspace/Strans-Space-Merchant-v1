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

// Show all data
const [items] = await conn.execute('SELECT COUNT(*) as total FROM menu_items')
const [variants] = await conn.execute('SELECT COUNT(*) as total FROM variants')
const [orders] = await conn.execute('SELECT COUNT(*) as total FROM orders')
const [orderItems] = await conn.execute('SELECT COUNT(*) as total FROM order_items')

console.log('\n📊 Database Summary:')
console.log(`   Products: ${items[0].total}`)
console.log(`   Variants: ${variants[0].total}`)
console.log(`   Orders: ${orders[0].total}`)
console.log(`   Order Items (dengan varian): ${orderItems[0].total}`)

// Show detail untuk order tertentu
console.log('\n📋 Detail Transaksi:')
const [details] = await conn.execute(`
  SELECT 
    o.id,
    o.payment_method,
    COUNT(oi.id) as total_items,
    SUM(oi.qty * oi.price_each) as total_price
  FROM orders o
  LEFT JOIN order_items oi ON o.id = oi.order_id
  GROUP BY o.id, o.payment_method
  ORDER BY o.id
`)

details.forEach(d => {
  console.log(`   Order #${d.id} | ${d.payment_method} | ${d.total_items} items | Rp. ${d.total_price.toLocaleString('id-ID')}`)
})

console.log('\n✅ Setup Complete!')

await conn.release()
await pool.end()
