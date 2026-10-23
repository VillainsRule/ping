import path from 'node:path'

import { defineConfig } from 'vite'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react(), tailwindcss()],

    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src')
        }
    },

    build: {
        target: 'es2023',
        emptyOutDir: false,
        rolldownOptions: {
            input: `${path.join(import.meta.dirname, `index-${process.env.TAG}.html`)}`,
            output: {
                chunkFileNames: 'a/[hash].js',
                entryFileNames: 'a/[hash].js',
                assetFileNames: 'a/[hash][extname]'
            }
        },
        watch: process.argv.includes('--watch') ? { exclude: ['**/dist/**'] } : null
    }
})
