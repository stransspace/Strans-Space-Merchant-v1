// src/lib/api.js

export const API_URL = import.meta.env.VITE_API_URL || '';

// Intercept fetch untuk mengubah method PUT dan DELETE menjadi POST dengan header override untuk kompatibilitas LiteSpeed
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async function (resource, options) {
    if (options && (options.method === 'PUT' || options.method === 'DELETE')) {
      const method = options.method;
      const nextHeaders = {
        ...(options.headers || {}),
        'X-HTTP-Method-Override': method
      };
      const nextOptions = {
        ...options,
        method: 'POST',
        headers: nextHeaders
      };
      
      let nextResource = resource;
      if (typeof resource === 'string') {
        const separator = resource.includes('?') ? '&' : '?';
        nextResource = `${resource}${separator}_method=${method}`;
      }
      
      return originalFetch(nextResource, nextOptions);
    }
    return originalFetch(resource, options);
  };
}

export const getSession = () => {
  if (typeof window === 'undefined') return null;
  const cashierRaw = localStorage.getItem('merchant_cashier');
  const tenantRaw = localStorage.getItem('merchant_tenant');
  if (!cashierRaw || !tenantRaw) return null;
  try {
    return {
      cashier: JSON.parse(cashierRaw),
      tenant: JSON.parse(tenantRaw)
    };
  } catch (e) {
    return null;
  }
};

export const setSession = (cashier, tenant, token) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('merchant_cashier', JSON.stringify(cashier));
    localStorage.setItem('merchant_tenant', JSON.stringify(tenant));
    if (token) localStorage.setItem('merchant_token', token);
  }
};

export const clearSession = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('merchant_cashier');
    localStorage.removeItem('merchant_tenant');
    localStorage.removeItem('merchant_active_tenant_id');
    localStorage.removeItem('merchant_token');
  }
};

export const getHeaders = (headers = {}) => {
  const next = { ...headers };
  const session = getSession();
  if (session) {
    if (session.cashier?.id) next['x-cashier-id'] = String(session.cashier.id);
    let activeTenantId = localStorage.getItem('merchant_active_tenant_id');
    if (!activeTenantId || activeTenantId === 'all') {
      activeTenantId = session.tenant?.id;
    }
    if (activeTenantId) next['x-tenant-id'] = String(activeTenantId);
    const token = localStorage.getItem('merchant_token');
    if (token) next['Authorization'] = `Bearer ${token}`;
  }
  return next;
};

const SUBSCRIPTION_BLOCK_CODES = ['SUBSCRIPTION_SUSPENDED', 'OUTLET_SUSPENDED', 'SUBSCRIPTION_EXPIRED'];
// Batas fitur/kuota per tier (bukan akun diblokir) — beda perlakuan dari SUBSCRIPTION_BLOCK_CODES:
// sesi tetap jalan, cukup tampilkan ajakan upgrade. Lihat PLAN_ACCESS_MAP, checkCashierLimit,
// checkProductLimit, dan endpoint /branches di server/src/routes.js.
const PLAN_UPGRADE_CODES = ['PLAN_UPGRADE_REQUIRED', 'BRANCH_LIMIT_REACHED', 'CASHIER_LIMIT_REACHED'];

async function handleResponse(res) {
  if (!res.ok) {
    const text = await res.text();
    try {
      const parsed = JSON.parse(text);
      // Langganan diblokir (ditangguhkan/berakhir) di tengah sesi: bersihkan sesi &
      // arahkan ke login sekali, agar tidak muncul error acak berulang.
      if (res.status === 403 && SUBSCRIPTION_BLOCK_CODES.includes(parsed?.code) && typeof window !== 'undefined') {
        if (!window.__subBlockHandled) {
          window.__subBlockHandled = true;
          try {
            clearSession();
            sessionStorage.setItem('authBlockMessage', parsed.message || 'Sesi Anda diblokir.');
          } catch { /* ignore */ }
          window.location.href = '/';
        }
      }
      // Fitur/kuota di luar paket saat ini: broadcast supaya App.jsx bisa menampilkan
      // modal upgrade yang konsisten dari mana saja, tanpa mengubah tiap catch block
      // pemanggil (yang tetap dapat error.message seperti biasa untuk fallback toast).
      if (res.status === 403 && PLAN_UPGRADE_CODES.includes(parsed?.code) && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('plan-upgrade-required', {
          detail: {
            code: parsed.code,
            message: parsed.message || parsed.error || 'Fitur ini membutuhkan paket lebih tinggi.',
            requiredPlan: parsed.requiredPlan || parsed.data?.nextTier || null,
          }
        }));
      }
      const friendly = parsed?.error || parsed?.message;
      const err = new Error(friendly || text || `Request failed with status ${res.status}`);
      err.data = parsed;
      throw err;
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(text || `Request failed with status ${res.status}`);
      }
      throw err;
    }
  }
  return res.json();
}

// Auth API
export async function loginOwner({ email, pin }) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, pin }),
  });
  const data = await handleResponse(res);
  
  if (data && data.success) {
    const cashier = data.data?.cashier;
    const tenant = data.data?.tenant;
    const token = data.data?.token;

    if (cashier && cashier.role === 'owner') {
      setSession(cashier, tenant, token);
      return { cashier, tenant };
    } else {
      throw new Error('Akses ditolak. Hanya Owner yang dapat mengakses dashboard.');
    }
  }
  throw new Error(data.message || 'Login gagal');
}

// Registrasi mandiri (self-service). Membuat akun OWNER paket Free lalu auto-login.
export async function registerOwner({ businessName, ownerName, email, pin }) {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessName, ownerName, email, pin }),
  });
  const data = await handleResponse(res);

  if (data && data.success) {
    const cashier = data.data?.cashier;
    const tenant = data.data?.tenant;
    const token = data.data?.token;
    const activationCode = data.data?.activation_code;
    setSession(cashier, tenant, token); // auto-login
    return { cashier, tenant, activationCode };
  }
  throw new Error(data.message || 'Pendaftaran gagal');
}

// Kirim ulang email verifikasi (untuk owner yang sedang login).
export async function resendVerification() {
  const res = await fetch(`${API_URL}/api/auth/resend-verification`, {
    method: 'POST',
    headers: getHeaders(),
  });
  return handleResponse(res);
}

export async function loginOwnerWithGoogle({ credential, tenantDomain }) {
  const res = await fetch(`${API_URL}/api/auth/login-google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential, tenant_domain: tenantDomain }),
  });
  const data = await handleResponse(res);

  if (data && data.success) {
    const cashier = data.data?.cashier;
    const tenant = data.data?.tenant;
    const token = data.data?.token;

    if (cashier && cashier.role === 'owner') {
      setSession(cashier, tenant, token);
      return { cashier, tenant };
    } else {
      throw new Error('Akses ditolak. Hanya Owner yang dapat mengakses dashboard.');
    }
  }
  throw new Error(data.message || 'Login Google gagal');
}

// Products API
export async function getProducts() {
  const res = await fetch(`${API_URL}/api/items`, {
    headers: getHeaders()
  });
  return handleResponse(res);
}

export async function createProduct(payload) {
  const res = await fetch(`${API_URL}/api/items`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function updateProduct(id, payload) {
  const res = await fetch(`${API_URL}/api/items/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function deleteProduct(id) {
  const res = await fetch(`${API_URL}/api/items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  return handleResponse(res);
}

// Cashiers API
export async function getCashiers(scope) {
  const url = scope ? `${API_URL}/api/cashiers?scope=${encodeURIComponent(scope)}` : `${API_URL}/api/cashiers`;
  const res = await fetch(url, {
    headers: getHeaders()
  });
  return handleResponse(res);
}

export async function getWallet({ period = 'month', branch = 'all' } = {}) {
  const qs = new URLSearchParams({ period, branch: String(branch) }).toString();
  const res = await fetch(`${API_URL}/api/wallet?${qs}`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function getBankAccounts() {
  const res = await fetch(`${API_URL}/api/bank-accounts`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function addBankAccount(payload) {
  const res = await fetch(`${API_URL}/api/bank-accounts`, {
    method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function deleteBankAccount(id) {
  const res = await fetch(`${API_URL}/api/bank-accounts/${encodeURIComponent(id)}`, { method: 'DELETE', headers: getHeaders() });
  return handleResponse(res);
}

export async function requestPayout(payload) {
  const res = await fetch(`${API_URL}/api/wallet/payouts`, {
    method: 'POST', headers: getHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function getPayouts() {
  const res = await fetch(`${API_URL}/api/wallet/payouts`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function getSubscription() {
  const res = await fetch(`${API_URL}/api/subscription`, { headers: getHeaders() });
  return handleResponse(res);
}

export async function getOnlineShifts(scope) {
  const url = scope ? `${API_URL}/api/cashier/shifts/online?scope=${encodeURIComponent(scope)}` : `${API_URL}/api/cashier/shifts/online`;
  const res = await fetch(url, {
    headers: getHeaders()
  });
  return handleResponse(res);
}

export async function createCashier(payload) {
  const res = await fetch(`${API_URL}/api/cashiers`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function updateCashier(id, payload) {
  const res = await fetch(`${API_URL}/api/cashiers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function deleteCashier(id) {
  const res = await fetch(`${API_URL}/api/cashiers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  return handleResponse(res);
}

// Notifications API
export async function generateTelegramLink(cashierId) {
  const res = await fetch(`${API_URL}/api/cashiers/${encodeURIComponent(cashierId)}/telegram-link`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' })
  });
  return handleResponse(res);
}

export async function setNotifyLowStock(cashierId, enabled) {
  const res = await fetch(`${API_URL}/api/cashiers/${encodeURIComponent(cashierId)}/notify-low-stock`, {
    method: 'PUT',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ enabled })
  });
  return handleResponse(res);
}

// Reports API
export async function getReportsSummary(scope) {
  const url = scope ? `${API_URL}/api/reports/summary?scope=${encodeURIComponent(scope)}` : `${API_URL}/api/reports/summary`;
  const res = await fetch(url, {
    headers: getHeaders()
  });
  return handleResponse(res);
}

export async function getDailyReports(scope) {
  const url = scope ? `${API_URL}/api/reports/daily?scope=${encodeURIComponent(scope)}` : `${API_URL}/api/reports/daily`;
  const res = await fetch(url, {
    headers: getHeaders()
  });
  return handleResponse(res);
}

export async function getBranchesComparison() {
  const res = await fetch(`${API_URL}/api/reports/branches-comparison`, {
    headers: getHeaders()
  });
  return handleResponse(res);
}

export async function getProfitLossReport(scope, startDate, endDate) {
  let url = `${API_URL}/api/reports/profit-loss`;
  const params = [];
  if (scope) params.push(`scope=${encodeURIComponent(scope)}`);
  if (startDate) params.push(`startDate=${encodeURIComponent(startDate)}`);
  if (endDate) params.push(`endDate=${encodeURIComponent(endDate)}`);
  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }
  
  const res = await fetch(url, {
    headers: getHeaders()
  });
  return handleResponse(res);
}

// Subscription API
// Downgrade paket (GRATIS, instan) — hanya untuk pindah ke tier lebih rendah.
export async function upgradeSubscription(plan, months = 1) {
  const res = await fetch(`${API_URL}/api/subscription/upgrade`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ plan, months })
  });
  return handleResponse(res);
}

// Konfigurasi publik (tanpa auth) — mis. Midtrans Client Key utk memuat Snap.js.
export async function getPublicConfig() {
  const res = await fetch(`${API_URL}/api/config/public`);
  return handleResponse(res);
}

// Mulai checkout upgrade/perpanjangan paket berbayar via Midtrans Snap.
// Mengembalikan { token, paymentReference } — token dipakai window.snap.pay(token).
export async function checkoutSubscription(plan, months = 1) {
  const res = await fetch(`${API_URL}/api/subscription/checkout`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ plan, months })
  });
  return handleResponse(res);
}

// Polling status pembayaran checkout (jaga-jaga popup Snap ditutup sebelum webhook masuk).
export async function getSubscriptionCheckoutStatus(reference) {
  const res = await fetch(`${API_URL}/api/subscription/checkout/${encodeURIComponent(reference)}/status`, {
    headers: getHeaders()
  });
  return handleResponse(res);
}

// Branches API
export async function getBranches() {
  const res = await fetch(`${API_URL}/api/branches`, {
    headers: getHeaders()
  });
  return handleResponse(res);
}

// Tambah cabang mandiri (owner). Kuota mengikuti paket perusahaan; jika penuh,
// server balas 403 dengan err.data.code === 'BRANCH_LIMIT_REACHED'.
export async function createBranch(name) {
  const res = await fetch(`${API_URL}/api/branches`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name })
  });
  return handleResponse(res);
}

// Aktif/nonaktifkan cabang (owner). Tidak bisa menonaktifkan cabang aktif terakhir.
export async function setBranchActive(id, isActive) {
  const res = await fetch(`${API_URL}/api/branches/${encodeURIComponent(id)}/status`, {
    method: 'PUT',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ is_active: isActive ? 1 : 0 })
  });
  return handleResponse(res);
}

// Hapus cabang (owner). Diblokir jika cabang terakhir atau masih ada akun kasir
// (err.data.code === 'BRANCH_HAS_CASHIERS').
export async function deleteBranch(id) {
  const res = await fetch(`${API_URL}/api/branches/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  return handleResponse(res);
}

// Materials API
export async function getMaterials() {
  const res = await fetch(`${API_URL}/api/materials`, {
    headers: getHeaders()
  });
  return handleResponse(res);
}

export async function getCentralStock() {
  const res = await fetch(`${API_URL}/api/materials/central-stock`, {
    headers: getHeaders()
  });
  return handleResponse(res);
}

export async function createMaterial(payload) {
  const res = await fetch(`${API_URL}/api/materials`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function updateMaterial(id, payload) {
  const res = await fetch(`${API_URL}/api/materials/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function deleteMaterial(id) {
  const res = await fetch(`${API_URL}/api/materials/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  return handleResponse(res);
}

export async function adjustMaterialStock(id, payload) {
  const res = await fetch(`${API_URL}/api/materials/${encodeURIComponent(id)}/stock`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function updateMaterialStockMin(id, stockMin) {
  const res = await fetch(`${API_URL}/api/materials/${encodeURIComponent(id)}/stock-min`, {
    method: 'PUT',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ stockMin })
  });
  return handleResponse(res);
}

export async function updateItemStockMin(id, stockMin) {
  const res = await fetch(`${API_URL}/api/items/${encodeURIComponent(id)}/stock-min`, {
    method: 'PUT',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ stockMin })
  });
  return handleResponse(res);
}

// Activity Logs API
export async function getActivityLogs(scope, filters = {}) {
  let url = `${API_URL}/api/activity-logs`;
  const params = [];
  if (scope) params.push(`scope=${encodeURIComponent(scope)}`);
  if (filters.startDate) params.push(`startDate=${encodeURIComponent(filters.startDate)}`);
  if (filters.endDate) params.push(`endDate=${encodeURIComponent(filters.endDate)}`);
  if (filters.cashierId) params.push(`cashierId=${encodeURIComponent(filters.cashierId)}`);
  if (filters.action) params.push(`action=${encodeURIComponent(filters.action)}`);
  if (filters.entity) params.push(`entity=${encodeURIComponent(filters.entity)}`);
  if (filters.limit) params.push(`limit=${encodeURIComponent(filters.limit)}`);
  
  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }
  
  const res = await fetch(url, {
    headers: getHeaders()
  });
  return handleResponse(res);
}


// Vouchers API
export async function getVouchers(scope) {
  const url = scope ? `${API_URL}/api/vouchers?scope=${encodeURIComponent(scope)}` : `${API_URL}/api/vouchers`;
  const res = await fetch(url, {
    headers: getHeaders()
  });
  return handleResponse(res);
}

export async function createVoucher(payload) {
  const res = await fetch(`${API_URL}/api/vouchers`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function updateVoucher(id, payload) {
  const res = await fetch(`${API_URL}/api/vouchers/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function deleteVoucher(id) {
  const res = await fetch(`${API_URL}/api/vouchers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  return handleResponse(res);
}

// Expenses API
export async function getExpenses(scope) {
  const url = scope ? `${API_URL}/api/expenses?scope=${encodeURIComponent(scope)}` : `${API_URL}/api/expenses`;
  const res = await fetch(url, {
    headers: getHeaders()
  });
  return handleResponse(res);
}

export async function createExpense(payload) {
  const res = await fetch(`${API_URL}/api/expenses`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function updateExpense(id, payload) {
  const res = await fetch(`${API_URL}/api/expenses/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload)
  });
  return handleResponse(res);
}

export async function deleteExpense(id) {
  const res = await fetch(`${API_URL}/api/expenses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  return handleResponse(res);
}
