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
  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME
  })

  try {
    const [rows] = await connection.execute('SELECT * FROM cashiers')
    console.log('=== CASIER ACCOUNTS IN DATABASE ===')
    console.log(rows)
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    await connection.end()
  }
}

main()
