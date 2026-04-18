/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#172554',
        },
        surface: {
          root:     '#0B0F14',
          DEFAULT:  '#111827',
          elevated: '#1F2937',
          hover:    '#243044',
        },
      },
      borderColor: {
        subtle:  'rgba(255, 255, 255, 0.06)',
        default: 'rgba(255, 255, 255, 0.1)',
      },
      boxShadow: {
        glow:       '0 0 20px rgba(59, 130, 246, 0.15)',
        'glow-lg':  '0 0 30px rgba(59, 130, 246, 0.25)',
        'glow-purple': '0 0 20px rgba(139, 92, 246, 0.15)',
        soft:       '0 4px 12px rgba(0, 0, 0, 0.4)',
        deep:       '0 8px 24px rgba(0, 0, 0, 0.5)',
      },
      borderRadius: {
        'xl':  '12px',
        '2xl': '16px',
        '3xl': '20px',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      animation: {
        'fade-in':       'fadeIn 300ms ease-out forwards',
        'fade-in-scale': 'fadeInScale 200ms ease-out forwards',
        'slide-right':   'slideInRight 300ms ease-out forwards',
        'slide-left':    'slideInLeft 300ms ease-out forwards',
        'glow-pulse':    'glowPulse 2s ease-in-out infinite',
        'shimmer':       'shimmer 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:       { from: { opacity: '0', transform: 'translateY(8px)' },  to: { opacity: '1', transform: 'translateY(0)' }},
        fadeInScale:  { from: { opacity: '0', transform: 'scale(0.96)' },      to: { opacity: '1', transform: 'scale(1)' }},
        slideInRight: { from: { opacity: '0', transform: 'translateX(12px)' }, to: { opacity: '1', transform: 'translateX(0)' }},
        slideInLeft:  { from: { opacity: '0', transform: 'translateX(-12px)' },to: { opacity: '1', transform: 'translateX(0)' }},
        glowPulse:    { '0%, 100%': { boxShadow: '0 0 12px rgba(59, 130, 246, 0.1)' }, '50%': { boxShadow: '0 0 24px rgba(59, 130, 246, 0.25)' }},
        shimmer:      { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' }},
      },
      transitionDuration: {
        DEFAULT: '220ms',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
};
