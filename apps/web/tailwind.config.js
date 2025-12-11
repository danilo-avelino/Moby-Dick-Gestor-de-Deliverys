/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: {
                    50: 'rgb(var(--primary) / 0.05)',
                    100: 'rgb(var(--primary) / 0.1)',
                    200: 'rgb(var(--primary) / 0.2)',
                    300: 'rgb(var(--primary) / 0.3)',
                    400: 'rgb(var(--primary) / 0.4)',
                    500: 'rgb(var(--primary) / 0.5)',
                    600: 'rgb(var(--primary) / 0.6)',
                    700: 'rgb(var(--primary) / 0.7)',
                    800: 'rgb(var(--primary) / 0.8)',
                    900: 'rgb(var(--primary) / 0.9)',
                    950: 'rgb(var(--primary) / 1)',
                    DEFAULT: 'rgb(var(--primary) / 1)',
                },
                secondary: {
                    50: 'rgb(var(--secondary) / 0.05)',
                    100: 'rgb(var(--secondary) / 0.1)',
                    200: 'rgb(var(--secondary) / 0.2)',
                    300: 'rgb(var(--secondary) / 0.3)',
                    400: 'rgb(var(--secondary) / 0.4)',
                    500: 'rgb(var(--secondary) / 0.5)',
                    600: 'rgb(var(--secondary) / 0.6)',
                    700: 'rgb(var(--secondary) / 0.7)',
                    800: 'rgb(var(--secondary) / 0.8)',
                    900: 'rgb(var(--secondary) / 0.9)',
                    950: 'rgb(var(--secondary) / 1)',
                    DEFAULT: 'rgb(var(--secondary) / 1)',
                },
                gray: {
                    750: '#2d374d',
                    850: '#1a2234',
                    950: '#0d1321',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
            animation: {
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'slide-down': 'slideDown 0.3s ease-out',
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                slideDown: {
                    '0%': { opacity: '0', transform: 'translateY(-10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
};
