import fs from 'fs/promises'
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

async function main() {
  if (!DB_NAME) {
    throw new Error('DB_NAME belum diisi di .env')
  }

  const schemaPath = path.join(root, 'schema.sql')
  const schema = await fs.readFile(schemaPath, 'utf8')

  const connection = await mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT),
    user: DB_USER,
    password: DB_PASSWORD,
    multipleStatements: true,
  })

  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    )
    await connection.changeUser({ database: DB_NAME })
    await connection.query(schema)
    // eslint-disable-next-line no-console
    console.log('Database initialized and seeded for', DB_NAME)
  } finally {
    await connection.end()
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Init DB failed:', err.message)
  process.exit(1)
})
