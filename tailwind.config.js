/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        naver: {
          DEFAULT: '#03c75a',
          dark: '#02864a',
          pale: '#e9fbf1',
        },
        ink: {
          DEFAULT: '#1c1c1c',
          portal: '#2e2e2e',
          muted: '#8c8c8c',
          corporate: '#1a1d24',
        },
        hairline: '#e5e5e5',
        link: '#0c43b7',
        canvas: '#ffffff',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Apple SD Gothic Neo', 'Noto Sans KR', 'sans-serif'],
      },
      borderRadius: {
        card: '12px',
        chip: '18px',
      },
      boxShadow: {
        quiet: '0 1px 2px rgba(0, 0, 0, 0.06)',
        card: '0 1px 3px rgba(0, 0, 0, 0.08)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 220ms ease-out',
      },
    },
  },
  plugins: [],
};
