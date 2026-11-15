export function syncJobState(jobs, trackedId) {
  const running = jobs.find((j) => j.kind === "sync" && j.state === "running");
  if (running) return { state: "running", job: running };
  if (!trackedId) return { state: "idle" };
  const job = jobs.find((j) => j.id === trackedId);
  return job ? { state: "finished", job } : { state: "missing" };
}
