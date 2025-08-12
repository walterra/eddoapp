/** @type {import('tailwindcss').Config} */
module.exports = {
  // Tailwind v4 auto-discovers content from source files
  // Configuration moved to CSS file using @import, @plugin, and @source directives
  darkMode: 'media',
  plugins: [
    require('@tailwindcss/typography'),
  ],
};