import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: [
      { find: /^@\/components\//, replacement: `${path.resolve(__dirname, 'src/components')}/` },
      { find: /^@\/modules\//, replacement: `${path.resolve(__dirname, 'src/modules')}/` },
      { find: /^@\/net\//, replacement: `${path.resolve(__dirname, 'src/net')}/` },
      { find: /^@\//, replacement: `${path.resolve(__dirname)}/` },
    ],
  },
});
