/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./setup.ts'],
    environmentOptions: {
      jsdom: {
        resources: 'usable',
      },
    },
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'node_modules', 
      'dist', 
      '.turbo',
      '**/integration/**',
      '**/server-mail.test.ts'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'setup.ts',
        '**/*.d.ts',
        '**/*.config.*',
        '**/dist/**',
        '**/.turbo/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../apps/mail'),
      '@zero/server': path.resolve(__dirname, '../../apps/server/src'),
      '@zero/mail': path.resolve(__dirname, '../../apps/mail'),
      'cloudflare:workers': path.resolve(__dirname, './mocks/cloudflare-workers-mock.js'),
      'nuqs': path.resolve(__dirname, './mocks/nuqs-mock.js')
    }
  },
  esbuild: {
    jsx: 'automatic',
  }
});