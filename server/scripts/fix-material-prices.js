import mysql from 'mysql2/promise'
import dotenv from 'dotenv'

dotenv.config()

async function fixMaterialPrices() {
  let conn
  try {
    conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    })

    console.log('🔧 Fixing material prices for existing movements...')

    const [result] = await conn.execute(`
      UPDATE material_movements mm
      SET price = (SELECT m.price FROM materials m WHERE m.id = mm.material_id)
      WHERE mm.type = 'out' AND (mm.price = 0 OR mm.price IS NULL)
    `)

    console.log(`✓ Updated ${result.affectedRows} records with prices`)
    
    // Show sample of updated data
    const [samples] = await conn.execute(`
      SELECT mm.id, mm.material_id, mm.type, mm.qty, mm.price, m.name
      FROM material_movements mm
      JOIN materials m ON mm.material_id = m.id
      WHERE mm.type = 'out'
      ORDER BY mm.created_at DESC
      LIMIT 5
    `)

    console.log('\n📋 Sample of updated records:')
    samples.forEach(row => {
      console.log(`  - ${row.name}: ${row.qty} unit @ Rp ${Number(row.price).toLocaleString('id-ID')} = Rp ${(row.qty * row.price).toLocaleString('id-ID')}`)
    })

    console.log('\n✓ Done!')
  } catch (err) {
    console.error('❌ Error:', err.message)
  } finally {
    if (conn) await conn.end()
  }
}

fixMaterialPrices()
