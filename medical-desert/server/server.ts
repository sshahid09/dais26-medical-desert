import { createApp, genie, lakebase, server } from '@databricks/appkit';
import { setupPlannerRoutes } from './routes/planner-routes';

createApp({
  plugins: [
    lakebase(),
    server(),
    // "India Healthcare Desert Planner" Genie space — natural-language Q&A over the
    // facilities / pincode / NFHS-5 source tables. Runs on-behalf-of the signed-in user.
    genie({ spaces: { planner: '01f168d9b9e11c30850ecaae448de958' } }),
  ],
  async onPluginsReady(appkit) {
    // Read-only API over Lakebase synced tables (no schema init — synced tables already exist).
    setupPlannerRoutes(appkit);
  },
}).catch(console.error);
