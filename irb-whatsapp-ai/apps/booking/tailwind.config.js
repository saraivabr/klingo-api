/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        irb: {
          primary: '#1B2A4A',
          dark: '#0F1D35',
          light: '#2D4A7A',
          gold: '#C5A55A',
          'gold-light': '#D4BB7A',
          'gold-dark': '#A8893E',
          bg: '#F8F9FB',
          accent: '#E8D5A0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
