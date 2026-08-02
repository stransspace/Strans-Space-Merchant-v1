import { Client as FtpClient } from 'basic-ftp'
import { Readable } from 'stream'
import dotenv from 'dotenv'

dotenv.config()

async function main() {
  const client = new FtpClient()
  try {
    await client.access({
      host: process.env.FTP_HOST,
      port: Number(process.env.FTP_PORT) || 21,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASSWORD,
      secure: false,
    })
    const baseDir = process.env.FTP_BASE_DIR || 'public_html/uploads'
    await client.ensureDir(baseDir)
    const content = `FTP test at ${new Date().toISOString()}\n`
    const stream = Readable.from(Buffer.from(content, 'utf8'))
    await client.uploadFrom(stream, 'ftp-test.txt')
    console.log('✓ FTP test upload succeeded to', baseDir)
  } catch (err) {
    console.error('FTP test failed:', err.message)
    process.exit(1)
  } finally {
    client.close()
  }
}

main()
