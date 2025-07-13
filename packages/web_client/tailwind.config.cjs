/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './*.html',
    'node_modules/flowbite-react/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'media',
  mode: 'jit',
  plugins: [require('@tailwindcss/typography'), require('flowbite/plugin')],
};
