import mysql from 'mysql2/promise.js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import path from 'path'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pos_coffe',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

async function seedOrdersWithVariants() {
  let connection
  try {
    connection = await pool.getConnection()
    console.log('✓ Terhubung ke database')

    // Hapus orders lama dan order_items
    await connection.execute('DELETE FROM order_items')
    await connection.execute('DELETE FROM orders')
    console.log('✓ Data transaksi lama dihapus')

    // Ambil variant IDs untuk setiap produk
    const [variants] = await connection.execute('SELECT id, menu_item_id, name, price FROM variants ORDER BY menu_item_id, name')
    const variantMap = {}
    variants.forEach(v => {
      if (!variantMap[v.menu_item_id]) {
        variantMap[v.menu_item_id] = []
      }
      variantMap[v.menu_item_id].push(v)
    })

    // Dummy orders dengan varian
    const orders = [
      {
        cash: 100000,
        payment_method: 'tunai',
        items: [
          { menu_item_id: 'cf-latte', qty: 1, variantIndex: 1 }, // Medium
          { menu_item_id: 'fd-croissant', qty: 2, variantIndex: 0 }, // Single
        ]
      },
      {
        cash: 50000,
        payment_method: 'debit',
        items: [
          { menu_item_id: 'cf-esp', qty: 2, variantIndex: 0 }, // Single Shot
          { menu_item_id: 'cf-v60', qty: 1, variantIndex: 0 }, // Single Cup
        ]
      },
      {
        cash: 150000,
        payment_method: 'tunai',
        items: [
          { menu_item_id: 'cf-capp', qty: 1, variantIndex: 2 }, // Large
          { menu_item_id: 'cf-mocha', qty: 1, variantIndex: 1 }, // Medium
          { menu_item_id: 'fd-brownie', qty: 1, variantIndex: 0 }, // Single
          { menu_item_id: 'cf-vanilla', qty: 2, variantIndex: 0 }, // Small
        ]
      },
      {
        cash: 80000,
        payment_method: 'qris',
        items: [
          { menu_item_id: 'cf-caramel', qty: 1, variantIndex: 1 }, // Medium
          { menu_item_id: 'cf-iced-tea', qty: 1, variantIndex: 2 }, // Large
          { menu_item_id: 'fd-sandwich', qty: 1, variantIndex: 0 }, // Single
        ]
      },
      {
        cash: 120000,
        payment_method: 'transfer',
        items: [
          { menu_item_id: 'cf-matcha', qty: 2, variantIndex: 1 }, // Medium
          { menu_item_id: 'fd-cheese', qty: 1, variantIndex: 0 }, // Single Slice
        ]
      },
      {
        cash: 70000,
        payment_method: 'tunai',
        items: [
          { menu_item_id: 'cf-kopi-susu', qty: 1, variantIndex: 2 }, // Large
          { menu_item_id: 'cf-choco', qty: 1, variantIndex: 1 }, // Medium
          { menu_item_id: 'cf-lemon-tea', qty: 1, variantIndex: 0 }, // Small
        ]
      },
      {
        cash: 95000,
        payment_method: 'debit',
        items: [
          { menu_item_id: 'cf-latte', qty: 2, variantIndex: 0 }, // Small
          { menu_item_id: 'fd-brownie', qty: 1, variantIndex: 1 }, // Box 3pcs
        ]
      },
      {
        cash: 200000,
        payment_method: 'qris',
        items: [
          { menu_item_id: 'cf-capp', qty: 1, variantIndex: 1 }, // Medium
          { menu_item_id: 'cf-mocha', qty: 1, variantIndex: 0 }, // Small
          { menu_item_id: 'cf-esp', qty: 1, variantIndex: 1 }, // Double Shot
          { menu_item_id: 'fd-croissant', qty: 3, variantIndex: 0 }, // Single
          { menu_item_id: 'fd-sandwich', qty: 1, variantIndex: 1 }, // Combo
        ]
      },
    ]

    let totalItems = 0

    for (const order of orders) {
      // Insert order
      const [result] = await connection.execute(
        'INSERT INTO orders (cash, payment_method) VALUES (?, ?)',
        [order.cash, order.payment_method]
      )

      const orderId = result.insertId

      // Insert order items dengan varian
      for (const item of order.items) {
        const variants = variantMap[item.menu_item_id]
        if (!variants || variants.length === 0) {
          console.warn(`⚠ Tidak ada varian untuk ${item.menu_item_id}`)
          continue
        }

        const variant = variants[item.variantIndex] || variants[0]
        const price = variant.price

        await connection.execute(
          'INSERT INTO order_items (order_id, menu_item_id, variant_id, qty, price_each) VALUES (?, ?, ?, ?, ?)',
          [orderId, item.menu_item_id, variant.id, item.qty, price]
        )

        totalItems++
      }
    }

    console.log(`✓ ${orders.length} transaksi berhasil ditambahkan`)
    console.log(`✓ ${totalItems} item dengan varian berhasil ditambahkan`)
    
    console.log('\n📊 Ringkasan Transaksi:')
    const [summary] = await connection.execute(`
      SELECT 
        o.id as order_id,
        o.payment_method,
        o.cash,
        COUNT(oi.id) as total_items,
        SUM(oi.qty * oi.price_each) as total_price
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      GROUP BY o.id, o.payment_method, o.cash
      ORDER BY o.id
    `)

    summary.forEach(s => {
      console.log(`   Order #${s.order_id} | ${s.payment_method} | ${s.total_items} items | Total: Rp. ${s.total_price.toLocaleString('id-ID')}`)
    })

  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  } finally {
    if (connection) await connection.release()
    await pool.end()
  }
}

seedOrdersWithVariants()
