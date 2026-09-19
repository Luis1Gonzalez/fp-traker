/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: '#14171C',
          900: '#1C2128',
          800: '#242A33',
          700: '#333B47',
          600: '#4A5568',
        },
        blueprint: {
          600: '#1E3A5F',
          500: '#2B4C6F',
          400: '#3D6489',
          100: '#E4ECF3',
        },
        signal: {
          600: '#D9722C',
          500: '#E8873A',
          400: '#F2A93C',
          100: '#FBEBD6',
        },
        paper: '#F5F3EE',
        ok: '#1F8A4C',
        danger: '#B54747',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
