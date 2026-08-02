import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
dotenv.config()

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'pos_coffe',
    waitForConnections: true,
    connectionLimit: 5,
  })

  const sql = `
CREATE TABLE IF NOT EXISTS cashiers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  pin VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'kasir',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cashier_shifts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cashier_id INT NOT NULL,
  opening_cash DECIMAL(10,2) NOT NULL DEFAULT 0,
  closing_cash DECIMAL(10,2) NULL,
  start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_time TIMESTAMP NULL,
  notes VARCHAR(255) NULL,
  CONSTRAINT fk_shift_cashier FOREIGN KEY (cashier_id) REFERENCES cashiers(id) ON DELETE CASCADE
);
`

  try {
    const conn = await pool.getConnection()
    for (const stmt of sql.split(';')) {
      if (stmt.trim()) {
        await conn.query(stmt)
      }
    }
    conn.release()
    console.log('Tabel cashiers dan cashier_shifts berhasil dibuat!')
    process.exit(0)
  } catch (err) {
    console.error('Gagal membuat tabel:', err)
    process.exit(1)
  }
}

main()
