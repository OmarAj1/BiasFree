import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';
import fs from 'fs';

function serveDataDir(): Plugin {
  return {
    name: 'serve-data-dir',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        const filePath = path.join(__dirname, 'data', req.url!);
        if (fs.existsSync(filePath)) {
          if (filePath.endsWith('.json')) {
            res.setHeader('Content-Type', 'application/json');
          } else if (filePath.endsWith('.csv')) {
            res.setHeader('Content-Type', 'text/csv');
          }
          res.end(fs.readFileSync(filePath));
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), serveDataDir()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
