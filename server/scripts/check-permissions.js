import mysql from 'mysql2/promise'

async function main() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'pos_coffe'
  })

  try {
    // Check cashiers
    const [cashiers] = await conn.execute('SELECT id, name, username FROM cashiers')
    console.log('\n=== CASHIERS ===')
    console.log(cashiers)

    // Check modules
    const [modules] = await conn.execute('SELECT id, name, label FROM modules')
    console.log('\n=== MODULES ===')
    console.log(modules)

    // Check user access
    const [access] = await conn.execute(`
      SELECT uma.cashier_id, uma.module_id, uma.can_view, uma.can_create, uma.can_edit, uma.can_delete,
             c.username, m.name as module_name, m.label
      FROM user_module_access uma
      LEFT JOIN cashiers c ON uma.cashier_id = c.id
      LEFT JOIN modules m ON uma.module_id = m.id
      ORDER BY uma.cashier_id, uma.module_id
    `)
    console.log('\n=== USER MODULE ACCESS ===')
    console.log(access)

    if (access.length === 0) {
      console.log('\n⚠️  Tidak ada permission! Menambahkan permission default untuk semua user...')
      
      // Insert default permissions (full access for all users and modules)
      for (const cashier of cashiers) {
        for (const module of modules) {
          await conn.execute(
            `INSERT IGNORE INTO user_module_access 
             (cashier_id, module_id, can_view, can_create, can_edit, can_delete)
             VALUES (?, ?, 1, 1, 1, 1)`,
            [cashier.id, module.id]
          )
        }
      }
      
      console.log('✓ Permission default berhasil ditambahkan!')
      
      // Show updated access
      const [updatedAccess] = await conn.execute(`
        SELECT uma.cashier_id, uma.module_id, uma.can_view, uma.can_create, uma.can_edit, uma.can_delete,
               c.username, m.label
        FROM user_module_access uma
        LEFT JOIN cashiers c ON uma.cashier_id = c.id
        LEFT JOIN modules m ON uma.module_id = m.id
        ORDER BY uma.cashier_id, uma.module_id
      `)
      console.log('\n=== UPDATED ACCESS ===')
      console.log(updatedAccess)
    }
  } catch (err) {
    console.error('Error:', err.message)
  } finally {
    await conn.end()
  }
}

main()
