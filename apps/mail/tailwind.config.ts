import { default as flattenColorPalette } from 'tailwindcss/lib/util/flattenColorPalette';
import sharedConfig from '../../packages/tailwind-config/tailwind.config';
import defaultTheme from 'tailwindcss/defaultTheme';
import scrollbar from 'tailwind-scrollbar';
import animate from 'tailwindcss-animate';

import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  presets: [sharedConfig],
  theme: {
    extend: {
      colors: {
        darkBackground: '#141414',
        lightBackground: '#FFFFFF',
        offsetDark: '#0A0A0A',
        offsetLight: '#F5F5F5',
        panelDark: '#1A1A1A',
        panelLight: '#FFFFFF',
        iconDark: '#898989',
        iconLight: '#6D6D6D',
        logout: '#D93036',
        mainBlue: '#437DFB',
        subtleWhite: '#EAEAEA',
        subtleBlack: '#1F1F1F',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        skyBlue: '#0066FF',
        shinyGray: '#A1A1A1',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        chart: {
          '1': 'var(--chart-1)',
          '2': 'var(--chart-2)',
          '3': 'var(--chart-3)',
          '4': 'var(--chart-4)',
          '5': 'var(--chart-5)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar-background)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: [
          '"Geist Variable"',
          'Geist',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'system-ui',
          'sans-serif',
          ...defaultTheme.fontFamily.sans,
        ],
        mono: [
          '"Geist Mono Variable"',
          '"Geist Mono"',
          'ui-monospace',
          'SFMono-Regular',
          '"SF Mono"',
          'Consolas',
          '"Liberation Mono"',
          'Menlo',
          'monospace',
          ...defaultTheme.fontFamily.mono,
        ],
      },
      keyframes: {
        'fade-up': {
          '0%': {
            transform: 'translateY(10px)',
          },
          '100%': {
            transform: 'translateY(0)',
          },
        },
        moveUp: {
          '0%': {
            transform: 'translateY(90px)',
            opacity: '0',
          },
          '100%': {
            transform: 'translateY(0)',
            opacity: '1',
          },
        },
        fadeIn: {
          '0%': {
            opacity: '0',
          },
          '100%': {
            opacity: '1',
          },
        },
        shine: {
          from: {
            backgroundPosition: '200% 0',
          },
          to: {
            backgroundPosition: '-200% 0',
          },
        },
        'shine-slow': {
          from: {
            backgroundPosition: '200% 0',
          },
          to: {
            backgroundPosition: '-200% 0',
          },
        },
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        gauge_fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        gauge_fill: {
          from: { 'stroke-dashoffset': '332', opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'move-up': 'moveUp 3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in': 'fadeIn 3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        shine: 'shine 4s linear infinite',
        'shine-slow': 'shine-slow 8s linear infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        gauge_fadeIn: 'gauge_fadeIn 1s ease forwards',
        gauge_fill: 'gauge_fill 1s ease forwards',
      },
    },
  },
  plugins: [
    animate,
    addVariablesForColors,
    function ({ matchUtilities, theme }: any) {
      matchUtilities({ values: flattenColorPalette(theme('backgroundColor')), type: 'color' });
    },
    scrollbar({
      nocompatible: true,
      preferredStrategy: 'pseudoelements',
    }),
  ],
} satisfies Config;

function addVariablesForColors({ addBase, theme }: any) {
  const allColors = flattenColorPalette(theme('colors'));
  const newVars = Object.fromEntries(
    Object.entries(allColors).map(([key, val]) => [`--${key}`, val]),
  );

  addBase({
    ':root': newVars,
  });
}
