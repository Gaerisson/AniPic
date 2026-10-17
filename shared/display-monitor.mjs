export const displayHeartbeatMs = 20000;
export const displayOfflineMs = 75000;
export const displaySyncWarningMs = 150000;
export const displayIssueLabels = Object.freeze({
  programme_fetch: "Le programme n’a pas pu être actualisé.",
  image_load: "Une ou plusieurs images ne peuvent pas être chargées.",
  video_load: "Une vidéo est indisponible ou illisible.",
  video_autoplay: "Le navigateur bloque le démarrage d’une vidéo.",
  video_stalled: "La lecture d’une vidéo attend des données.",
  playback_stalled: "La lecture ne semble plus progresser.",
  render_error: "Le lecteur a rencontré une erreur d’affichage.",
});
export const displayStateLabels = Object.freeze({
  starting: "Démarrage",
  loading: "Préparation des médias",
  playing: "Lecture",
  paused: "En pause",
  standby: "Hors plage de diffusion",
  disabled: "Programme désactivé",
  error: "Lecture à vérifier",
});
export function displayScreenHealth(
  status,
  lastSeen,
  expectedRevision,
  at = Date.now(),
) {
  const online = Math.max(0, at - Date.parse(lastSeen)) <= displayOfflineMs;
  const issues = new Set(status.issues || []);
  if (
    status.state === "playing" &&
    status.visible &&
    status.progressAgeMs > 15000
  )
    issues.add("playback_stalled");
  const fresh =
    status.syncAgeMs !== null && status.syncAgeMs <= displaySyncWarningMs;
  const current = status.revision === expectedRevision && fresh;
  const warning =
    issues.size > 0 || status.state === "error" || !status.visible || !current;
  return {
    online,
    health: !online ? "offline" : warning ? "warning" : "ok",
    current,
    stateLabel: displayStateLabels[status.state] || "Démarrage",
    issues: [...issues],
    waitingUpdate: !current,
  };
}
