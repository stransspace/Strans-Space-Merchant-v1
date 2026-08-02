import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const {
  DB_HOST = 'localhost',
  DB_PORT = 3306,
  DB_USER = 'root',
  DB_PASSWORD = '',
  DB_NAME = 'stranspace_posandroid',
} = process.env

async function main() {
  console.log(`Connecting to database '${DB_NAME}'...`)
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME
  })

  try {
    // Check if column already exists
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cashiers' AND COLUMN_NAME = 'pin_hash'
    `, [DB_NAME])

    if (columns.length === 0) {
      console.log("Adding column 'pin_hash' to 'cashiers' table...")
      await connection.execute('ALTER TABLE cashiers ADD COLUMN pin_hash VARCHAR(255) NULL AFTER pin')
      console.log('✓ Migration successful: pin_hash column added.')
    } else {
      console.log('✓ pin_hash column already exists in cashiers table.')
    }
  } catch (err) {
    console.error('✗ Migration failed:', err.message)
    process.exit(1)
  } finally {
    await connection.end()
  }
}

main()
