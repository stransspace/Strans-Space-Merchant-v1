// Definisi tier paket langganan sisi frontend — mirror dari PLAN_CONFIG di
// server/src/routes.js. Dipakai untuk mengunci UI secara proaktif (sebelum request
// ke backend) & menampilkan nama paket asli tenant. Backend tetap satu-satunya
// sumber kebenaran penegakan (server-authoritative) — ini murni untuk UX, jangan
// jadikan satu-satunya lapisan proteksi.
export const PLAN_CONFIG = [
  { slug: 'rintis', rank: 0, label: 'Rintis Space', aliases: ['free', 'basic', 'starter', ''], branchLimit: 1 },
  { slug: 'toko', rank: 1, label: 'Toko Space', aliases: [], branchLimit: 1 },
  { slug: 'cabang', rank: 2, label: 'Cabang Space', aliases: ['standard'], branchLimit: 3 },
  { slug: 'juragan', rank: 3, label: 'Juragan Space (AI)', aliases: ['premium', 'enterprise'], branchLimit: null },
];

// Shortcut rank per slug, dipakai untuk anotasi `requiresPlanRank` di navigation.js
// tanpa angka ajaib berulang.
export const PLAN_RANK = Object.fromEntries(PLAN_CONFIG.map((p) => [p.slug, p.rank]));

const PLAN_BY_SLUG = Object.fromEntries(PLAN_CONFIG.map((p) => [p.slug, p]));
const PLAN_ALIAS_TO_SLUG = PLAN_CONFIG.reduce((acc, p) => {
  for (const alias of p.aliases) acc[alias] = p.slug;
  return acc;
}, {});

export const normalizePlan = (plan) => {
  const raw = String(plan || '').trim().toLowerCase();
  if (PLAN_BY_SLUG[raw]) return raw;
  return PLAN_ALIAS_TO_SLUG[raw] || 'rintis';
};

export const planConfigFor = (plan) => PLAN_BY_SLUG[normalizePlan(plan)];
export const planRank = (plan) => planConfigFor(plan).rank;
export const planLabel = (plan) => planConfigFor(plan).label;
export const branchLimitFor = (plan) => planConfigFor(plan).branchLimit;

export const nextPlanLabel = (plan) => {
  const next = PLAN_CONFIG.find((p) => p.rank === planRank(plan) + 1);
  return next ? next.label : PLAN_CONFIG[PLAN_CONFIG.length - 1].label;
};

export const planLabelForRank = (rank) =>
  (PLAN_CONFIG.find((p) => p.rank === rank) || PLAN_CONFIG[PLAN_CONFIG.length - 1]).label;
