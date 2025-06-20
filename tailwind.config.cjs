/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './packages/client/src/**/*.{js,jsx,ts,tsx}',
    './packages/client/*.html',
    'node_modules/flowbite-react/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'media',
  mode: 'jit',
  plugins: [require('@tailwindcss/typography'), require('flowbite/plugin')],
};
