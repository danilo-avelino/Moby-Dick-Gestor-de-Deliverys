import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/server-firebase.ts'],
    format: ['cjs'],
    noExternal: ['database', 'types'],
    splitting: false,
});
