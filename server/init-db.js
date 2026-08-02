import fs from 'fs'
import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

async function initDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pos_coffe',
  })

  try {
    // Read schema file
    const schema = fs.readFileSync('schema.sql', 'utf8')
    
    // Split by semicolon and execute each statement
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0)
    
    for (const statement of statements) {
      await connection.execute(statement)
      console.log('✓ Executed:', statement.substring(0, 50) + '...')
    }
    
    console.log('\n✓ Database schema initialized successfully')
  } catch (error) {
    console.error('✗ Error initializing database:', error.message)
    process.exit(1)
  } finally {
    await connection.end()
  }
}

initDatabase()
