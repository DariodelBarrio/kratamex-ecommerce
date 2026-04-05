import 'dotenv/config';
import { serve } from '@hono/node-server';

import { app, bootstrapApp, PORT } from './app';

export { app };

if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      await bootstrapApp();
      serve({ fetch: app.fetch, port: PORT }, () => {
        console.log(`Backend Hono v3 corriendo en http://localhost:${PORT}`);
      });
    } catch (err) {
      console.error('Error al iniciar el backend:', err);
      process.exit(1);
    }
  })();
}
