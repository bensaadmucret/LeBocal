/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        lavender: '#c3b4ff',
        lilac: '#ede9ff',
        royal: '#5b3ef1',
        deep: '#120530',
        ink: '#2d224b',
        mist: '#f7f5ff',
      },
      boxShadow: {
        card: '0 20px 45px rgba(91, 62, 241, 0.07)',
      },
    },
  },
  plugins: [],
}
