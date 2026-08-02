import fs from 'fs'
import path from 'path'
import { query } from '../src/db.js'

const schemaPath = path.join(process.cwd(), 'schema.sql')
const schema = fs.readFileSync(schemaPath, 'utf8')

// Split by semicolon and execute each statement
const statements = schema
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0)

async function runSchema() {
  try {
    console.log(`Running $${statements.length} SQL statements...`)
    let count = 0
    for (const statement of statements) {
      try {
        await query(statement)
        count++
        console.log(` Statement $${count}/$${statements.length}`)
      } catch (err) {
        // Ignore duplicate table/key errors
        if (/Duplicate|already|exists/i.test(err.message)) {
          console.log(` Skipped (already exists): $${statement.substring(0, 50)}...`)
        } else {
          console.error(` Error in statement $${count}:`, err.message)
          throw err
        }
      }
    }
    console.log(`\n Schema setup complete!`)
    process.exit(0)
  } catch (err) {
    console.error('Fatal error:', err.message)
    process.exit(1)
  }
}

runSchema()
