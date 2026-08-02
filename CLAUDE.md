# CLAUDE.md — pos-merchant-dashboard

**Dashboard manajemen untuk merchant/pemilik** (analitik, produk, stok, staf, laporan).
Konsumen backend yang mirip pos-coffe.

## Stack
- **Frontend:** React 19 + Vite 8 + Tailwind 4, **oxlint** (bukan eslint), `react-router-dom` 7.
- **Backend:** Express + MySQL2 (`server/`), ESM. Punya `schema.sql` sendiri.

## Menjalankan
```bash
npm install && npm run dev        # frontend (Vite)
npm run lint                      # oxlint
cd server && npm install && npm start   # backend. Butuh server/.env (lihat server/.env.example)
```

## Struktur
- `src/pages/` — `DashboardPage`, `ProductsPage`, `InventoryPage`, `ExpensesPage`, `ReportsPage`,
  `LogsPage`, `StaffPage`, `VouchersPage`, `SettingsPage`.
- `src/components/` — `Pagination`, `ToggleSwitch`. `src/lib/api.js` — klien API.
- `server/src/` — `index.js` (bootstrap, trust proxy), `routes.js` (auth, hash scrypt, token HMAC, rate limiter),
  `security.js` (rate limiter), `telegram.js` (notifikasi low-stock).

## Catatan
- **PIN**: hash scrypt + auto-migrasi; login dibatasi `loginLimiter` (per IP).
- `CASHIER_TOKEN_SECRET` wajib kuat; server **exit** bila default saat `NODE_ENV=production`.
- README masih template default Vite — perlu dilengkapi (lihat ROADMAP 3.6).

Backlog ekosistem: `../pos-coffe/ROADMAP.md`.
