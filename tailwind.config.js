/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('./packages/ui/tailwind.preset.js')],
  content: [
    './apps/web/src/**/*.{ts,tsx}',
    './apps/admin/src/**/*.{ts,tsx}',
    './modules/*/frontend/**/*.{ts,tsx}',
    './modules/*/admin/**/*.{ts,tsx}',
    './packages/ui/src/**/*.{ts,tsx}',
  ],
  plugins: [],
};
