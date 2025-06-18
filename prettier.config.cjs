module.exports = {
  plugins: [
    require.resolve('@trivago/prettier-plugin-sort-imports'),
    require.resolve('prettier-plugin-tailwindcss'),
  ],
  singleQuote: true,
  trailingComma: 'all',
  importOrder: [
    '<THIRD_PARTY_MODULES>', // External libraries first
    '^[../]', // Parent imports  
    '^[./]', // Same-directory imports
  ],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
};
