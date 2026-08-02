import path from 'path'
import { fileURLToPath } from 'url'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const {
  DB_HOST = '127.0.0.1',
  DB_PORT = 3306,
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'pos_coffe',
} = process.env

// A small menu list (will be upserted)
const menuItems = [
  ['cf-latte', 'Caffe Latte', 32000, 'Kopi', 'Signature'],
  ['cf-esp', 'Espresso', 18000, 'Kopi', 'Single'],
  ['cf-capp', 'Cappuccino', 30000, 'Kopi', 'Foamy'],
  ['cf-mocha', 'Mocha', 34000, 'Kopi', 'Cokelat'],
  ['fd-croissant', 'Croissant Butter', 24000, 'Pastry', 'Oven'],
  ['fd-brownie', 'Brownies', 26000, 'Pastry', 'Fudgy'],
]

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function main() {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  })

  try {
    // upsert menu items
    for (const [id, name, price, category, tag] of menuItems) {
      await conn.execute(
        `INSERT INTO menu_items (id, name, price, category, tag) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), price = VALUES(price), category = VALUES(category), tag = VALUES(tag)`,
        [id, name, price, category, tag],
      )
    }

    // fetch available menu ids
    const [rows] = await conn.execute('SELECT id, price FROM menu_items')
    const menu = rows.map((r) => ({ id: r.id, price: r.price }))
    if (!menu.length) {
      console.error('No menu items found after seeding; aborting')
      return
    }

    // generate orders for last 30 days
    const days = 30
    let totalOrders = 0
    for (let d = 0; d < days; d++) {
      const date = new Date()
      date.setDate(date.getDate() - d)
      // add random number of orders for that day
      const ordersCount = randInt(0, 6)
      for (let i = 0; i < ordersCount; i++) {
        const itemsCount = randInt(1, 4)
        const chosen = []
        let cash = 0
        for (let k = 0; k < itemsCount; k++) {
          const m = menu[randInt(0, menu.length - 1)]
          const qty = randInt(1, 3)
          chosen.push({ id: m.id, qty, price: m.price })
          cash += m.price * qty
        }

        // random payment method
        const methods = ['tunai', 'debit', 'qris']
        const payment = methods[randInt(0, methods.length - 1)]

        // insert order with created_at
        const [res] = await conn.execute(
          'INSERT INTO orders (cash, payment_method, created_at) VALUES (?, ?, ?)',
          [cash, payment, date.toISOString().slice(0, 19).replace('T', ' ')],
        )
        const orderId = res.insertId

        for (const it of chosen) {
          await conn.execute(
            'INSERT INTO order_items (order_id, menu_item_id, qty, price_each, created_at) VALUES (?, ?, ?, ?, ?)',
            [orderId, it.id, it.qty, it.price, date.toISOString().slice(0, 19).replace('T', ' ')],
          )
        }

        totalOrders++
      }
    }

    console.log(`Seeded ${totalOrders} orders over ${days} days into ${DB_NAME}`)
  } finally {
    await conn.end()
  }
}

main().catch((err) => {
  console.error('Seeding failed:', err.message)
  process.exit(1)
})
