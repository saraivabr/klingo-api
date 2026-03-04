/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        irb: {
          primary: '#0D9488',
          dark: '#0F766E',
          light: '#99F6E4',
          bg: '#F0FDFA',
        },
      },
    },
  },
  plugins: [],
};
