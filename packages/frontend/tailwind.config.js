/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // NAZAR brand palette — command-center dark theme
        nazar: {
          bg: '#0A0E1A',
          surface: '#111827',
          card: '#1A2235',
          border: '#1E2D45',
          accent: '#3B82F6',
          'accent-glow': '#60A5FA',
          threat: '#EF4444',
          warning: '#F59E0B',
          success: '#10B981',
          muted: '#6B7280',
          text: '#F9FAFB',
          'text-secondary': '#9CA3AF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        hindi: ['Noto Sans Devanagari', 'sans-serif'],
      },
      animation: {
        'pulse-threat': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
