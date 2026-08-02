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
  DB_NAME = 'pos_coffe',
} = process.env

async function main() {
  console.log(`Migrating database '${DB_NAME}' on host '${DB_HOST}'...`)
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
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cashiers' AND COLUMN_NAME = 'email'
    `, [DB_NAME])

    if (columns.length === 0) {
      console.log("Adding column 'email' to 'cashiers' table...")
      await connection.execute('ALTER TABLE cashiers ADD COLUMN email VARCHAR(255) NULL AFTER role')
      console.log('✓ Migration successful: email column added.')
    } else {
      console.log('✓ email column already exists in cashiers table.')
    }
  } catch (err) {
    console.error('✗ Migration failed:', err.message)
    process.exit(1)
  } finally {
    await connection.end()
  }
}

main()
