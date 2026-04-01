import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

/** Разрешение `#shared/*` как в рантайме Node (package.json `imports`). */
const sharedAlias = {
    '#shared/protocol.js': path.join(root, 'shared/dist/protocol.js'),
    '#shared/map.js': path.join(root, 'shared/dist/map.js'),
    '#shared/colors.js': path.join(root, 'shared/dist/colors.js'),
};

export default defineConfig({
    test: {
        environment: 'node',
        include: ['client/src/**/*.test.js', 'server/**/*.test.ts'],
    },
    resolve: {
        alias: sharedAlias,
    },
});
