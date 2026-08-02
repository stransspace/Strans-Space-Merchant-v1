import React from 'react';

export default function Pagination({ currentPage, totalItems, itemsPerPage = 10, onPageChange }) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (totalPages <= 1) return null;
  
  return (
    <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4 select-none">
      <span className="text-slate-500 text-xs">
        Menampilkan {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalItems)} dari {totalItems} data
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            onPageChange(currentPage - 1);
            document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          disabled={currentPage === 1}
          className="px-3 py-1.5 border border-slate-100 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent text-slate-900 disabled:text-slate-500 rounded-lg text-xs font-bold transition-all cursor-pointer"
        >
          Sebelumnya
        </button>
        <span className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold text-sky-500 font-mono">
          {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => {
            onPageChange(currentPage + 1);
            document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 border border-slate-100 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent text-slate-900 disabled:text-slate-500 rounded-lg text-xs font-bold transition-all cursor-pointer"
        >
          Berikutnya
        </button>
      </div>
    </div>
  );
}
