import React, { useState } from 'react';
import { Download, FileSpreadsheet } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { downloadCsv, safeFilename } from '../../lib/export';

const REPORTS = [
  { value: "transactions", label: "Transaksi", description: "Seluruh struk beserta status dan metode bayarnya" },
  { value: "inventory", label: "Stok bahan baku", description: "Sisa stok, minimum, dan HPP per satuan" },
  { value: "products", label: "Produk terlaris", description: "Jumlah terjual, omset, dan HPP per produk" },
  { value: "shifts", label: "Tutup kasir", description: "Setoran laci, total non-tunai, dan selisih kas" },
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function ExportReportModal({
  open,
  onClose,
  defaultReport = 'transactions',
  selectedBranchName = 'Semua Outlet',
  onSuccess
}) {
  const [report, setReport] = useState(defaultReport);

  const handleExport = () => {
    const scope = safeFilename(selectedBranchName);
    const stamp = today();

    let filename = '';
    let headers = [];
    let rows = [];

    if (report === 'transactions') {
      filename = safeFilename('transaksi', scope, stamp);
      headers = ["No. Struk", "Waktu", "Pembeli", "Total Tagihan", "Metode Bayar", "Outlet", "Kasir", "Status"];
      rows = [
        ["A-010", "16 Agu 2026, 16.13", "Tanpa nama", 132000, "QRIS", "Kopi Cisauk", "Kasir Bewok", "Berhasil"],
        ["A-009", "16 Agu 2026, 11.35", "Tanpa nama", 110000, "QRIS", "Kopi Cisauk", "Kasir Ujang", "Berhasil"],
        ["A-008", "16 Agu 2026, 08.27", "Tanpa nama", 72600, "QRIS", "Kopi Cisauk", "Kasir Rian Nugroho", "Berhasil"],
        ["A-007", "16 Agu 2026, 08.19", "Tanpa nama", 28600, "QRIS", "Kopi Cisauk", "Kasir Rian Nugroho", "Berhasil"],
        ["A-006", "16 Agu 2026, 07.45", "Tanpa nama", 52800, "QRIS", "Kopi Cisauk", "Kasir Rian Nugroho", "Berhasil"],
      ];
    } else if (report === 'inventory') {
      filename = safeFilename('stok-bahan', scope, stamp);
      headers = ["Nama Bahan", "Kategori", "Satuan", "Sisa Stok", "Stok Minimum", "HPP Satuan", "Outlet", "Status"];
      rows = [
        ["Biji Kopi Arabica Gayo", "Kopi", "Gram", 4200, 1000, 180, "Kopi Cisauk", "Aman"],
        ["Susu UHT Fresh Milk", "Dairy", "Mililiter", 6500, 2000, 22, "Kopi Cisauk", "Aman"],
        ["Sirup Caramel Premium", "Flavour", "Mililiter", 1200, 500, 85, "Kopi Cisauk", "Aman"],
        ["Gula Aren Cair Organik", "Pemanis", "Mililiter", 850, 1000, 35, "Kopi Cisauk", "Menipis"],
        ["Cup Plastik 16oz + Tutup", "Packaging", "Pcs", 340, 100, 650, "Kopi Cisauk", "Aman"],
      ];
    } else if (report === 'products') {
      filename = safeFilename('produk-terlaris', scope, stamp);
      headers = ["Nama Menu", "Kategori", "Jumlah Terjual", "Total Omset", "Total HPP", "Laba Kotor"];
      rows = [
        ["Kopi Susu Aren Signature", "Kopi", 12, 336000, 96000, 240000],
        ["Caramel Macchiato", "Kopi", 8, 272000, 80000, 192000],
        ["Americano Double Shot", "Kopi", 6, 168000, 36000, 132000],
        ["Ice Matcha Latte", "Non-Coffee", 4, 128000, 48000, 80000],
        ["Croissant Butter", "Pastry", 5, 140000, 60000, 80000],
      ];
    } else {
      filename = safeFilename('tutup-kasir', scope, stamp);
      headers = ["Outlet", "Kasir", "Shift", "Modal Awal", "Kas Seharusnya", "Kas Dihitung", "Selisih Kas", "Total Non-Tunai", "Status"];
      rows = [
        ["Kopi Cisauk", "Kasir Bewok", "Shift Pagi (07:00 - 15:00)", 200000, 420000, 420000, 0, 396000, "Sesuai"],
        ["Kopi Cisauk", "Kasir Ujang", "Shift Sore (15:00 - 22:00)", 200000, 580000, 580000, 0, 510000, "Sesuai"],
      ];
    }

    downloadCsv(filename, headers, rows);
    onClose();
    onSuccess?.(`Laporan ${filename}.csv berhasil diunduh (${rows.length} baris data).`);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="max-w-md">
      <DialogHeader onClose={onClose}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle>Unduh Laporan</DialogTitle>
            <DialogDescription>Format CSV berpemisah titik koma, kompatibel dengan Excel.</DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <DialogContent className="space-y-4 pt-4 text-xs">
        <div>
          <label className="text-xs font-bold text-[var(--color-ink)] block mb-1.5">
            Jenis Laporan
          </label>
          <div className="space-y-2">
            {REPORTS.map((r) => (
              <label
                key={r.value}
                onClick={() => setReport(r.value)}
                className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                  report === r.value
                    ? 'border-[var(--color-brand-600)] bg-[var(--color-brand-50)]/50 ring-1 ring-[var(--color-brand-600)]'
                    : 'border-[var(--color-hairline)] bg-white hover:bg-[var(--color-snow)]'
                }`}
              >
                <input
                  type="radio"
                  name="reportType"
                  value={r.value}
                  checked={report === r.value}
                  onChange={() => setReport(r.value)}
                  className="mt-0.5 accent-[var(--color-brand-600)]"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[var(--color-ink)] text-xs">{r.label}</div>
                  <div className="text-[11px] text-[var(--color-slate-muted)] mt-0.5">{r.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
      </DialogContent>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Batal</Button>
        <Button onClick={handleExport} className="gap-1.5">
          <Download className="h-4 w-4" />
          <span>Unduh CSV</span>
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
