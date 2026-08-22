/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand Kit Primary Colors
        primary: {
          DEFAULT: '#3300FF',
          50: '#E8E0FF',
          100: '#C7B3FF',
          200: '#9966FF',
          300: '#6633FF',
          400: '#4400FF',
          500: '#3300FF',
          600: '#2900CC',
          700: '#1F0099',
          800: '#140066',
          900: '#0A0033',
        },
        cyan: {
          DEFAULT: '#00D4FF',
          400: '#00D4FF',
          500: '#00AACC',
        },
        // Original design system colors
        'void-black': '#030303',
        'surface-deep': '#050505',
        'surface': '#131313',
        'surface-container-low': '#1b1b1b',
        'surface-container': '#1f1f1f',
        'surface-container-high': '#2a2a2a',
        'surface-container-highest': '#353535',
        'surface-variant': '#353535',
        'glimmer-gray': '#1A1A1A',
        'stark-white': '#FFFFFF',
        'silver-accent': '#A0A0A0',
        'on-surface': '#e2e2e2',
        'on-surface-variant': '#c4c7c8',
        'on-primary-container': '#636565',
      },
      spacing: {
        'margin-mobile': '24px',
        'section-gap': '160px',
        'gutter': '32px',
        'unit': '8px',
        'margin-desktop': '80px',
      },
      fontFamily: {
        pixel: ['"Space Mono"', 'monospace'],
        mono: ['"Space Mono"', '"JetBrains Mono"', 'monospace'],
        // Original fonts
        'headline-display': ['Montserrat', 'sans-serif'],
        'headline-lg': ['Montserrat', 'sans-serif'],
        'headline-md': ['Montserrat', 'sans-serif'],
        'body-lg': ['Inter', 'sans-serif'],
        'body-md': ['Inter', 'sans-serif'],
        'label-mono': ['"Space Mono"', 'monospace'],
        'label-caps': ['Inter', 'sans-serif'],
      },
      fontSize: {
        'headline-display': ['120px', { lineHeight: '110px', letterSpacing: '-0.04em', fontWeight: '900' }],
        'headline-lg': ['64px', { lineHeight: '72px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md': ['32px', { lineHeight: '40px', fontWeight: '600' }],
        'body-lg': ['20px', { lineHeight: '32px', fontWeight: '400' }],
        'body-md': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'label-mono': ['11px', { lineHeight: '20px', letterSpacing: '0.15em', fontWeight: '500' }],
        'label-caps': ['10px', { lineHeight: '16px', letterSpacing: '0.2em', fontWeight: '700' }],
      },
      animation: {
        'glitch': 'glitch 2s infinite linear alternate-reverse',
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'blink': 'blink 1s step-end infinite',
      },
      keyframes: {
        glitch: {
          '0%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
          '100%': { transform: 'translate(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px #3300FF, 0 0 10px #3300FF' },
          '50%': { boxShadow: '0 0 20px #3300FF, 0 0 40px #00D4FF' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
