import React, { createContext, useContext, useState, useEffect } from 'react';

const STORAGE_KEY = 'strans_lang';

const DICTIONARY = {
  id: {
    // Navigation Groups
    'nav.group.pantau': 'PANTAU',
    'nav.group.kelola': 'KELOLA',
    'nav.group.lainnya': 'LAINNYA',

    // Menu Items
    'nav.overview': 'Ringkasan',
    'nav.overview.desc': 'Omset, laba, dan tren seluruh outlet hari ini',
    'nav.sales': 'Penjualan',
    'nav.sales.desc': 'Riwayat transaksi kasir dan rekap penjualan',
    'nav.transactions': 'Transaksi',
    'nav.reports': 'Laporan',
    'nav.shifts': 'Tutup Kasir',
    'nav.shifts.desc': 'Status buka-tutup shift dan rekonsiliasi laci kas',
    'nav.shifts.tab': 'Shift & Laci Kas',
    'nav.expenses': 'Pengeluaran Kas',
    'nav.catalog': 'Katalog & Stok',
    'nav.catalog.desc': 'Katalog menu, bahan baku, dan gudang pusat holding',
    'nav.products': 'Produk & Menu',
    'nav.inventory': 'Stok Cabang',
    'nav.centralKitchen': 'Gudang Pusat',
    'nav.vouchers': 'Promo & Voucher',
    'nav.vouchers.desc': 'Kupon diskon pelanggan dan promo bundling kasir',
    'nav.kasir': 'Kasir & Perangkat',
    'nav.kasir.desc': 'Mesin kasir POS, kode aktivasi, dan layar dapur KDS',
    'nav.posDevices': 'Mesin Kasir',
    'nav.kds': 'Layar Dapur & QR',
    'nav.wallet': 'Dompet & Saldo',
    'nav.wallet.desc': 'Saldo QRIS, pencairan instan, dan mutasi settlement',
    'nav.outlets': 'Outlet & Tim',
    'nav.outlets.desc': 'Manajemen cabang outlet dan wewenang akun staf',
    'nav.branches': 'Cabang & Outlet',
    'nav.staff': 'Staf & Akses',
    'nav.settings': 'Pengaturan',
    'nav.settings.desc': 'Profil usaha, paket langganan, dan log aktivitas',
    'nav.profile': 'Profil Usaha',
    'nav.logs': 'Log Audit',
    'nav.help': 'Bantuan',
    'nav.posApp': 'Aplikasi Kasir',

    // Topbar
    'topbar.search': 'Cari halaman, menu, struk transaksi...',
    'topbar.allOutlets': 'Semua Outlet (Holding)',
    'topbar.plan': 'Juragan Space (AI)',
    'topbar.planTag': '2 Cabang (Tanpa batas)',
    'topbar.logout': 'Keluar',

    // Common Buttons & Actions
    'common.add': 'Tambah',
    'common.save': 'Simpan perubahan',
    'common.cancel': 'Batal',
    'common.delete': 'Hapus',
    'common.edit': 'Edit',
    'common.download': 'Unduh',
    'common.downloadCsv': 'Unduh CSV',
    'common.downloadReport': 'Unduh laporan',
    'common.active': 'Aktif',
    'common.loading': 'Memuat...',
    'common.status': 'Status',
    'common.search': 'Cari...',
    'common.filter': 'Filter',
    'common.all': 'Semua',

    // Settings Page
    'settings.title': 'Pengaturan',
    'settings.desc': 'Profil usaha, pajak, tampilan antarmuka, keamanan, dan notifikasi holding.',
    'settings.tab.appearance': 'Tampilan & Bahasa',
    'settings.tab.profile': 'Profil Usaha',
    'settings.tab.security': 'Keamanan & Otorisasi',
    'settings.tab.notifications': 'Notifikasi & Rekap AI',
    'settings.tab.plan': 'Paket Berlangganan',

    'settings.language.title': 'Bahasa & Wilayah',
    'settings.language.desc': 'Pilih bahasa tampilan untuk antarmuka dashboard dan struk kasir.',
    'settings.theme.title': 'Tampilan & Tema Warna',
    'settings.theme.desc': 'Sesuaikan mode terang/gelap dan palet warna merek favorit Anda.',
    'settings.mode.light': 'Terang',
    'settings.mode.dark': 'Gelap',
    'settings.mode.system': 'Ikuti Perangkat',
    'settings.themeColor.label': 'Warna Utama Tema (Theme Color)',
    'settings.preview.title': 'Kotak Pratinjau Tema UI (Live)',
    'settings.preview.badge': 'Aksen Aktif',

    'settings.profile.title': 'Profil Usaha & Pengaturan Kasir',
    'settings.profile.desc': 'Informasi bisnis yang tercetak di struk belanja pelanggan dan laporan resmi.',
    'settings.profile.name': 'Nama Usaha / Brand',
    'settings.profile.category': 'Kategori Usaha',
    'settings.profile.tax': 'Pajak Restoran PB1 (%)',
    'settings.profile.service': 'Biaya Layanan / Service Charge (%)',
    'settings.profile.email': 'Email Resmi Usaha',
    'settings.profile.phone': 'Nomor Kontak WhatsApp Toko',

    'settings.security.title': 'Keamanan & Otorisasi Kasir',
    'settings.security.desc': 'Aturan otorisasi pembatalan dan akses login yang berlaku untuk seluruh outlet.',
    'settings.security.twoFactor': 'Verifikasi Dua Langkah (2FA)',
    'settings.security.twoFactorDesc': 'Kirim kode OTP sekali pakai lewat surel/WhatsApp setiap kali masuk ke dashboard holding.',
    'settings.security.voidPin': 'PIN Supervisor untuk Pembatalan (Void)',
    'settings.security.voidPinDesc': 'Kasir tidak bisa membatalkan transaksi tanpa input PIN otorisasi manajer/supervisor toko.',
    'settings.security.auditLock': 'Kunci Audit Log Aktivitas Anti-Fraud AI',
    'settings.security.auditLockDesc': 'Rekam setiap perubahan harga manual dan diskon kasir ke dalam log audit trail holding.',

    'settings.notifications.title': 'Notifikasi & Rekap Penjualan AI',
    'settings.notifications.desc': 'Pilih kabar dan sinyal bahaya apa saja yang perlu langsung dikirim ke WhatsApp Anda.',
    'settings.notifications.stock': 'Peringatan Stok Bahan Baku Menipis',
    'settings.notifications.stockDesc': 'Muncul dan dikirim ke bot Telegram saat sisa bahan di cabang turun di bawah batas minimum.',
    'settings.notifications.void': 'Pemberitahuan Transaksi Void Seketika',
    'settings.notifications.voidDesc': 'Setiap ada transaksi yang dibatalkan oleh kasir langsung dilaporkan detik itu juga.',
    'settings.notifications.digest': 'Rekap Harian Tutup Buku Otomatis via AI',
    'settings.notifications.digestDesc': 'Ringkasan omset bersih, P&L harian, dan analisis produk terlaris dikirim setiap pukul 22.00.',

    'settings.plan.title': 'Paket Berlangganan Aktif',
    'settings.plan.desc': 'Lisensi enterprise holding multi-cabang tanpa batasan.',
    'settings.plan.invoices': 'Rincian Tagihan & Faktur'
  },
  en: {
    // Navigation Groups
    'nav.group.pantau': 'MONITOR',
    'nav.group.kelola': 'MANAGE',
    'nav.group.lainnya': 'OTHERS',

    // Menu Items
    'nav.overview': 'Overview',
    'nav.overview.desc': 'Revenue, gross profit, and store trends today',
    'nav.sales': 'Sales',
    'nav.sales.desc': 'Cashier transaction ledger and sales summaries',
    'nav.transactions': 'Transactions',
    'nav.reports': 'Reports',
    'nav.shifts': 'Shift Close',
    'nav.shifts.desc': 'Open-close shift status and cash drawer reconciliation',
    'nav.shifts.tab': 'Shifts & Cash Drawer',
    'nav.expenses': 'Cash Expenses',
    'nav.catalog': 'Catalog & Stock',
    'nav.catalog.desc': 'Menu catalog, raw ingredients, and central kitchen',
    'nav.products': 'Products & Menu',
    'nav.inventory': 'Branch Stock',
    'nav.centralKitchen': 'Central Kitchen',
    'nav.vouchers': 'Promos & Vouchers',
    'nav.vouchers.desc': 'Customer discount codes and cashier bundle promos',
    'nav.kasir': 'Cashier & Devices',
    'nav.kasir.desc': 'POS cashier machines, pairing codes, and KDS kitchen display',
    'nav.posDevices': 'POS Terminals',
    'nav.kds': 'Kitchen Display & QR',
    'nav.wallet': 'Wallet & Balance',
    'nav.wallet.desc': 'QRIS settlement balance, instant payout, and ledgers',
    'nav.outlets': 'Outlets & Team',
    'nav.outlets.desc': 'Multi-branch management and staff access permissions',
    'nav.branches': 'Branches & Outlets',
    'nav.staff': 'Staff & Access',
    'nav.settings': 'Settings',
    'nav.settings.desc': 'Business profile, billing plan, and audit logs',
    'nav.profile': 'Business Profile',
    'nav.logs': 'Audit Logs',
    'nav.help': 'Support & Help',
    'nav.posApp': 'Cashier POS App',

    // Topbar
    'topbar.search': 'Search pages, products, receipts...',
    'topbar.allOutlets': 'All Outlets (Holding)',
    'topbar.plan': 'Juragan Space (AI)',
    'topbar.planTag': '2 Outlets (Unlimited)',
    'topbar.logout': 'Sign Out',

    // Common Buttons & Actions
    'common.add': 'Add',
    'common.save': 'Save Changes',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.download': 'Download',
    'common.downloadCsv': 'Download CSV',
    'common.downloadReport': 'Download Report',
    'common.active': 'Active',
    'common.loading': 'Loading...',
    'common.status': 'Status',
    'common.search': 'Search...',
    'common.filter': 'Filter',
    'common.all': 'All',

    // Settings Page
    'settings.title': 'Settings',
    'settings.desc': 'Business profile, tax rates, interface appearance, security, and holding alerts.',
    'settings.tab.appearance': 'Appearance & Language',
    'settings.tab.profile': 'Business Profile',
    'settings.tab.security': 'Security & Permissions',
    'settings.tab.notifications': 'Notifications & AI Digests',
    'settings.tab.plan': 'Subscription Plan',

    'settings.language.title': 'Language & Region',
    'settings.language.desc': 'Choose your preferred language for the dashboard and cashier receipts.',
    'settings.theme.title': 'Appearance & Theme Color',
    'settings.theme.desc': 'Customize light/dark mode and your favorite brand accent color palette.',
    'settings.mode.light': 'Light',
    'settings.mode.dark': 'Dark',
    'settings.mode.system': 'System Default',
    'settings.themeColor.label': 'Theme Accent Color',
    'settings.preview.title': 'UI Theme Live Preview Box',
    'settings.preview.badge': 'Active Accent',

    'settings.profile.title': 'Business Profile & Tax Rates',
    'settings.profile.desc': 'Business information printed on receipts and official financial reports.',
    'settings.profile.name': 'Business Brand Name',
    'settings.profile.category': 'Business Category',
    'settings.profile.tax': 'Restaurant Tax PB1 (%)',
    'settings.profile.service': 'Service Charge (%)',
    'settings.profile.email': 'Official Business Email',
    'settings.profile.phone': 'WhatsApp Contact Number',

    'settings.security.title': 'Security & Supervisor Auth',
    'settings.security.desc': 'Void authorization and dashboard login rules applied to all branches.',
    'settings.security.twoFactor': 'Two-Factor Authentication (2FA)',
    'settings.security.twoFactorDesc': 'Send one-time OTP via Email/WhatsApp each time logging into holding dashboard.',
    'settings.security.voidPin': 'Supervisor PIN for Transaction Void',
    'settings.security.voidPinDesc': 'Cashiers cannot void transactions without supervisor PIN authorization.',
    'settings.security.auditLock': 'AI Anti-Fraud Audit Trail Lock',
    'settings.security.auditLockDesc': 'Record every manual discount and price alteration into holding immutable ledger.',

    'settings.notifications.title': 'Notifications & AI Daily Digests',
    'settings.notifications.desc': 'Choose which alerts and emergency signals should be sent to your WhatsApp.',
    'settings.notifications.stock': 'Low Raw Material Stock Warning',
    'settings.notifications.stockDesc': 'Triggered and sent to Telegram Bot when branch inventory drops below threshold.',
    'settings.notifications.void': 'Instant Cashier Void Notification',
    'settings.notifications.voidDesc': 'Report voided transactions instantly the moment it occurs at the cash register.',
    'settings.notifications.digest': 'AI Automated Daily Register Closing Digest',
    'settings.notifications.digestDesc': 'Net revenue summary, daily P&L, and top selling items sent every night at 22:00.',

    'settings.plan.title': 'Active Subscription Plan',
    'settings.plan.desc': 'Enterprise holding multi-branch license with unlimited capabilities.',
    'settings.plan.invoices': 'Billing Details & Invoices'
  }
};

const LanguageContext = createContext({
  language: 'id',
  setLanguage: () => {},
  t: (key, fallback) => fallback || key
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'id';
    } catch {
      return 'id';
    }
  });

  const setLanguage = (lang) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  };

  const t = (key, fallback) => {
    const dict = DICTIONARY[language] || DICTIONARY.id;
    return dict[key] || fallback || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
