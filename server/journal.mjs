import { id, now } from "./db.mjs";
const names = {
  photo_reviewed: "Analyse du tri photo",
  animal_cutout: "Détourage d’un animal",
  cutout_saved: "Copie détourée enregistrée",
  box_poster_recorded: "Affiche ajoutée au suivi des box",
  box_poster_updated: "Suivi d’une affiche mis à jour",
  gazette_exported: "Gazette du refuge exportée",
  agenda_created: "Événement ajouté à l’agenda partagé",
  agenda_updated: "Événement de l’agenda modifié",
  agenda_removed: "Événement retiré de l’agenda",
  display_screen_named: "Écran TV renommé",
  display_screen_removed: "Écran TV retiré du suivi",
  register_created: "Entrée du registre ajoutée",
  register_updated: "Entrée du registre modifiée",
  register_removed: "Entrée du registre retirée",
  register_imported: "Import du registre interne",
  task_removed: "Demande photo retirée",
  task_restored: "Demande photo restaurée",
  group_poster_exported: "Grande affiche exportée",
  sync: "Synchronisation SPA",
  source_adoption_automatic:
    "Adoption comptée automatiquement après absences confirmées",
  source_adoption_reversed:
    "Retour de l’animal · adoption automatique corrigée",
  source_adoption_confirmed: "Adoption confirmée par un statut source",
  json_imported: "Import des fiches SPA",
  backup: "Sauvegarde",
  archive_compress: "Compression des archives",
  photo_updated: "Photo modifiée",
  inbox_assigned: "Photos attribuées à un animal",
  photos_reassigned: "Photos réattribuées à un autre animal",
  photo_assignment_undone: "Attribution de photos annulée",
  archive_trashed: "Archive placée dans la corbeille",
  archive_trash_restored: "Archive restaurée depuis la corbeille",
  trash_emptied: "Corbeille vidée après sauvegarde",
  trash_empty: "Vidage de la corbeille",
  settings_updated: "Configuration enregistrée",
  login: "Connexion",
  login_failed: "Connexion refusée",
  user_avatar_updated: "Avatar modifié",
  user_avatar_reset: "Avatar retiré",
  album_created: "Album créé",
  album_updated: "Album modifié",
};
const label = (value) => names[value] || value.replaceAll("_", " ");
export function recordError(db, req, error, status) {
  // Never persist query strings, bodies, cookies, OAuth codes, keys or stack traces.
  const code = /^[A-Z0-9_]{1,60}$/.test(error.code || "")
    ? error.code
    : status >= 500
      ? "SERVER_ERROR"
      : "REQUEST_REJECTED";
  db.prepare("INSERT INTO diagnostic_log VALUES (?,?,?,?,?,?,?,?)").run(
    id(),
    now(),
    status >= 500 ? "error" : "warning",
    status,
    req.user?.id || null,
    req.method,
    req.url.split("?")[0].slice(0, 180),
    code,
  );
  db.exec(
    "DELETE FROM diagnostic_log WHERE id IN (SELECT id FROM diagnostic_log ORDER BY created_at DESC LIMIT -1 OFFSET 2000)",
  );
}
export async function registerJournal(app, { db, authorized }) {
  app.get(
    "/api/admin/journal",
    { preHandler: authorized(["admin"]) },
    async (req) => {
      const errors = req.query.kind === "errors",
        limit = 200;
      const failures = db
        .prepare(
          "SELECT d.*,u.name AS user_name FROM diagnostic_log d LEFT JOIN users u ON u.id=d.user_id ORDER BY d.created_at DESC LIMIT ?",
        )
        .all(limit)
        .map((r) => ({
          ...r,
          kind: r.level,
          title: `HTTP ${r.status} · ${r.code}`,
          detail: r.method + " " + r.path,
        }));
      if (errors) return failures;
      const actions = db
        .prepare(
          "SELECT a.*,u.name AS user_name FROM audit a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT ?",
        )
        .all(limit)
        .map((r) => ({
          ...r,
          kind: "action",
          title: label(r.action),
          detail: r.detail,
        }));
      const jobs = db
        .prepare("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?")
        .all(100)
        .map((r) => ({
          ...r,
          kind: r.state === "failed" ? "error" : "job",
          title:
            label(r.kind) +
            " · " +
            ({
              done: "Terminée",
              failed: "Échec",
              running: "En cours",
              interrupted: "Interrompue",
            }[r.state] || r.state),
          detail: r.detail,
        }));
      return [...failures, ...actions, ...jobs]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, limit);
    },
  );
}
