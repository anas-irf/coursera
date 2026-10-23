// The design tokens live in src/index.css as CSS variables (one set for light, one for dark);
// the names below are what the components use, so a colour is changed in one place and both
// themes follow.  Pages use these names only: no raw palette colours.
const defaultTheme = require('tailwindcss/defaultTheme');

const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

// a solid colour, a soft tint behind text, and the colour of text in that tone
const tone = (name) => ({
  DEFAULT: token(name),
  soft: token(`${name}-soft`),
  fg: token(`${name}-fg`),
});

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        canvas: token('canvas'),
        surface: {
          DEFAULT: token('surface'),
          muted: token('surface-muted'),
          raised: token('surface-raised'),
        },
        line: {
          DEFAULT: token('line'),
          strong: token('line-strong'),
        },
        fg: {
          DEFAULT: token('fg'),
          muted: token('fg-muted'),
          subtle: token('fg-subtle'),
        },
        primary: {
          ...tone('primary'),
          hover: token('primary-hover'),
          contrast: token('primary-contrast'),
        },
        success: tone('success'),
        warning: tone('warning'),
        danger: tone('danger'),
        info: tone('info'),
        plus: tone('plus'),
        ring: token('ring'),
        // the brand ramp, for gradients and illustrations (the same in both themes)
        brand: {
          50: '#ebf3ff',
          100: '#d6e6ff',
          200: '#adcdff',
          300: '#7aaeff',
          400: '#4088f5',
          500: '#1a6fe8',
          600: '#0056d2',
          700: '#0047ad',
          800: '#003a8c',
          900: '#002f70',
          950: '#001d47',
        },
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', ...defaultTheme.fontFamily.sans],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(15 23 42 / 0.05)',
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'scale-in': 'scale-in 150ms ease-out',
        'slide-in-left': 'slide-in-left 200ms ease-out',
        'slide-up': 'slide-up 200ms ease-out',
      },
    },
  },
  plugins: [],
};
