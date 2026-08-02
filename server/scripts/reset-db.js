import mysql from 'mysql2/promise.js'
import dotenv from 'dotenv'

dotenv.config()

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
})

try {
  const dbName = process.env.DB_NAME || 'pos_coffe'
  console.log(`Dropping database ${dbName}...`)
  await connection.execute(`DROP DATABASE IF EXISTS ${dbName}`)
  console.log('✓ Database dropped')
  
  console.log(`Creating database ${dbName}...`)
  await connection.execute(`CREATE DATABASE IF NOT EXISTS ${dbName}`)
  console.log('✓ Database created')
  
} catch (err) {
  console.error('Error:', err.message)
} finally {
  await connection.end()
}
