// Tombol dengan indikator loading: saat `loading` true, tombol disable + spinner,
// mencegah klik ganda dan memberi umpan balik "sedang diproses".
export default function SpinnerButton({ loading = false, disabled = false, children, className = '', loadingText, ...rest }) {
  return (
    <button
      {...rest}
      disabled={loading || disabled}
      aria-busy={loading}
      className={`inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      <span>{loading && loadingText ? loadingText : children}</span>
    </button>
  )
}
