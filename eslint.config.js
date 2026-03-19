import js from '@eslint/js';
import globals from 'globals';

/** Корень репозитория: клиент (браузер), сервер и tooling (Node). */
export default [
  {
    ignores: [
      '**/node_modules/**',
      'client/dist/**',
      'shared/dist/**',
      'shared/src/**',
      'server/dist/**',
      'server/**/*.ts',
      'client/src/**/*.ts',
      'archive/**',
      '**/coverage/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['ecosystem.config.cjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
  {
    files: ['server/**/*.js', 'server.js', 'eslint.config.js', 'tools/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['client/vite.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
  {
    files: ['client/src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Крупный gameClient: постепенно ужесточать
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['client/src/game/gameClient.js'],
    rules: {
      'no-unused-vars': 'off',
    },
  },
  {
    files: ['client/src/**/*.test.js', 'vitest.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
];
