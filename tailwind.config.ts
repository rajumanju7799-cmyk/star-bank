/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'star': {
          '50': '#fef3f2',
          '100': '#fde8e6',
          '200': '#fad6cf',
          '300': '#f7bba9',
          '400': '#f39577',
          '500': '#eb6b4a',
          '600': '#d94832',
          '700': '#b83a27',
          '800': '#983025',
          '900': '#7d2b23',
        },
        'kid': {
          '100': '#fef3f2',
          '200': '#ffe6d5',
          '300': '#ffd4b8',
          '400': '#ffc29a',
          '500': '#ffb380',
          '600': '#ff9f61',
          '700': '#ff8b42',
          '800': '#ff7723',
          '900': '#e65c0b',
        }
      },
      fontFamily: {
        'title': ['Comic Sans MS', 'cursive'],
        'body': ['Arial', 'sans-serif'],
      },
      animation: {
        'bounce': 'bounce 1s infinite',
        'spin': 'spin 1s linear infinite',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'wiggle': 'wiggle 0.2s ease-in-out infinite',
      },
      keyframes: {
        'wiggle': {
          '0%, 100%': { transform: 'rotate(-1deg)' },
          '50%': { transform: 'rotate(1deg)' },
        }
      }
    },
  },
  plugins: [],
}

