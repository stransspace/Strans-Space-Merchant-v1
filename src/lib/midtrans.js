// Pemuat Midtrans Snap.js sekali saja (lazy) — dipakai untuk checkout upgrade paket.
let snapLoadPromise = null;

export function loadMidtransSnap(clientKey, isProduction) {
  if (typeof window === 'undefined') return Promise.reject(new Error('Snap hanya bisa dimuat di browser.'));
  if (window.snap) return Promise.resolve(window.snap);
  if (snapLoadPromise) return snapLoadPromise;

  snapLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = isProduction ? 'https://app.midtrans.com/snap/snap.js' : 'https://app.sandbox.midtrans.com/snap/snap.js';
    script.setAttribute('data-client-key', clientKey);
    script.onload = () => (window.snap ? resolve(window.snap) : reject(new Error('Snap.js gagal dimuat.')));
    script.onerror = () => reject(new Error('Gagal memuat Snap.js dari Midtrans.'));
    document.head.appendChild(script);
  }).catch((err) => {
    snapLoadPromise = null; // izinkan retry di percobaan berikutnya kalau gagal
    throw err;
  });

  return snapLoadPromise;
}
