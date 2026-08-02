import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  })

  try {
    console.log('Adding price column to materials table...')
    
    // Check if column already exists
    const [columns] = await conn.execute(`
      SHOW COLUMNS FROM materials LIKE 'price'
    `)
    
    if (columns.length > 0) {
      console.log('✓ Column price already exists')
    } else {
      // Add price column
      await conn.execute(`
        ALTER TABLE materials 
        ADD COLUMN price DECIMAL(10,2) DEFAULT 0 AFTER unit
      `)
      console.log('✓ Column price added successfully')
    }
    
    // Check material_movements table
    const [movColumns] = await conn.execute(`
      SHOW COLUMNS FROM material_movements LIKE 'price'
    `)
    
    if (movColumns.length > 0) {
      console.log('✓ Column price already exists in material_movements')
    } else {
      // Add price column to material_movements
      await conn.execute(`
        ALTER TABLE material_movements 
        ADD COLUMN price DECIMAL(10,2) DEFAULT 0 AFTER qty
      `)
      console.log('✓ Column price added to material_movements successfully')
    }
    
    console.log('\n✓ Migration complete!')
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  } finally {
    await conn.end()
  }
}

main().catch(console.error)
