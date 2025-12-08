/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#f0fdfd',
                    100: '#ccfbf9',
                    200: '#99f6f4',
                    300: '#5dd9da',
                    400: '#3db5b5',
                    500: '#2a8c8c',
                    600: '#1f7070',
                    700: '#1a5959',
                    800: '#174747',
                    900: '#163b3b',
                    950: '#0a2323',
                },
                secondary: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#4a9bc4',
                    500: '#2e7ba8',
                    600: '#1d5a7d',
                    700: '#164868',
                    800: '#153d56',
                    900: '#153349',
                    950: '#0e2130',
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
