/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        // Enterprise Dark Palette
        'base': {
          '100': '#111827', // Primary background (slate-900)
          '200': '#1F2937', // Content cards (slate-800)
          '300': '#374151', // Borders, dividers (slate-700)
        },
        'ink': {
          '700': '#F9FAFB', // Primary text (gray-50)
          '500': '#9CA3AF', // Secondary text (gray-400)
          '400': '#6B7280', // Muted text (gray-500)
        },
        'accent': {
          '700': '#3B82F6', // Primary accent (blue-500)
          '100': '#1E3A8A', // Accent background (blue-900)
        },
        // New High-Contrast Palette
        'success': {
          '900': '#064e3b', // Very Dark BG for containers (emerald-900)
          '700': '#047857', // Button BG (emerald-700)
          '600': '#16a34a', // Solid Badge BG (green-600)
          '400': '#34d399', // Bright Text/Icon (emerald-400)
        },
        'warning': {
          '900': '#78350f', // Very Dark BG for containers (amber-900)
          '600': '#d97706', // Solid Badge BG (amber-600)
          '400': '#fbbf24', // Bright Text/Icon (amber-400)
        },
        'error': {
          '900': '#7f1d1d', // Very Dark BG for containers (red-900)
          '700': '#b91c1c', // Button BG (red-700)
          '600': '#dc2626', // Solid Badge BG (red-600)
          '400': '#f87171', // Bright Text/Icon (red-400)
        }
      }
    }
  },
  plugins: [],
}