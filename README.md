# Strans Space — Merchant Dashboard

Dashboard merchant (backoffice) untuk POS Strans Space: kelola produk, stok, kasir, laporan, cabang/outlet, dan paket langganan. Frontend React + Vite, backend Express + MySQL/MariaDB.

## Menjalankan secara lokal

```bash
# Frontend (root project)
npm install
npm run dev      # dev server Vite
npm run build    # build produksi ke server/public/

# Backend (folder server/)
cd server
npm install
cp .env.example .env   # isi kredensial DB, Midtrans, dll — JANGAN commit .env
npm run server          # node --watch, auto-reload saat file berubah
```

Server Express menyajikan hasil build frontend dari `server/public/`, jadi setelah mengubah kode React jalankan `npm run build` ulang di root, atau gunakan `npm run dev` (Vite) terpisah dari `npm run server` (API) untuk pengembangan sehari-hari.

## Pembaruan Terbaru (2026-08-19)

### Sistem Paket Langganan (4 tier)

- Definisi tier terpusat (`PLAN_CONFIG`) di backend (`server/src/routes.js`) dan frontend (`src/lib/plans.js`): **Rintis Space** (gratis), **Toko Space**, **Cabang Space**, **Juragan Space (AI)** — masing-masing dengan batas cabang, batas staf, dan harga bulanan yang jelas, menggantikan skema 3-tier lama (`free`/`standard`/`premium`) yang tidak sinkron dengan halaman harga publik.
- Perbaikan kuota Cabang Space dari 2 → 3 cabang sesuai pricing.
- Fitur eksklusif (Gudang Pusat/Central Kitchen, Kitchen Display System) digerbang khusus paket Juragan — baik di backend (`PLAN_ACCESS_MAP`) maupun di frontend (halaman diganti tampilan "Upgrade Required" untuk tenant di bawah paket itu).
- UI Sidebar/Topbar menampilkan nama paket & kuota cabang **asli** dari sesi tenant, bukan lagi hardcode "Juragan Space (AI)".
- Modal ajakan upgrade muncul otomatis dari mana saja saat backend menolak aksi karena batas paket (kode `PLAN_UPGRADE_REQUIRED`, `BRANCH_LIMIT_REACHED`, `CASHIER_LIMIT_REACHED`).

### Downgrade & Upgrade Paket

- Halaman **Pengaturan → Paket Berlangganan** dirombak total dari konten statis (selalu menampilkan "JURAGAN SPACE (AI)") menjadi pemilih 4 paket yang nyata, dengan harga, highlight fitur, dan status "Aktif" sesuai paket tenant sebenarnya.
- **Downgrade**: gratis & instan (`POST /api/subscription/upgrade`), dengan guard server-side yang menolak downgrade bila jumlah cabang/staf saat ini melebihi kuota paket tujuan.
- **Upgrade/perpanjangan**: wajib lewat pembayaran (lihat bawah) — endpoint lama otomatis menolak permintaan upgrade tanpa bayar (`PAYMENT_REQUIRED`).

### Integrasi Pembayaran Midtrans (Snap)

- Checkout upgrade paket via Midtrans Snap (`POST /api/subscription/checkout`) — nominal dihitung di server dari `PLAN_CONFIG`, bukan dari input client.
- Tabel baru `subscription_payments` mencatat setiap transaksi checkout.
- Webhook Midtrans (`/api/payments/midtrans/webhook`) diperluas: mengenali referensi transaksi paket (`SUB-*`) terpisah dari transaksi order kasir (`ORDER-*`); paket baru hanya diterapkan setelah status pembayaran `settlement` terverifikasi.
- Endpoint polling fallback (`GET /api/subscription/checkout/:reference/status`) untuk konfirmasi status kalau webhook belum sempat masuk.
- Endpoint publik `GET /api/config/public` untuk expose Midtrans Client Key (bukan Server Key) ke frontend.
- Dibersihkan: satu route webhook duplikat yang sebelumnya jadi dead code (tidak pernah tereksekusi).

### Navigasi & Pencarian (Cmd+K)

- Perbaikan bug: hasil klik di command palette (GlobalSearch) tidak melakukan navigasi apa pun karena prop `onSelectTab` tidak pernah diteruskan dari `Topbar`.
- Index pencarian diperluas mencakup sub-halaman (Pengaturan, Stok Bahan Baku, Gudang Pusat) dengan deep-link langsung ke sub-tab terkait, bukan cuma ke halaman induk.
- Indikator gembok untuk hasil pencarian/sub-tab yang berada di luar paket tenant saat ini.

### Perbaikan Bug Lain

- Login gagal (`email: undefined`) akibat `loginOwner` dipanggil dengan argumen positional, padahal fungsinya menerima object (`src/App.jsx`).
- Kolom `companies.subscription_expires_at` dan `subscription_started_at` yang belum ada di skema database staging, menyebabkan query login gagal — ditambahkan migrasi idempoten.
- `ENFORCE_PLAN_ACCESS` diubah defaultnya ke mode audit (log saja, tidak memblokir) sampai data paket tenant lama selesai dimigrasi ke slug tier baru.

> Catatan: kredensial Midtrans yang dipakai saat ini adalah **kunci production**. Pastikan payment channel sudah aktif penuh di Midtrans Dashboard sebelum mengandalkan alur checkout di lingkungan production.
