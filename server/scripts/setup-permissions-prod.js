import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  })

  try {
    // Get all cashiers and modules
    const [cashiers] = await conn.execute('SELECT id, username FROM cashiers')
    const [modules] = await conn.execute('SELECT id, name, label FROM modules')

    console.log(`Setting up permissions for ${cashiers.length} users and ${modules.length} modules...\n`)

    let addedCount = 0
    let updatedCount = 0

    // For each cashier, add/update full access to all modules
    for (const cashier of cashiers) {
      for (const module of modules) {
        const [existing] = await conn.execute(
          'SELECT id FROM user_module_access WHERE cashier_id = ? AND module_id = ?',
          [cashier.id, module.id]
        )

        if (existing.length === 0) {
          // Insert new permission with full access
          await conn.execute(
            `INSERT INTO user_module_access 
             (cashier_id, module_id, can_view, can_create, can_edit, can_delete)
             VALUES (?, ?, 1, 1, 1, 1)`,
            [cashier.id, module.id]
          )
          addedCount++
        } else {
          // Update existing permission to full access
          await conn.execute(
            `UPDATE user_module_access 
             SET can_view=1, can_create=1, can_edit=1, can_delete=1
             WHERE cashier_id = ? AND module_id = ?`,
            [cashier.id, module.id]
          )
          updatedCount++
        }
      }
    }

    console.log(`✓ Added: ${addedCount} new permissions`)
    console.log(`✓ Updated: ${updatedCount} existing permissions`)

    // Show final access summary
    const [finalAccess] = await conn.execute(`
      SELECT c.id, c.username,
             GROUP_CONCAT(CONCAT(m.label, ' (', IF(uma.can_view=1, 'V', '-'), IF(uma.can_create=1, 'C', '-'), IF(uma.can_edit=1, 'E', '-'), IF(uma.can_delete=1, 'D', '-'), ')') SEPARATOR ', ') as permissions
      FROM cashiers c
      LEFT JOIN user_module_access uma ON c.id = uma.cashier_id
      LEFT JOIN modules m ON uma.module_id = m.id
      GROUP BY c.id
      ORDER BY c.username
    `)

    console.log('\n=== FINAL PERMISSIONS ===')
    finalAccess.forEach(row => {
      console.log(`${row.username}:`)
      console.log(`  ${row.permissions}`)
    })

    console.log('\n✓ Permission setup complete!')
  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  } finally {
    await conn.end()
  }
}

main().catch(console.error)
