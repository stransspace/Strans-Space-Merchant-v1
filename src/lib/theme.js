// Theme & Preferences Manager for Strans Space

export const THEME_PALETTES = {
  emerald: {
    id: 'emerald',
    name: 'Strans Emerald (Bawaan)',
    colorHex: '#009a63',
    vars: {
      '--color-brand-50': '#f0fdf4',
      '--color-brand-100': '#dcfce7',
      '--color-brand-200': '#bbf7d0',
      '--color-brand-300': '#86efac',
      '--color-brand-400': '#4ade80',
      '--color-brand-500': '#22c55e',
      '--color-brand-600': '#009a63',
      '--color-brand-700': '#008053',
      '--color-brand-800': '#006642',
      '--color-brand-900': '#004d32',
      '--color-brand-950': '#003321',
      '--shadow-glow-brand': '0 10px 25px -5px rgba(0, 154, 99, 0.4)'
    }
  },
  blue: {
    id: 'blue',
    name: 'Ocean Blue',
    colorHex: '#2563eb',
    vars: {
      '--color-brand-50': '#eff6ff',
      '--color-brand-100': '#dbeafe',
      '--color-brand-200': '#bfdbfe',
      '--color-brand-300': '#93c5fd',
      '--color-brand-400': '#60a5fa',
      '--color-brand-500': '#3b82f6',
      '--color-brand-600': '#2563eb',
      '--color-brand-700': '#1d4ed8',
      '--color-brand-800': '#1e40af',
      '--color-brand-900': '#1e3a8a',
      '--color-brand-950': '#172554',
      '--shadow-glow-brand': '0 10px 25px -5px rgba(37, 99, 235, 0.4)'
    }
  },
  violet: {
    id: 'violet',
    name: 'Violet Royal',
    colorHex: '#7c3aed',
    vars: {
      '--color-brand-50': '#f5f3ff',
      '--color-brand-100': '#ede9fe',
      '--color-brand-200': '#ddd6fe',
      '--color-brand-300': '#c4b5fd',
      '--color-brand-400': '#a78bfa',
      '--color-brand-500': '#8b5cf6',
      '--color-brand-600': '#7c3aed',
      '--color-brand-700': '#6d28d9',
      '--color-brand-800': '#5b21b6',
      '--color-brand-900': '#4c1d95',
      '--color-brand-950': '#2e1065',
      '--shadow-glow-brand': '0 10px 25px -5px rgba(124, 58, 237, 0.4)'
    }
  },
  amber: {
    id: 'amber',
    name: 'Amber Glow',
    colorHex: '#d97706',
    vars: {
      '--color-brand-50': '#fffbeb',
      '--color-brand-100': '#fef3c7',
      '--color-brand-200': '#fde68a',
      '--color-brand-300': '#fcd34d',
      '--color-brand-400': '#fbbf24',
      '--color-brand-500': '#f59e0b',
      '--color-brand-600': '#d97706',
      '--color-brand-700': '#b45309',
      '--color-brand-800': '#92400e',
      '--color-brand-900': '#78350f',
      '--color-brand-950': '#451a03',
      '--shadow-glow-brand': '0 10px 25px -5px rgba(217, 119, 6, 0.4)'
    }
  },
  rose: {
    id: 'rose',
    name: 'Rose Sunset',
    colorHex: '#e11d48',
    vars: {
      '--color-brand-50': '#fff1f2',
      '--color-brand-100': '#ffe4e6',
      '--color-brand-200': '#fecdd3',
      '--color-brand-300': '#fda4af',
      '--color-brand-400': '#fb7185',
      '--color-brand-500': '#f43f5e',
      '--color-brand-600': '#e11d48',
      '--color-brand-700': '#be123c',
      '--color-brand-800': '#9f1239',
      '--color-brand-900': '#881337',
      '--color-brand-950': '#4c0519',
      '--shadow-glow-brand': '0 10px 25px -5px rgba(225, 29, 72, 0.4)'
    }
  }
};

export function applyThemePalette(paletteId) {
  const palette = THEME_PALETTES[paletteId] || THEME_PALETTES.emerald;
  const root = document.documentElement;
  root.setAttribute('data-color-theme', palette.id);
  
  Object.entries(palette.vars).forEach(([prop, val]) => {
    root.style.setProperty(prop, val);
  });

  try {
    localStorage.setItem('strans_theme_color', palette.id);
  } catch {}
}

export function applyThemeMode(mode) {
  const root = document.documentElement;
  let isDark = false;

  if (mode === 'dark') {
    isDark = true;
  } else if (mode === 'system') {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } else {
    isDark = false;
  }

  if (isDark) {
    root.classList.add('dark');
    root.style.setProperty('--background', '#0b0f19');
    root.style.setProperty('--foreground', '#f8fafc');
    root.style.setProperty('--card', '#111827');
    root.style.setProperty('--border', '#1f2937');
    root.style.setProperty('--color-ink', '#f8fafc');
    root.style.setProperty('--color-snow', '#111827');
    root.style.setProperty('--color-hairline', '#1f2937');
    root.style.setProperty('--color-slate-body', '#94a3b8');
    root.style.setProperty('--color-slate-muted', '#64748b');
  } else {
    root.classList.remove('dark');
    root.style.setProperty('--background', '#f8fafc');
    root.style.setProperty('--foreground', '#0f172a');
    root.style.setProperty('--card', '#ffffff');
    root.style.setProperty('--border', '#e2e8f0');
    root.style.setProperty('--color-ink', '#0f172a');
    root.style.setProperty('--color-snow', '#f8fafc');
    root.style.setProperty('--color-hairline', '#e2e8f0');
    root.style.setProperty('--color-slate-body', '#475569');
    root.style.setProperty('--color-slate-muted', '#64748b');
  }

  try {
    localStorage.setItem('strans_theme_mode', mode);
  } catch {}
}

export function getSavedPreferences() {
  try {
    const themeColor = localStorage.getItem('strans_theme_color') || 'emerald';
    const themeMode = localStorage.getItem('strans_theme_mode') || 'light';
    const lang = localStorage.getItem('strans_lang') || 'id';
    const profile = JSON.parse(localStorage.getItem('strans_profile') || 'null');
    const toggles = JSON.parse(localStorage.getItem('strans_toggles') || 'null');

    return {
      themeColor,
      themeMode,
      lang,
      profile,
      toggles
    };
  } catch {
    return {
      themeColor: 'emerald',
      themeMode: 'light',
      lang: 'id',
      profile: null,
      toggles: null
    };
  }
}
