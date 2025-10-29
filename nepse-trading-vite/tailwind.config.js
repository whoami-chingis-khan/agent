/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Golden Ratio Palette (Dark Mode Optimized)
        primary: {
          50: '#FFF9E6',
          100: '#FFF0B3',
          200: '#FFE680',
          300: '#FFDD4D',
          400: '#FFD31A',
          500: '#D4AF37',  // Golden
          600: '#B8942F',
          700: '#9C7A27',
          800: '#80601F',
          900: '#644617',
        },
        dark: {
          50: '#F5F5F5',
          100: '#E0E0E0',
          200: '#BDBDBD',
          300: '#9E9E9E',
          400: '#757575',
          500: '#616161',
          600: '#424242',
          700: '#303030',
          800: '#212121',
          900: '#0A0A0A',
          950: '#000000',
        },
        accent: {
          green: '#3FB950',  // Success/Buy
          red: '#F85149',    // Error/Sell
          blue: '#58A6FF',   // Info
          purple: '#BC8CFF', // Special
        }
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      spacing: {
        // Golden ratio spacing
        'gr-xs': '0.382rem',  // φ⁻³
        'gr-sm': '0.618rem',  // φ⁻²
        'gr-md': '1rem',      // φ⁰
        'gr-lg': '1.618rem',  // φ¹
        'gr-xl': '2.618rem',  // φ²
        'gr-2xl': '4.236rem', // φ³
      },
    },
  },
  plugins: [],
}
