import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import reactPlugin from 'eslint-plugin-react';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: ['dist/', 'coverage/', 'public/', '**/public/', '**/dist/'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    plugins: {
      react: reactPlugin,
      import: importPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      '@typescript-eslint/ban-ts-comment': 0,
      '@typescript-eslint/no-empty-function': 0,
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-namespace': 0,
      '@typescript-eslint/no-non-null-assertion': 0,
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          ignoreRestSiblings: true,
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-var-requires': 0,
      'array-bracket-spacing': [2, 'never'],
      'arrow-parens': [2, 'always'],
      'arrow-spacing': 2,
      'brace-style': [
        2,
        '1tbs',
        {
          allowSingleLine: true,
        },
      ],
      complexity: ['warn', 10],
      'eol-last': 2,
      'max-depth': ['warn', 3],
      'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['warn', { max: 50, skipBlankLines: true, skipComments: true }],
      'max-nested-callbacks': ['warn', 4],
      'max-params': ['warn', 4],
      'max-statements': ['warn', 30],
      'import/no-duplicates': 2,
      'import/no-extraneous-dependencies': [2],
      'import/no-namespace': 2,
      'import/order': 0,
      // Prohibit wildcard re-exports (export * from) to improve tree-shaking,
      // reduce circular dependencies, and maintain explicit API surfaces.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportAllDeclaration',
          message:
            'Wildcard re-exports (export * from) are prohibited. Use explicit named exports instead: export { name1, name2 } from "./module"',
        },
      ],
      'no-console': 0,
      'no-const-assign': 2,
      'no-extra-parens': [2, 'functions'],
      'no-irregular-whitespace': 2,
      'no-this-before-super': 2,
      'no-unused-expressions': 2,
      'no-unused-labels': 1,
      'no-unused-vars': 0,
      'no-var': 2,
      'object-curly-spacing': 0,
      'object-shorthand': 2,
      'prefer-arrow-callback': 2,
      'prefer-const': 2,
      'react/jsx-sort-props': 2,
      'react/prop-types': 0,
      'react/react-in-jsx-scope': 0,
      semi: [2, 'always'],
      'sort-keys': 0,
      'space-before-blocks': 2,
      'space-before-function-paren': [
        2,
        { anonymous: 'always', asyncArrow: 'always', named: 'never' },
      ],
    },
    settings: {
      react: {
        version: '18.0.0',
      },
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      'react/display-name': 0,
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      complexity: 'off',
      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: true,
          peerDependencies: true,
          optionalDependencies: false,
        },
      ],
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
      'max-statements': 'off',
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        module: 'readonly',
        require: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
];
