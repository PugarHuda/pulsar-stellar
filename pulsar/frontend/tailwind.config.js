/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        stellar: {
          50: '#f0f4ff',
          100: '#e0e9ff',
          500: '#3b5bdb',
          600: '#2f4ac7',
          700: '#2340b0',
          900: '#0f1f6b',
        },
        pulsar: {
          accent: '#7c3aed',
          glow: '#a78bfa',
        },
      },
    },
  },
  plugins: [],
}
