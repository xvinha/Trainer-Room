/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--color-primary, #6366F1)',
          'primary-hover': 'var(--color-primary-hover, #4F46E5)',
          secondary: 'var(--color-secondary, #8B5CF6)',
          accent: 'var(--color-accent, #EC4899)',
          bg: 'var(--color-bg, #FFFFFF)',
          surface: 'var(--color-surface, #F8FAFC)',
          border: 'var(--color-border, #E2E8F0)',
          text: 'var(--color-text, #0F172A)',
          'text-muted': 'var(--color-text-muted, #64748B)',
        },
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top, 0px)',
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'safe-left': 'env(safe-area-inset-left, 0px)',
        'safe-right': 'env(safe-area-inset-right, 0px)',
      },
      minHeight: {
        'screen-safe': 'calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom))',
      },
      height: {
        'tab-bar': 'calc(64px + env(safe-area-inset-bottom))',
        'nav-bar': 'calc(56px + env(safe-area-inset-top))',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        'mobile': '0 4px 24px -4px rgba(0, 0, 0, 0.08), 0 2px 8px -2px rgba(0, 0, 0, 0.06)',
        'mobile-lg': '0 12px 40px -8px rgba(0, 0, 0, 0.12), 0 6px 16px -6px rgba(0, 0, 0, 0.08)',
      },
      fontSize: {
        xxs: '0.6875rem',
      },
    },
    screens: {
      xs: '360px',
      sm: '480px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
    },
  },
  plugins: [],
  corePlugins: {
    preflight: true,
  },
};
