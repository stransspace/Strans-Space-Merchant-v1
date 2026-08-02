import path from 'path'
import { fileURLToPath } from 'url'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(currentDir, '..')
const envPath = path.join(root, '.env')
dotenv.config({ path: envPath })

const {
  DB_HOST = 'localhost',
  DB_PORT = 3306,
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'pos_coffe',
} = process.env

const orders = [
  {
    cash: 200000,
    paymentMethod: 'tunai',
    items: [
      { id: 'cf-latte', qty: 2, price: 32000 },
      { id: 'cf-kopi-susu', qty: 1, price: 28000 },
      { id: 'fd-croissant', qty: 1, price: 24000 },
    ],
  },
  {
    cash: 120000,
    paymentMethod: 'debit',
    items: [
      { id: 'cf-esp', qty: 2, price: 18000 },
      { id: 'cf-capp', qty: 1, price: 30000 },
      { id: 'fd-brownie', qty: 2, price: 26000 },
    ],
  },
  {
    cash: 90000,
    paymentMethod: 'qris',
    items: [
      { id: 'cf-matcha', qty: 1, price: 34000 },
      { id: 'cf-iced-tea', qty: 1, price: 18000 },
      { id: 'fd-cheese', qty: 1, price: 32000 },
    ],
  },
]

async function main() {
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true,
  })

  try {
    for (const order of orders) {
      const [orderResult] = await connection.execute(
        'INSERT INTO orders (cash, payment_method) VALUES (?, ?)',
        [order.cash, order.paymentMethod || 'tunai'],
      )
      const orderId = orderResult.insertId

      for (const item of order.items) {
        await connection.execute(
          'INSERT INTO order_items (order_id, menu_item_id, qty, price_each) VALUES (?, ?, ?, ?)',
          [orderId, item.id, item.qty, item.price],
        )
      }
    }
    // eslint-disable-next-line no-console
    console.log(`Seeded ${orders.length} dummy orders into ${DB_NAME}`)
  } finally {
    await connection.end()
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err.message)
  process.exit(1)
})
