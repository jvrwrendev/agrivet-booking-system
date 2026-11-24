import type { AppModule } from "../../app.module.js";
import { agentLocationsRouter } from "./agent-locations.routes.js";

export const agentLocationsModule: AppModule = {
  name: "agent-locations",
  basePath: "/api/v1/agents",
  router: agentLocationsRouter,
};
