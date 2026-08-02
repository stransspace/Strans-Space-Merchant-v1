import mysql from 'mysql2/promise.js'
import dotenv from 'dotenv'

dotenv.config()

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'pos_coffe',
})

const conn = await pool.getConnection()

const [rows] = await conn.execute('SELECT id, created_at, DATE(created_at) as d_date, DATE_FORMAT(created_at, "%Y-%m-%d") as df_date FROM orders ORDER BY id DESC LIMIT 5')
console.log('Orders created_at examples:')
rows.forEach(r => {
  console.log(`ID: ${r.id} | raw: ${r.created_at} | DATE(): ${r.d_date} | DATE_FORMAT: ${r.df_date}`)
})

await conn.release()
await pool.end()
