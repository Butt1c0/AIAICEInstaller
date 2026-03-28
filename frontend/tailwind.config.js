/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
      colors: {
        terminal: {
          bg: '#0d1117',
          border: '#30363d',
          text: '#e6edf3',
          green: '#3fb950',
          red: '#f85149',
          yellow: '#d29922',
          blue: '#58a6ff',
          muted: '#8b949e',
        },
      },
    },
  },
  plugins: [],
};
