import {
  LayoutDashboard,
  TrendingUp,
  ClipboardCheck,
  ShoppingBasket,
  Smartphone,
  Store,
  Settings,
  LifeBuoy,
  Receipt,
  FileBarChart,
  Layers,
  CreditCard,
  Users,
  History,
  Factory,
  TicketPercent,
  ChefHat,
  Wallet
} from 'lucide-react';

export const NAV_GROUPS = [
  {
    title: "PANTAU",
    items: [
      {
        id: "overview",
        label: "Ringkasan",
        href: "/",
        icon: LayoutDashboard,
        description: "Omset, laba, dan tren seluruh outlet hari ini",
        children: []
      },
      {
        id: "sales",
        label: "Penjualan",
        href: "/transactions",
        icon: TrendingUp,
        description: "Riwayat transaksi kasir dan rekap penjualan",
        children: [
          { id: "transactions", label: "Transaksi", href: "/transactions", icon: Receipt },
          { id: "reports", label: "Laporan", href: "/reports", icon: FileBarChart }
        ]
      },
      {
        id: "shifts",
        label: "Tutup Kasir",
        href: "/shifts",
        icon: ClipboardCheck,
        description: "Status buka-tutup shift dan rekonsiliasi laci kas",
        children: [
          { id: "shifts", label: "Shift & Laci Kas", href: "/shifts", icon: ClipboardCheck },
          { id: "expenses", label: "Pengeluaran Kas", href: "/expenses", icon: Receipt }
        ]
      }
    ]
  },
  {
    title: "KELOLA",
    items: [
      {
        id: "catalog",
        label: "Katalog & Stok",
        href: "/products",
        icon: ShoppingBasket,
        description: "Katalog menu, bahan baku, dan gudang pusat holding",
        children: [
          { id: "products", label: "Produk & Menu", href: "/products", icon: ShoppingBasket },
          { id: "inventory", label: "Stok Cabang", href: "/inventory", icon: Layers },
          { id: "central-kitchen", label: "Gudang Pusat", href: "/central-kitchen", icon: Factory }
        ]
      },
      {
        id: "kasir",
        label: "Kasir & Perangkat",
        href: "/kasir",
        icon: Smartphone,
        description: "Mesin kasir POS, kode aktivasi, dan layar dapur KDS",
        children: [
          { id: "kasir", label: "Mesin Kasir", href: "/kasir", icon: Smartphone },
          { id: "kds", label: "Layar Dapur & QR", href: "/kds", icon: ChefHat }
        ]
      },
      {
        id: "wallet",
        label: "Dompet & Saldo",
        href: "/wallet",
        icon: Wallet,
        description: "Saldo QRIS, pencairan instan, dan mutasi settlement",
        children: []
      },
      {
        id: "vouchers",
        label: "Promo & Voucher",
        href: "/vouchers",
        icon: TicketPercent,
        description: "Kupon diskon pelanggan dan promo bundling kasir",
        children: []
      },
      {
        id: "outlets",
        label: "Outlet & Tim",
        href: "/outlets",
        icon: Store,
        badge: "2",
        description: "Manajemen cabang outlet dan wewenang akun staf",
        children: [
          { id: "branches", label: "Cabang & Outlet", href: "/outlets", icon: Store },
          { id: "staff", label: "Staf & Akses", href: "/staff", icon: Users }
        ]
      }
    ]
  },
  {
    title: "LAINNYA",
    items: [
      {
        id: "settings",
        label: "Pengaturan",
        href: "/settings",
        icon: Settings,
        description: "Profil usaha, paket langganan, dan log aktivitas",
        children: [
          { id: "settings-profile", label: "Profil Usaha", href: "/settings", icon: Settings },
          { id: "logs", label: "Log Audit", href: "/logs", icon: History }
        ]
      },
      {
        id: "help",
        label: "Bantuan",
        href: "/help",
        icon: LifeBuoy,
        description: "Panduan penggunaan dan customer support",
        children: []
      }
    ]
  }
];
