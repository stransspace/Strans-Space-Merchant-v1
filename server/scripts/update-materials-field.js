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

async function main() {
  const conn = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  })

  try {
    // Get all menu items
    const [items] = await conn.execute('SELECT id, name FROM menu_items')
    
    console.log(`Updating materials field for ${items.length} products...\n`)
    
    for (const item of items) {
      // Get materials for this item
      const [materials] = await conn.execute(
        `SELECT m.name, m.unit, pm.qty 
         FROM product_materials pm 
         JOIN materials m ON m.id = pm.material_id 
         WHERE pm.menu_item_id = ?
         ORDER BY m.name`,
        [item.id]
      )
      
      if (materials.length > 0) {
        // Format materials as JSON string
        const materialsJson = JSON.stringify(
          materials.map(m => ({
            name: m.name,
            qty: parseFloat(m.qty),
            unit: m.unit
          }))
        )
        
        // Update menu_items.materials field
        await conn.execute(
          'UPDATE menu_items SET materials = ? WHERE id = ?',
          [materialsJson, item.id]
        )
        
        console.log(`✓ ${item.name}:`)
        materials.forEach(m => {
          console.log(`  - ${m.name}: ${m.qty} ${m.unit}`)
        })
        console.log()
      } else {
        console.log(`⚠ ${item.name}: No materials linked`)
        console.log()
      }
    }
    
    console.log(`✓ Updated materials field for all products in ${DB_NAME}`)
  } finally {
    await conn.end()
  }
}

main().catch((err) => {
  console.error('Update failed:', err.message)
  process.exit(1)
})
