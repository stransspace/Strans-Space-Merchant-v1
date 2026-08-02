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
  console.log(`Connecting to database '${DB_NAME}' on host '${DB_HOST}'...`)
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME
  })

  try {
    // 1. Link ssatrio994@gmail.com to Rasa Coffee Owner (Cashier ID: 7)
    console.log("Updating Rasa Coffee Owner (ID: 7)...")
    await connection.execute(`
      UPDATE cashiers 
      SET email = 'ssatrio994@gmail.com', pin = '123456', pin_hash = NULL 
      WHERE id = 7
    `)

    // 2. Link ssatrio994@gmail.com to KOI CISAUK Owner (ID: 16)
    console.log("Updating KOI CISAUK Owner (ID: 16)...")
    await connection.execute(`
      UPDATE cashiers 
      SET email = 'ssatrio994@gmail.com', pin = '123456', pin_hash = NULL 
      WHERE id = 16
    `)

    // 3. Link ssatrio994@gmail.com to Aroma Coffee Owner (ID: 11)
    console.log("Updating Aroma Coffee Owner (ID: 11)...")
    await connection.execute(`
      UPDATE cashiers 
      SET email = 'ssatrio994@gmail.com', pin = '123456', pin_hash = NULL 
      WHERE id = 11
    `)

    console.log('✓ Cloud database successfully updated!')
  } catch (err) {
    console.error('✗ Update failed:', err.message)
  } finally {
    await connection.end()
  }
}

main()
