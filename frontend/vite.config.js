import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        // 127.0.0.1, not localhost: Node 18+ resolves "localhost" to ::1 (IPv6)
        // first, but the backend's Docker port map binds IPv4 only — proxying to
        // ::1:8000 yields ECONNREFUSED (afterConnectMultiple). Pin to IPv4.
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
});
