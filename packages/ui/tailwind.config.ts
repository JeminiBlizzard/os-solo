import type { Config } from 'tailwindcss';

/**
 * OS // SOLO Design System - Carbon-inspired tokens
 *
 * Purple tokens (ai.*) are reserved for AI-related UI elements only.
 * Do not use for general accents.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Carbon gray scale - core neutral palette
        gray: {
          10: '#f4f4f4',
          20: '#e0e0e0',
          30: '#c6c6c6',
          40: '#a8a8a8',
          50: '#8d8d8d',
          60: '#6f6f6f',
          70: '#525252',
          80: '#393939',
          90: '#262626',
          100: '#161616',
        },
        // Carbon blue - primary brand color
        brand: {
          DEFAULT: '#0f62fe',
        },
        // AI purple - RESERVED FOR AI-RELATED UI ELEMENTS ONLY
        ai: {
          DEFAULT: '#8a3ffc',
          subtle: '#d4bbff',
          strong: '#6929c4',
        },
        // Semantic colors (Carbon-aligned)
        success: '#24a148',
        warning: '#f1c21b',
        danger: '#da1e28',
        info: '#0043ce',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        none: '0',
        DEFAULT: '0', // Carbon uses sharp corners by default
      },
    },
  },
  plugins: [],
} satisfies Config;
