import { creativeJobs } from "./creative-jobs.mjs";
import { registerPhotoWorkshop } from "./photo-workshop.mjs";
import { registerBoxTracking } from "./box-tracking.mjs";
import { registerGazette } from "./gazette.mjs";
import { registerAgenda } from "./agenda.mjs";
export async function registerCreativeWorkshop(app, options) {
  const jobs = creativeJobs(app, options.authorized),
    dependencies = { ...options, jobs };
  await registerPhotoWorkshop(app, dependencies);
  await registerBoxTracking(app, dependencies);
  await registerGazette(app, dependencies);
  await registerAgenda(app, dependencies);
}
