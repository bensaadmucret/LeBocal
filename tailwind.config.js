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
        sage: '#95a392',
        clay: '#c9b0a1',
        mist: '#f6eede',
        surface: '#faf9f6',
        anthracite: '#3c4146',
      },
      boxShadow: {
        card: '0 20px 45px rgba(78, 67, 51, 0.05)',
      },
    },
  },
  plugins: [],
}
