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

const materials = [
  { name: 'Biji Kopi Arabika', unit: 'GR', min: 500, max: 5000, priceMin: 2.5, priceMax: 6 },
  { name: 'Biji Kopi Robusta', unit: 'GR', min: 500, max: 5000, priceMin: 2, priceMax: 5 },
  { name: 'Susu UHT', unit: 'Liter', min: 10, max: 50, priceMin: 12000, priceMax: 18000 },
  { name: 'Gula Aren', unit: 'PCS', min: 20, max: 100, priceMin: 2000, priceMax: 5000 },
  { name: 'Gula Pasir', unit: 'GR', min: 1000, max: 5000, priceMin: 0.01, priceMax: 0.03 },
  { name: 'Sirup Vanilla', unit: 'ML', min: 500, max: 2000, priceMin: 25, priceMax: 60 },
  { name: 'Sirup Caramel', unit: 'ML', min: 500, max: 2000, priceMin: 25, priceMax: 60 },
  { name: 'Cokelat Bubuk', unit: 'GR', min: 500, max: 3000, priceMin: 0.12, priceMax: 0.35 },
  { name: 'Teh Celup', unit: 'PCS', min: 50, max: 200, priceMin: 400, priceMax: 900 },
  { name: 'Lemon', unit: 'SLICE', min: 20, max: 100, priceMin: 600, priceMax: 1500 },
  { name: 'Tepung Terigu', unit: 'GR', min: 1000, max: 8000, priceMin: 0.01, priceMax: 0.03 },
  { name: 'Mentega', unit: 'GR', min: 500, max: 3000, priceMin: 0.08, priceMax: 0.2 },
  { name: 'Telur', unit: 'PCS', min: 50, max: 300, priceMin: 1500, priceMax: 3000 },
  { name: 'Keju', unit: 'GR', min: 500, max: 3000, priceMin: 0.12, priceMax: 0.3 },
  { name: 'Ayam', unit: 'GR', min: 1000, max: 6000, priceMin: 0.08, priceMax: 0.2 },
  { name: 'Selada', unit: 'GR', min: 300, max: 1500, priceMin: 0.05, priceMax: 0.12 },
  { name: 'Mayones', unit: 'GR', min: 500, max: 2000, priceMin: 0.04, priceMax: 0.1 },
  { name: 'Roti', unit: 'PCS', min: 50, max: 200, priceMin: 2000, priceMax: 5000 },
  { name: 'Cup Plastik 12oz', unit: 'PCS', min: 200, max: 2000, priceMin: 400, priceMax: 900 },
  { name: 'Cup Plastik 16oz', unit: 'PCS', min: 200, max: 2000, priceMin: 500, priceMax: 1100 },
  { name: 'Lid Cup', unit: 'PCS', min: 200, max: 2000, priceMin: 200, priceMax: 500 },
  { name: 'Sedotan', unit: 'PCS', min: 500, max: 5000, priceMin: 50, priceMax: 200 },
  { name: 'Sendok', unit: 'PCS', min: 200, max: 2000, priceMin: 150, priceMax: 400 },
  { name: 'Garpu', unit: 'PCS', min: 200, max: 2000, priceMin: 150, priceMax: 400 },
  { name: 'Pisau Plastik', unit: 'PCS', min: 200, max: 2000, priceMin: 150, priceMax: 400 },
  { name: 'Kantong Plastik', unit: 'PCS', min: 200, max: 2000, priceMin: 200, priceMax: 600 },
  { name: 'Tisu', unit: 'PCS', min: 500, max: 5000, priceMin: 50, priceMax: 150 },
]

// Link some default materials to products with qty
const productLinks = [
  { menu_item_id: 'cf-esp', items: [
    { ref: 'Biji Kopi Arabika', qty: 18 },
  ]},
  { menu_item_id: 'cf-latte', items: [
    { ref: 'Biji Kopi Arabika', qty: 18 },
    { ref: 'Susu UHT', qty: 0.2 },
  ]},
  { menu_item_id: 'cf-capp', items: [
    { ref: 'Biji Kopi Arabika', qty: 18 },
    { ref: 'Susu UHT', qty: 0.2 },
  ]},
  { menu_item_id: 'cf-mocha', items: [
    { ref: 'Biji Kopi Arabika', qty: 18 },
    { ref: 'Susu UHT', qty: 0.2 },
    { ref: 'Cokelat Bubuk', qty: 10 },
  ]},
  { menu_item_id: 'cf-vanilla', items: [
    { ref: 'Biji Kopi Arabika', qty: 18 },
    { ref: 'Susu UHT', qty: 0.2 },
    { ref: 'Sirup Vanilla', qty: 15 },
  ]},
  { menu_item_id: 'cf-caramel', items: [
    { ref: 'Biji Kopi Arabika', qty: 18 },
    { ref: 'Susu UHT', qty: 0.2 },
    { ref: 'Sirup Caramel', qty: 15 },
  ]},
  { menu_item_id: 'cf-kopi-susu', items: [
    { ref: 'Biji Kopi Arabika', qty: 18 },
    { ref: 'Susu UHT', qty: 0.2 },
    { ref: 'Gula Aren', qty: 1 },
  ]},
  { menu_item_id: 'cf-v60', items: [
    { ref: 'Biji Kopi Arabika', qty: 20 },
  ]},
  { menu_item_id: 'cf-choco', items: [
    { ref: 'Susu UHT', qty: 0.25 },
    { ref: 'Cokelat Bubuk', qty: 12 },
  ]},
  { menu_item_id: 'cf-matcha', items: [
    { ref: 'Susu UHT', qty: 0.25 },
  ]},
  { menu_item_id: 'cf-iced-tea', items: [
    { ref: 'Teh Celup', qty: 1 },
    { ref: 'Gula Pasir', qty: 15 },
  ]},
  { menu_item_id: 'cf-lemon-tea', items: [
    { ref: 'Teh Celup', qty: 1 },
    { ref: 'Lemon', qty: 1 },
    { ref: 'Gula Pasir', qty: 15 },
  ]},
  { menu_item_id: 'fd-croissant', items: [
    { ref: 'Tepung Terigu', qty: 80 },
    { ref: 'Mentega', qty: 40 },
    { ref: 'Telur', qty: 1 },
  ]},
  { menu_item_id: 'fd-brownie', items: [
    { ref: 'Tepung Terigu', qty: 60 },
    { ref: 'Cokelat Bubuk', qty: 20 },
    { ref: 'Mentega', qty: 30 },
    { ref: 'Telur', qty: 1 },
    { ref: 'Gula Pasir', qty: 30 },
  ]},
  { menu_item_id: 'fd-cheese', items: [
    { ref: 'Keju', qty: 40 },
    { ref: 'Susu UHT', qty: 0.15 },
    { ref: 'Telur', qty: 1 },
    { ref: 'Gula Pasir', qty: 20 },
  ]},
  { menu_item_id: 'fd-sandwich', items: [
    { ref: 'Roti', qty: 2 },
    { ref: 'Ayam', qty: 80 },
    { ref: 'Selada', qty: 20 },
    { ref: 'Mayones', qty: 15 },
    { ref: 'Kantong Plastik', qty: 1 },
    { ref: 'Tisu', qty: 2 },
  ]},
  { menu_item_id: 'cf-esp', items: [
    { ref: 'Cup Plastik 12oz', qty: 1 },
    { ref: 'Lid Cup', qty: 1 },
    { ref: 'Sedotan', qty: 1 },
    { ref: 'Tisu', qty: 1 },
  ]},
  { menu_item_id: 'cf-latte', items: [
    { ref: 'Cup Plastik 12oz', qty: 1 },
    { ref: 'Lid Cup', qty: 1 },
    { ref: 'Sedotan', qty: 1 },
    { ref: 'Tisu', qty: 1 },
  ]},
  { menu_item_id: 'cf-capp', items: [
    { ref: 'Cup Plastik 12oz', qty: 1 },
    { ref: 'Lid Cup', qty: 1 },
    { ref: 'Sedotan', qty: 1 },
    { ref: 'Tisu', qty: 1 },
  ]},
  { menu_item_id: 'cf-mocha', items: [
    { ref: 'Cup Plastik 16oz', qty: 1 },
    { ref: 'Lid Cup', qty: 1 },
    { ref: 'Sedotan', qty: 1 },
    { ref: 'Tisu', qty: 1 },
  ]},
  { menu_item_id: 'cf-vanilla', items: [
    { ref: 'Cup Plastik 16oz', qty: 1 },
    { ref: 'Lid Cup', qty: 1 },
    { ref: 'Sedotan', qty: 1 },
    { ref: 'Tisu', qty: 1 },
  ]},
  { menu_item_id: 'cf-caramel', items: [
    { ref: 'Cup Plastik 16oz', qty: 1 },
    { ref: 'Lid Cup', qty: 1 },
    { ref: 'Sedotan', qty: 1 },
    { ref: 'Tisu', qty: 1 },
  ]},
  { menu_item_id: 'cf-kopi-susu', items: [
    { ref: 'Cup Plastik 12oz', qty: 1 },
    { ref: 'Lid Cup', qty: 1 },
    { ref: 'Sedotan', qty: 1 },
    { ref: 'Tisu', qty: 1 },
  ]},
  { menu_item_id: 'cf-v60', items: [
    { ref: 'Cup Plastik 12oz', qty: 1 },
    { ref: 'Lid Cup', qty: 1 },
    { ref: 'Sedotan', qty: 1 },
    { ref: 'Tisu', qty: 1 },
  ]},
  { menu_item_id: 'cf-choco', items: [
    { ref: 'Cup Plastik 16oz', qty: 1 },
    { ref: 'Lid Cup', qty: 1 },
    { ref: 'Sedotan', qty: 1 },
    { ref: 'Tisu', qty: 1 },
  ]},
  { menu_item_id: 'cf-matcha', items: [
    { ref: 'Cup Plastik 16oz', qty: 1 },
    { ref: 'Lid Cup', qty: 1 },
    { ref: 'Sedotan', qty: 1 },
    { ref: 'Tisu', qty: 1 },
  ]},
  { menu_item_id: 'cf-iced-tea', items: [
    { ref: 'Cup Plastik 16oz', qty: 1 },
    { ref: 'Lid Cup', qty: 1 },
    { ref: 'Sedotan', qty: 1 },
    { ref: 'Tisu', qty: 1 },
  ]},
  { menu_item_id: 'cf-lemon-tea', items: [
    { ref: 'Cup Plastik 16oz', qty: 1 },
    { ref: 'Lid Cup', qty: 1 },
    { ref: 'Sedotan', qty: 1 },
    { ref: 'Tisu', qty: 1 },
  ]},
  { menu_item_id: 'fd-croissant', items: [
    { ref: 'Kantong Plastik', qty: 1 },
    { ref: 'Tisu', qty: 1 },
    { ref: 'Sendok', qty: 1 },
  ]},
  { menu_item_id: 'fd-brownie', items: [
    { ref: 'Kantong Plastik', qty: 1 },
    { ref: 'Tisu', qty: 1 },
    { ref: 'Sendok', qty: 1 },
  ]},
  { menu_item_id: 'fd-cheese', items: [
    { ref: 'Kantong Plastik', qty: 1 },
    { ref: 'Tisu', qty: 1 },
    { ref: 'Sendok', qty: 1 },
  ]},
  { menu_item_id: 'fd-sandwich', items: [
    { ref: 'Kantong Plastik', qty: 1 },
    { ref: 'Tisu', qty: 2 },
    { ref: 'Garpu', qty: 1 },
  ]},
]

async function main() {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  })

  try {
    // Upsert materials with random stock
    const idMap = new Map()
    for (const m of materials) {
      const randomStock = Math.floor(Math.random() * (m.max - m.min + 1)) + m.min
      const stockMin = Math.floor(m.min * 0.2)
      
      const price = Number((Math.random() * (m.priceMax - m.priceMin) + m.priceMin).toFixed(2))
      await conn.execute(
        'INSERT INTO materials (name, unit, price, stock, stock_min) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE unit = VALUES(unit), price = VALUES(price), stock = VALUES(stock), stock_min = VALUES(stock_min)',
        [m.name, m.unit, price, randomStock, stockMin]
      )
      const [row] = await conn.execute('SELECT id FROM materials WHERE name = ?', [m.name])
      const id = Array.isArray(row) && row[0]?.id
      if (id) idMap.set(m.name, id)
      console.log(`✓ ${m.name}: ${randomStock} ${m.unit} (min: ${stockMin}) @ ${price}`)
    }

    // Link product materials
    for (const pl of productLinks) {
      await conn.execute('DELETE FROM product_materials WHERE menu_item_id = ?', [pl.menu_item_id])
      for (const it of pl.items) {
        const matId = idMap.get(it.ref)
        if (!matId) continue
        await conn.execute(
          'INSERT INTO product_materials (menu_item_id, material_id, qty) VALUES (?, ?, ?)',
          [pl.menu_item_id, matId, it.qty]
        )
      }
    }

    console.log(`\n✓ Seeded ${materials.length} materials with random stock`)
    console.log(`✓ Linked to ${productLinks.length} products in ${DB_NAME}`)
  } finally {
    await conn.end()
  }
}

main().catch((err) => {
  console.error('Seeding materials failed:', err.message)
  process.exit(1)
})
