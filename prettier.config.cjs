module.exports = {
  plugins: [
    require.resolve('prettier-plugin-organize-imports'),
    require.resolve('prettier-plugin-tailwindcss'),
  ],
  printWidth: 100,
  singleQuote: true,
  trailingComma: 'all',
};
