/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './packages/web_server/src/client/**/*.{js,jsx,ts,tsx}',
    './packages/web_server/src/client.tsx',
    'node_modules/flowbite-react/**/*.{js,jsx,ts,tsx}',
  ],
  darkMode: 'media',
  mode: 'jit',
  plugins: [require('@tailwindcss/typography'), require('flowbite/plugin')],
};
