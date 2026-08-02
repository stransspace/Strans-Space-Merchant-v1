
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const passengerPort = process.env.PORT // Preserve cPanel Passenger dynamic port/socket
dotenv.config({ path: path.join(__dirname, '..', '.env') })

import router from './routes.js'
import { ping } from './db.js'

console.log('=== Server starting at', new Date().toISOString())
try {
  if (!process.env.DB_HOST || !process.env.DB_NAME) {
    throw new Error('FATAL: DB_HOST/DB_NAME env missing')
  }
} catch (err) {
  console.error('FATAL: Error in env:', err)
  process.exit(11)
}
const app = express()
app.set('trust proxy', 1)
const port = passengerPort || process.env.PORT || 3800
const rawBasePath = process.env.BASE_PATH || ''
const normalizedBasePath = rawBasePath
  ? `/${rawBasePath.replace(/^\/+|\/+$/g, '')}`
  : ''

try {
  // --- KONFIGURASI CORS ---
  // Daftar domain frontend yang diizinkan untuk mengakses API ini.
  const whitelist = [
    'http://localhost:5173', // Frontend pos-coffee (development)
    'https://coffe.stran.my.id', // Frontend pos-coffee (production)
    'http://localhost:5174', // Frontend pos-merchant-dashboard (development) - Asumsi port 5174
    'https://dashboard.coffe.stran.my.id', // Frontend pos-merchant-dashboard (production) - Contoh
    'http://posandroid.stranspace.com', // cPanel Node.js URL (HTTP)
    'https://posandroid.stranspace.com', // cPanel Node.js URL (HTTPS)
    'http://posmerchant.stranspace.com', // cPanel Merchant URL (HTTP)
    'https://posmerchant.stranspace.com', // cPanel Merchant URL (HTTPS)
    'http://stranspace.com', // Landing page (HTTP) - form Daftar Gratis
    'https://stranspace.com', // Landing page (HTTPS) - form Daftar Gratis
    'http://www.stranspace.com', // Landing page www (HTTP)
    'https://www.stranspace.com', // Landing page www (HTTPS)
    'http://localhost', // Android Capacitor App Origin (HTTP)
    'https://localhost', // Android Capacitor App Origin (HTTPS)
    'capacitor://localhost', // iOS Capacitor App Origin
    `http://localhost:${port}` // Allow same-port requests (single port setup)
  ];

  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || whitelist.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Blocked by CORS'));
      }
    },
    credentials: true
  }));

  app.use(express.json());

  // Method override middleware to bypass PUT/DELETE blocks by LiteSpeed WAF (cPanel)
  app.use((req, res, next) => {
    const override = req.headers['x-http-method-override'] || req.query._method
    if (override && req.method === 'POST') {
      req.method = override.toUpperCase()
    }
    next()
  })

  // Request logging middleware
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)
    next()
  })
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('Error saat inisialisasi middleware:', err)
  process.exit(2)
}

// Mount API at /api (with optional base path) BEFORE static files
try {
  const apiPaths = normalizedBasePath ? [`${normalizedBasePath}/api`, '/api'] : ['/api'];
  app.use(apiPaths, (req, res, next) => {
    console.log(`[API] ${req.method} ${req.originalUrl}`)
    next()
  }, router)
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('Error saat mount router:', err)
  process.exit(4)
}

// Serve static files from public folder (React build)
const publicDir = path.join(__dirname, '..', 'public')

// Serve the main POS app at root '/' and 'normalizedBasePath' (if defined)
try {
  app.use('/', express.static(publicDir))
  if (normalizedBasePath) {
    app.use(normalizedBasePath, express.static(publicDir))
  }
} catch (err) {
  console.error('Error saat serve static POS:', err)
  process.exit(3)
}

// SPA fallback: serve the correct index.html for any non-API route
app.get('*', (req, res) => {
  if (req.originalUrl.includes('/api/')) {
    console.log(`[404] API endpoint not found: ${req.originalUrl}`)
    return res.status(404).json({ error: 'API endpoint not found' })
  }
  res.sendFile(path.join(publicDir, 'index.html'));
})

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR]', {
    method: req.method,
    url: req.url,
    error: err.message,
    stack: err.stack
  })
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    timestamp: new Date().toISOString(),
    path: req.url
  })
})

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`✓ API listening on http://localhost:${port}${normalizedBasePath}`)
  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`✓ Base path: ${normalizedBasePath || '/'}`)
  console.log(`✓ Database: ${process.env.DB_NAME}@${process.env.DB_HOST}`)
})

// Cek DB connection di background (non-blocking)
ping()
  .then(() => {
    // eslint-disable-next-line no-console
    console.log('✓ Database connected')
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.warn('⚠ Database connection warning:', err.message)
  })

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error('[UNHANDLED REJECTION]', {
    promise: promise,
    reason: reason,
    stack: reason?.stack
  })
})

process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('[UNCAUGHT EXCEPTION]', {
    message: err.message,
    stack: err.stack
  })
})

// Diagnose unexpected exits/close
process.on('exit', (code) => {
  // eslint-disable-next-line no-console
  console.log('Process exiting with code:', code)
})
server.on('close', () => {
  // eslint-disable-next-line no-console
  console.log('HTTP server closed')
})
