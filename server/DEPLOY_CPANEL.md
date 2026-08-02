# Deployment ke cPanel CloudLinux NodeJS Selector

## 1. Upload Files
Upload semua file di folder `server/` ke `/home/stranmyi/coffe/`:
```
server/src/          → /home/stranmyi/coffe/src/
server/scripts/      → /home/stranmyi/coffe/scripts/
server/package.json  → /home/stranmyi/coffe/package.json
server/.env          → /home/stranmyi/coffe/.env
server/schema.sql    → /home/stranmyi/coffe/schema.sql
```

## 2. Setup via SSH/Terminal cPanel

```bash
# Masuk ke virtual environment
source /home/stranmyi/nodevenv/coffe/22/bin/activate && cd /home/stranmyi/coffe

# Install dependencies
npm install

# Setup database (jika belum)
node scripts/init-db.js
node scripts/migrate-add-is-active.js

# Test manual
node src/index.js
```

## 3. Setup di cPanel NodeJS Selector

- **Application root**: `coffe`
- **Application URL**: `api.coffe.stran.my.id` (atau subdomain API Anda)
- **Application startup file**: `src/index.js`
- **Node.js version**: 22.x
- **Environment variables**: Tambahkan dari file `.env`:
  ```
  DB_HOST=103.112.163.154
  DB_PORT=3306
  DB_USER=stranmyi_server_coffe
  DB_PASSWORD=F[e,7%9xl5dI
  DB_NAME=stranmyi_pos_coffe
  PORT=4000
  ```

## 4. Restart App
- Klik **Restart** di NodeJS Selector dashboard
- Akses: `https://api.coffe.stran.my.id/api/health`

## 5. Update Frontend .env

```env
VITE_API_URL=https://api.coffe.stran.my.id
```

Rebuild frontend:
```bash
npm run build
```

Upload folder `dist/` ke `/home/stranmyi/coffe.stran.my.id/public_html/`

## Troubleshooting

**Jika app tidak start:**
```bash
source /home/stranmyi/nodevenv/coffe/22/bin/activate && cd /home/stranmyi/coffe
pm2 logs
# atau
node src/index.js  # untuk debug manual
```

**Check port conflict:**
NodeJS Selector akan assign port otomatis. Jangan hardcode PORT=4000 di environment, biarkan CloudLinux yang atur.

**Database connection:**
Pastikan MySQL remote access enabled untuk IP server cPanel Anda.
