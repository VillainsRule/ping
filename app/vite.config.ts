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
        target: 'esnext',
        rollupOptions: {
            output: {
                chunkFileNames: 'a/[hash].js',
                entryFileNames: 'a/[hash].js',
                assetFileNames: 'a/[hash].[extname]'
            }
        },
        watch: {
            exclude: ['**/dist/**']
        }
    }
})
