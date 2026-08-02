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
    // 1. Create 'tenants' table if not exists (in case)
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS tenants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        domain VARCHAR(100) UNIQUE,
        activation_code VARCHAR(50) UNIQUE,
        subscription_plan VARCHAR(50) DEFAULT 'free',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `)

    // 2. Insert tenant
    console.log('Inserting tenant...')
    await connection.execute(`
      INSERT INTO tenants (id, name, domain, activation_code, subscription_plan)
      VALUES (1, 'Rasa Coffee', 'rasacoffee', 'ACT123', 'premium')
      ON DUPLICATE KEY UPDATE domain='rasacoffee', activation_code='ACT123'
    `)

    // 3. Insert cashier owner with 'owner' username and '123456' pin
    console.log('Inserting cashier owner...')
    await connection.execute(`
      INSERT INTO cashiers (id, name, username, pin, role, email, tenant_id)
      VALUES (1, 'Owner Rasa Coffee', 'owner', '123456', 'owner', 'owner.rasacoffee@gmail.com', 1)
      ON DUPLICATE KEY UPDATE name='Owner Rasa Coffee', username='owner', pin='123456', role='owner', email='owner.rasacoffee@gmail.com', tenant_id=1
    `)

    console.log('✓ Seeding complete. Tenant: rasacoffee, Owner username: owner, PIN: 123456, Email: owner.rasacoffee@gmail.com')
  } catch (err) {
    console.error('✗ Seeding failed:', err.message)
  } finally {
    await connection.end()
  }
}

main()
