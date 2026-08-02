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

async function seedVariants() {
  let connection
  try {
    connection = await pool.getConnection()
    console.log('✓ Terhubung ke database')

    // Variants untuk kopi
    const variants = [
      // Caffe Latte
      { menu_item_id: 'cf-latte', name: 'Small', price: 28000, description: 'Ukuran kecil (200ml)' },
      { menu_item_id: 'cf-latte', name: 'Medium', price: 32000, description: 'Ukuran sedang (300ml)' },
      { menu_item_id: 'cf-latte', name: 'Large', price: 36000, description: 'Ukuran besar (400ml)' },
      
      // Cappuccino
      { menu_item_id: 'cf-capp', name: 'Small', price: 28000, description: 'Ukuran kecil (200ml)' },
      { menu_item_id: 'cf-capp', name: 'Medium', price: 32000, description: 'Ukuran sedang (300ml)' },
      { menu_item_id: 'cf-capp', name: 'Large', price: 36000, description: 'Ukuran besar (400ml)' },
      
      // Espresso
      { menu_item_id: 'cf-esp', name: 'Single Shot', price: 18000, description: '1 shot espresso' },
      { menu_item_id: 'cf-esp', name: 'Double Shot', price: 24000, description: '2 shots espresso' },
      
      // Mocha
      { menu_item_id: 'cf-mocha', name: 'Small', price: 30000, description: 'Ukuran kecil (200ml)' },
      { menu_item_id: 'cf-mocha', name: 'Medium', price: 34000, description: 'Ukuran sedang (300ml)' },
      { menu_item_id: 'cf-mocha', name: 'Large', price: 38000, description: 'Ukuran besar (400ml)' },
      
      // Vanilla Latte
      { menu_item_id: 'cf-vanilla', name: 'Small', price: 30000, description: 'Ukuran kecil (200ml)' },
      { menu_item_id: 'cf-vanilla', name: 'Medium', price: 34000, description: 'Ukuran sedang (300ml)' },
      { menu_item_id: 'cf-vanilla', name: 'Large', price: 38000, description: 'Ukuran besar (400ml)' },
      
      // Caramel Macchiato
      { menu_item_id: 'cf-caramel', name: 'Small', price: 30000, description: 'Ukuran kecil (200ml)' },
      { menu_item_id: 'cf-caramel', name: 'Medium', price: 34000, description: 'Ukuran sedang (300ml)' },
      { menu_item_id: 'cf-caramel', name: 'Large', price: 38000, description: 'Ukuran besar (400ml)' },
      
      // Matcha Latte
      { menu_item_id: 'cf-matcha', name: 'Small', price: 30000, description: 'Ukuran kecil (200ml)' },
      { menu_item_id: 'cf-matcha', name: 'Medium', price: 34000, description: 'Ukuran sedang (300ml)' },
      { menu_item_id: 'cf-matcha', name: 'Large', price: 38000, description: 'Ukuran besar (400ml)' },
      
      // Kopi Susu Gula Aren
      { menu_item_id: 'cf-kopi-susu', name: 'Small', price: 26000, description: 'Ukuran kecil (200ml)' },
      { menu_item_id: 'cf-kopi-susu', name: 'Medium', price: 30000, description: 'Ukuran sedang (300ml)' },
      { menu_item_id: 'cf-kopi-susu', name: 'Large', price: 34000, description: 'Ukuran besar (400ml)' },
      
      // V60 Manual Brew
      { menu_item_id: 'cf-v60', name: 'Single Cup', price: 35000, description: 'Segelas manual brew' },
      { menu_item_id: 'cf-v60', name: 'Double Cup', price: 65000, description: 'Dua gelas manual brew' },
      
      // Iced Chocolate
      { menu_item_id: 'cf-choco', name: 'Small', price: 24000, description: 'Ukuran kecil (250ml)' },
      { menu_item_id: 'cf-choco', name: 'Medium', price: 28000, description: 'Ukuran sedang (350ml)' },
      { menu_item_id: 'cf-choco', name: 'Large', price: 32000, description: 'Ukuran besar (450ml)' },
      
      // Iced Tea
      { menu_item_id: 'cf-iced-tea', name: 'Small', price: 18000, description: 'Ukuran kecil (250ml)' },
      { menu_item_id: 'cf-iced-tea', name: 'Medium', price: 22000, description: 'Ukuran sedang (350ml)' },
      { menu_item_id: 'cf-iced-tea', name: 'Large', price: 26000, description: 'Ukuran besar (450ml)' },
      
      // Lemon Tea
      { menu_item_id: 'cf-lemon-tea', name: 'Small', price: 20000, description: 'Ukuran kecil (250ml)' },
      { menu_item_id: 'cf-lemon-tea', name: 'Medium', price: 24000, description: 'Ukuran sedang (350ml)' },
      { menu_item_id: 'cf-lemon-tea', name: 'Large', price: 28000, description: 'Ukuran besar (450ml)' },
      
      // Brownies
      { menu_item_id: 'fd-brownie', name: 'Single', price: 20000, description: '1 potong brownie' },
      { menu_item_id: 'fd-brownie', name: 'Box (3pcs)', price: 55000, description: 'Paket 3 potong brownie' },
      
      // Cheese Cake
      { menu_item_id: 'fd-cheese', name: 'Single Slice', price: 25000, description: '1 potong cheese cake' },
      { menu_item_id: 'fd-cheese', name: 'Half Cake', price: 120000, description: 'Setengah cheese cake' },
      
      // Croissant Butter
      { menu_item_id: 'fd-croissant', name: 'Single', price: 30000, description: '1 croissant' },
      { menu_item_id: 'fd-croissant', name: 'Pair (2pcs)', price: 55000, description: 'Paket 2 croissant' },
      
      // Chicken Sandwich
      { menu_item_id: 'fd-sandwich', name: 'Single', price: 35000, description: '1 sandwich' },
      { menu_item_id: 'fd-sandwich', name: 'Combo (+ Drink)', price: 52000, description: 'Sandwich + minuman' },
    ]

    // Hapus varian lama
    await connection.execute('DELETE FROM variants')
    console.log('✓ Varian lama dihapus')

    // Insert varian baru
    for (const variant of variants) {
      await connection.execute(
        'INSERT INTO variants (menu_item_id, name, price, description) VALUES (?, ?, ?, ?)',
        [variant.menu_item_id, variant.name, variant.price, variant.description]
      )
    }

    console.log(`✓ ${variants.length} varian berhasil ditambahkan`)
    console.log('\n📊 Ringkasan:')
    console.log(`   Total varian: ${variants.length}`)
    console.log('   Varian mencakup: Size (S/M/L), Shots, dan paket khusus')

  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  } finally {
    if (connection) await connection.release()
    await pool.end()
  }
}

seedVariants()
