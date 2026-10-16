import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { createLaserTagApiMiddleware } from './src/server/laserTagApiMiddleware.js'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [
      react(),
      {
        name: 'laser-tag-api',
        configureServer(server) {
          server.middlewares.use(createLaserTagApiMiddleware(env));
        }
      }
    ],
    server: {
      host: true,
      allowedHosts: true,
    },
  };
});
