/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './packages/web-client/src/**/*.{js,jsx,ts,tsx}',
    'node_modules/flowbite-react/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'media',
  mode: 'jit',
  plugins: [require('@tailwindcss/typography'), require('flowbite/plugin')],
};
