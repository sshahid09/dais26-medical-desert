import { createApp, lakebase, server } from '@databricks/appkit';
import { setupPlannerRoutes } from './routes/planner-routes';

createApp({
  plugins: [
    lakebase(),
    server(),
  ],
  async onPluginsReady(appkit) {
    // Read-only API over Lakebase synced tables (no schema init — synced tables already exist).
    setupPlannerRoutes(appkit);
  },
}).catch(console.error);
