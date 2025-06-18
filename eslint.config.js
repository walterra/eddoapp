import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import importPlugin from 'eslint-plugin-import';

export default [
  {
    ignores: ['dist/', 'coverage/'],
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
      '@typescript-eslint/no-namespace': 0,
      '@typescript-eslint/no-non-null-assertion': 0,
      '@typescript-eslint/no-unused-vars': [
        'error',
        { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
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
      'eol-last': 2,
      'import/no-duplicates': 2,
      'import/no-extraneous-dependencies': [2],
      'import/no-namespace': 2,
      'import/order': 0,
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
];