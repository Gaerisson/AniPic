import { ServerClock } from "./journal-view.jsx";
import { ConnectionPreferences } from "./app-feedback.jsx";
import { GoogleAuthSettings, VolunteerRequests } from "./google-auth.jsx";
import { UserPicture } from "./user-avatar.jsx";
import { ArchiveCompression } from "./archive-storage.jsx";
import { OperationSummary } from "./operation-summary.jsx";
import { useState, useEffect, useCallback, useRef } from "react";
import {
  PawPrint,
  Images,
  Camera,
  RefreshCw,
  HardDrive,
  ShieldCheck,
  Plus,
  ArrowUpRight,
  Upload,
  Check,
  CheckCircle2,
  Download,
  Eye,
  Clock,
  Info,
  FileJson,
  ExternalLink,
  Undo2,
  AlertCircle,
  LoaderCircle,
  Leaf,
} from "lucide-react";
import { api, bytes, date, speciesName } from "./api.js";
import { Spinner, Empty, Button } from "./ui.jsx";
import { ApiSettings, InterfaceSettings } from "./preferences.jsx";
import { LegacyImport } from "./legacy.jsx";
import { AdminMessages } from "./messages.jsx";
import { AccessPanel } from "./access.jsx";
import { ImportAutomation } from "./import-automation.jsx";
import { SimilarPhotos } from "./similar-photos.jsx";
import { StorageChecks, Journal } from "./system-panels.jsx";

const adminTitles = {
  messages: ["Messages de l’équipe", ""],
  migration: ["Import GPIC", ""],
  api: ["API & connexions", ""],
  dashboard: ["Vue d’ensemble", ""],
  sync: ["Synchronisation", ""],
  storage: ["Stockage", ""],
  backups: ["Sauvegardes", ""],
  settings: ["Configuration", ""],
  users: ["Équipe & accès", ""],
  journal: ["Journal", ""],
};
export function Admin({
  page,
  overview,
  version,
  reload,
  notify,
  open,
  user,
  updateAssistantAvatar,
}) {
  const [data, setData] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    const resources = {
      messages: ["users", "messages"],
      migration: ["settings"],
      dashboard: ["storage", "settings", "audit", "jobs", "activity"],
      sync: ["settings", "jobs"],
      storage: ["storage", "settings"],
      backups: ["backups", "storage", "settings", "jobs"],
      users: ["users", "audit"],
      settings: ["settings"],
      api: ["settings"],
    }[page] || ["settings"];
    return Promise.all(
      resources.map(async (key) => [key, await api("/admin/" + key)]),
    )
      .then((rows) => {
        setData({ page, ...Object.fromEntries(rows) });
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [page]);
  useEffect(() => {
    load();
  }, [version, page]);
  const running = data?.jobs?.some((j) => j.state === "running");
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [running, load]);
  const previousJobs = useRef(new Map());
  useEffect(() => {
    for (const job of data?.jobs || []) {
      if (
        previousJobs.current.get(job.id) === "running" &&
        job.state !== "running"
      ) {
        notify(
          job.state === "done"
            ? job.kind === "backup"
              ? "Sauvegarde terminée et vérifiée."
              : job.kind === "archive_compress"
                ? "Compression des archives terminée."
                : "Synchronisation terminée."
            : job.detail,
          job.state === "done" ? "success" : "error",
        );
        reload();
      }
      previousJobs.current.set(job.id, job.state);
    }
  }, [data?.jobs]);
  const run = async (kind) => {
    setBusy(true);
    try {
      await api("/admin/" + (kind === "backup" ? "backups" : "sync"), {
        method: "POST",
      });
      notify(
        kind === "backup"
          ? "La sauvegarde a démarré."
          : "La synchronisation a démarré.",
      );
      await load();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const title = adminTitles[page];
  const jobRunning = (kind) =>
    data?.jobs?.some((j) => j.kind === kind && j.state === "running");
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span /> L’ATELIER · ADMINISTRATION
          </div>
          <h1>{title[0]}</h1>
          <p>{title[1]}</p>
        </div>
        {page === "backups" ? (
          <Button
            icon={jobRunning("backup") ? LoaderCircle : ShieldCheck}
            disabled={busy || jobRunning("backup")}
            onClick={() => run("backup")}
          >
            {jobRunning("backup")
              ? "Sauvegarde en cours…"
              : "Créer une sauvegarde"}
          </Button>
        ) : page === "sync" ? (
          <Button
            icon={jobRunning("sync") ? LoaderCircle : RefreshCw}
            disabled={busy || jobRunning("sync")}
            onClick={() => run("sync")}
          >
            Synchroniser maintenant
          </Button>
        ) : page === "dashboard" ? (
          <Button icon={Upload} onClick={() => open({ type: "upload" })}>
            Importer des photos
          </Button>
        ) : null}
      </div>
      {error ? (
        <Empty
          icon={AlertCircle}
          title="L’atelier ne répond pas."
          text={error}
          action={<Button onClick={load}>Réessayer</Button>}
        />
      ) : !data || data.page !== page ? (
        <Spinner />
      ) : page === "dashboard" ? (
        <Dashboard data={data} overview={overview} open={open} />
      ) : page === "journal" ? (
        <Journal />
      ) : page === "storage" ? (
        <>
          <Storage data={data} notify={notify} reload={reload} />
          <SimilarPhotos notify={notify} open={open} />
        </>
      ) : page === "backups" ? (
        <Backups data={data} run={run} />
      ) : page === "sync" ? (
        <Sync data={data} notify={notify} reload={reload} />
      ) : page === "api" ? (
        <>
          <ApiSettings
            current={data.settings}
            notify={notify}
            reload={reload}
          />
          <ImportAutomation notify={notify} />
        </>
      ) : page === "settings" ? (
        <>
          <ConnectionPreferences />
          <ServerClock />
          <InterfaceSettings
            current={data.settings}
            avatarUrl={overview?.assistantAvatarUrl}
            updateAssistantAvatar={updateAssistantAvatar}
            notify={notify}
            reload={reload}
          />
          <details className="feature-details">
            <summary>Fonctions avancées et anciennes migrations</summary>
            <div className="feature-body">
              <p>
                L’import GPIC est conservé pour les anciennes installations. Il
                n’est pas nécessaire pour l’utilisation quotidienne.
              </p>
              <a className="button secondary" href="#migration">
                Ouvrir l’import GPIC
              </a>
            </div>
          </details>
        </>
      ) : page === "messages" ? (
        <AdminMessages data={data} notify={notify} reload={reload} />
      ) : page === "migration" ? (
        <LegacyImport notify={notify} reload={reload} />
      ) : page === "users" ? (
        <Team data={data} notify={notify} reload={reload} user={user} />
      ) : null}
    </>
  );
}
function Stat({ icon: Icon, label, value, detail, color = "" }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-label">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
function Dashboard({ data, overview, open }) {
  const [missing, setMissing] = useState([]);
  useEffect(() => {
    api("/animals?missing=1&limit=4").then((r) => setMissing(r.items));
  }, [overview.stats.needPhotos]);
  const max = Math.max(1, ...data.activity.map((d) => d.count));
  return (
    <>
      <div className="stat-grid">
        <Stat
          icon={PawPrint}
          label="Au refuge"
          value={overview.stats.total - overview.stats.archived}
          detail="Chaque compagnon a sa propre identité"
        />
        <Stat
          icon={Images}
          label="Photographies"
          value={overview.stats.photos}
          detail="Des images à retrouver et à partager"
        />
        <Stat
          icon={Camera}
          label="À photographier"
          value={overview.stats.needPhotos}
          detail="Leur premier portrait reste à prendre"
          color="peach"
        />
        <Stat
          icon={HardDrive}
          label="Espace occupé"
          value={bytes(data.storage.total)}
          detail={`${bytes(data.storage.savedByDedup)} économisés par déduplication`}
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">LES NOUVEAUX REGARDS</span>
              <h2>La photothèque grandit.</h2>
              <small>
                {overview.stats.localPhotos ?? overview.stats.photos} photos
                locales · {overview.stats.spaPhotoReferences ?? 0} fiches avec
                photo SPA de référence
              </small>
            </div>
            <span className="tag sage">Activité réelle</span>
          </div>
          <div className="activity-chart">
            {data.activity.length ? (
              data.activity
                .slice()
                .reverse()
                .map((d) => (
                  <div key={d.day}>
                    <span className="chart-value">{d.count}</span>
                    <i
                      style={{
                        height: Math.max(8, (d.count / max) * 140) + "px",
                      }}
                    />
                    <span>
                      {new Date(d.day).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                ))
            ) : (
              <span className="muted">
                Les premiers imports apparaîtront ici.
              </span>
            )}
          </div>
          <div className="panel-foot">
            <Camera size={16} />
            Photos locales importées par jour · images SPA exclues
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">UNE NOUVELLE CHANCE</span>
              <h2>Sans photo locale</h2>
            </div>
            <Camera size={21} />
          </div>
          <div className="compact-animals">
            {missing.length ? (
              missing.map((a) => (
                <button
                  key={a.id}
                  onClick={() => open({ type: "animal", id: a.id })}
                >
                  <span className="mini-placeholder">
                    <PawPrint size={20} />
                  </span>
                  <span>
                    <strong>{a.name}</strong>
                    <small>
                      {speciesName[a.species]} · {a.id.slice(0, 8)}
                    </small>
                  </span>
                  <ArrowUpRight size={18} />
                </button>
              ))
            ) : (
              <p className="muted">
                Tout le monde a son portrait. Merci à l’équipe !
              </p>
            )}
          </div>
        </section>
      </div>
      <section className="panel section-gap">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">LA VIE DE L’ATELIER</span>
            <h2>Activité récente</h2>
          </div>
          <ShieldCheck size={20} />
        </div>
        <AuditList rows={data.audit.slice(0, 7)} />
      </section>
    </>
  );
}
const actionNames = {
  team_poll_created: "Sondage créé",
  team_poll_closed: "Sondage clôturé",
  annual_statistics_updated: "Bilan annuel ajusté",
  display_screen_configured: "Réglages d’un écran enregistrés",
  writing_proposal_created: "Proposition de texte préparée",
  google_configured: "Connexion Google configurée",
  google_login: "Connexion avec Google",
  google_login_failed: "Connexion Google refusée",
  volunteer_requested: "Demande d’accès bénévole",
  volunteer_approved: "Compte bénévole validé",
  volunteer_rejected: "Demande bénévole refusée",
  login: "Connexion à l’atelier",
  login_failed: "Connexion refusée",
  animal_created: "Nouvelle fiche créée",
  animal_updated: "Fiche mise à jour",
  animal_archived: "Album archivé",
  source_adoption_automatic:
    "Adoption comptée automatiquement après absences confirmées",
  source_adoption_reversed: "Animal réapparu · adoption automatique corrigée",
  source_adoption_confirmed:
    "Adoption automatique confirmée par un statut source",
  source_adoption_pending: "Départ archivé · adoption en attente pendant 24 h",
  adoption_review_auto_confirmed: "Adoption confirmée automatiquement",
  adoption_review_rejected: "Adoption annulée ou refusée par l’équipe",
  adoption_review_confirmed: "Adoption validée par l’équipe",
  animal_restored: "Album restauré",
  photos_uploaded: "Photos importées",
  photo_updated: "Photo mise à jour",
  collection_created: "Collection créée",
  settings_updated: "Configuration enregistrée",
  cache_cleared: "Cache libéré",
  backup: "Sauvegarde vérifiée",
  backup_failed: "Échec de sauvegarde",
  sync: "Synchronisation terminée",
  sync_failed: "Synchronisation interrompue",
  json_imported: "Export JSON importé",
  legacy_imported: "Ancienne photothèque importée",
  user_created: "Nouveau compte créé",
  user_updated: "Accès d’un membre mis à jour",
  photos_batch: "Visibilité d’une sélection mise à jour",
  password_updated: "Mot de passe modifié",
  task_created: "Séance photo ajoutée",
  task_updated: "Séance photo mise à jour",
  source_test: "Connecteur SPA testé",
  assistant_avatar_reset: "Avatar de l’assistant réinitialisé",
  assistant_avatar_updated: "Avatar de l’assistant remplacé",
  inbox_uploaded: "Photos ajoutées au tri",
  inbox_assigned: "Photos attribuées à un animal",
  post_draft: "Publication préparée",
  canva_pptx_downloaded: "Pré-design Canva téléchargé",
  video_render: "Rendu vidéo lancé",
  video_project_saved: "Projet vidéo enregistré",
  video_projects_trashed: "Projet vidéo mis à la corbeille",
  video_renders_trashed: "Export vidéo mis à la corbeille",
  album_created: "Album privé créé",
  album_uploaded: "Photos ajoutées à un album",
  team_message_sent: "Message envoyé à l’équipe",
  team_message_withdrawn: "Message retiré de l’accueil",
  music_imported: "Musique importée",
};
function AuditList({ rows }) {
  return rows.length ? (
    <div className="audit-list">
      {rows.map((a) => (
        <div key={a.id}>
          <span
            className={`audit-icon ${a.action.includes("failed") ? "warning" : ""}`}
          >
            {a.action.includes("failed") ? (
              <AlertCircle size={17} />
            ) : (
              <Check size={17} />
            )}
          </span>
          <span>
            <strong>{actionNames[a.action] || a.action}</strong>
            <small>{a.user_name || "Anipic · automatisation"}</small>
          </span>
          <time>
            {new Date(a.created_at).toLocaleString("fr-FR", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>
      ))}
    </div>
  ) : (
    <div className="panel-foot">Le journal se remplira au fil des actions.</div>
  );
}
function Storage({ data, notify, reload }) {
  const [clearing, setClearing] = useState(false);
  const s = data.storage;
  const parts = [
    ["Originaux", s.originals, "var(--accent)"],
    ["Aperçus", s.cache, "color-mix(in srgb, var(--accent) 60%, white)"],
    [
      "Sauvegardes",
      s.backups,
      "color-mix(in srgb, var(--accent) 25%, var(--ink))",
    ],
    ["Base de données", s.database, "var(--muted)"],
  ];
  let offset = 0;
  const gradient = parts
    .map(([, value, color]) => {
      const start = offset;
      offset += (value / (s.total || 1)) * 100;
      return `${color} ${start}% ${offset}%`;
    })
    .join(",");
  return (
    <>
      <StorageChecks notify={notify} />
      <ArchiveCompression notify={notify} reload={reload} />
      <div className="storage-layout">
        <section className="panel storage-main">
          <div className="panel-heading">
            <div>
              <h2>Répartition du stockage</h2>
            </div>
            <span className="tag sage">
              <CheckCircle2 size={12} />
              {s.uniqueBlobs} originaux
            </span>
          </div>
          <div className="storage-breakdown">
            <div
              className="storage-donut"
              style={{
                background: `conic-gradient(${gradient || "#eee 0% 100%"})`,
              }}
            >
              <div>
                <strong>{bytes(s.total)}</strong>
                <span>sur le disque</span>
              </div>
            </div>
            <div className="storage-legend">
              {parts.map(([label, value, color]) => (
                <div key={label}>
                  <span>
                    <i style={{ background: color }} />
                    {label}
                  </span>
                  <strong>{bytes(value)}</strong>
                </div>
              ))}
              <div className="legend-total">
                <span>Total mesuré</span>
                <strong>{bytes(s.total)}</strong>
              </div>
            </div>
          </div>
          {s.diskTotalBytes > 0 && (
            <section className="disk-meter">
              <header>
                <strong>Volume de stockage des originaux</strong>
                <span>{bytes(s.freeBytes)} libres</span>
              </header>
              <progress
                style={{
                  "--meter-fill":
                    s.diskUsedBytes / s.diskTotalBytes >= 0.9
                      ? "#d99577"
                      : "var(--accent)",
                }}
                aria-label="Occupation du disque des originaux"
                max={s.diskTotalBytes}
                value={s.diskUsedBytes}
              />
              <p>
                {bytes(s.diskUsedBytes)} utilisés / {bytes(s.diskTotalBytes)} ·
                Anipic : {bytes(s.originals)}. Ce volume peut contenir d’autres
                fichiers ; sauvegardes et cache peuvent être sur d’autres
                disques.
              </p>
            </section>
          )}
          <div className="storage-details">
            <div>
              <span>Originaux uniques</span>
              <strong>{s.uniqueBlobs}</strong>
            </div>
            <div>
              <span>Références photo</span>
              <strong>{s.photos}</strong>
            </div>
            <div>
              <span>Espace économisé</span>
              <strong>{bytes(s.savedByDedup)}</strong>
            </div>
          </div>
        </section>
        <div className="storage-side">
          <div className="panel storage-info">
            <h3>Espace libre</h3>
            <span className="tag sage">
              {s.freeBytes == null
                ? "Mesure indisponible"
                : bytes(s.freeBytes) + " disponibles sur le volume"}
            </span>
          </div>
          <div className="panel cache-info">
            <div>
              <span className="eyebrow">CACHE D’APERÇUS</span>
              <strong>
                {bytes(s.cache)} <small>/ {bytes(s.cacheBudget)}</small>
              </strong>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Budget du cache utilisé"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(
                100,
                Math.round((s.cache / s.cacheBudget) * 100),
              )}
            >
              <i
                style={{
                  width: Math.min(100, (s.cache / s.cacheBudget) * 100) + "%",
                }}
              />
            </div>
            <p>
              WebP à la demande. Les plus anciens aperçus sont évincés lorsque
              le budget est atteint.
            </p>
            <Button
              variant="secondary"
              disabled={clearing}
              icon={RefreshCw}
              onClick={async () => {
                setClearing(true);
                try {
                  const result = await api("/admin/cache/clear", {
                    method: "POST",
                  });
                  notify(bytes(result.removed) + " de cache libérés.");
                  reload();
                } catch (e) {
                  notify(e.message, "error");
                } finally {
                  setClearing(false);
                }
              }}
            >
              Libérer le cache
            </Button>
          </div>
        </div>
      </div>
      {s.orphanBytes > 0 && (
        <div className="notice section-gap">
          <Info size={18} />
          <span>
            {bytes(s.orphanBytes)} de fichiers sans référence mesurés. Ils sont
            conservés ; aucune suppression automatique des originaux.
          </span>
        </div>
      )}
    </>
  );
}
function Backups({ data, run }) {
  const cfg = data.settings;
  return (
    <>
      <div className="stat-grid three">
        <Stat
          icon={ShieldCheck}
          label="Dernière sauvegarde"
          value={data.backups[0] ? date(data.backups[0].created_at) : "À créer"}
          detail={
            data.backups[0] ? bytes(data.backups[0].size) : "Aucune sauvegarde"
          }
        />
        <Stat
          icon={Clock}
          label="Rétention"
          value={cfg.backupKeep + " copies"}
          detail="Rotation après une sauvegarde réussie"
        />
        <Stat
          icon={HardDrive}
          label="Volume des sauvegardes"
          value={bytes(data.storage.backups)}
          detail="Stockage séparé des aperçus"
        />
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">POINTS DE RESTAURATION</span>
            <h2>Sauvegardes enregistrées</h2>
          </div>
          <span className="muted">{data.backups.length} sauvegarde(s)</span>
        </div>
        {data.backups.length ? (
          <div className="backup-list">
            {data.backups.map((b) => (
              <div key={b.id}>
                <span className="backup-file">
                  <ShieldCheck size={24} />
                </span>
                <span className="backup-description">
                  <strong>
                    {date(b.created_at)} ·{" "}
                    {new Date(b.created_at).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </strong>
                  <small>{b.filename}</small>
                  {!!b.protected && (
                    <small className="tag">
                      Protégée · originaux avant compression
                    </small>
                  )}
                  <code title={b.checksum}>
                    SHA-256 · {b.checksum.slice(0, 24)}…
                  </code>
                </span>
                <span>{bytes(b.size)}</span>
                <a
                  className="button secondary"
                  href={"/api/admin/backups/" + b.id + "/download"}
                >
                  <Download size={16} />
                  <span>Télécharger</span>
                </a>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            icon={ShieldCheck}
            title="Aucune sauvegarde"
            text="Créez une sauvegarde pour conserver la base et tous les originaux."
            action={
              <Button onClick={() => run("backup")}>
                Créer une sauvegarde
              </Button>
            }
          />
        )}
      </section>
      <div className="two-column section-gap">
        <section className="panel text-panel">
          <Undo2 size={25} />
          <h3>Restaurer une sauvegarde</h3>
          <p>
            La restauration est volontairement faite hors de l’interface, vers
            un nouveau dossier. Chaque fichier est vérifié avant que la
            sauvegarde soit acceptée.
          </p>
          <code>npm run restore -- sauvegarde.tar.gz /nouveau-dossier</code>
        </section>
        <section className="panel text-panel">
          <HardDrive size={25} />
          <h3>Une deuxième copie, ailleurs.</h3>
          <p>
            Une sauvegarde sur le même NAS protège contre une erreur de
            manipulation. Conservez aussi une copie sur un autre disque ou un
            autre site.
          </p>
          <small>
            Le fichier contient les données et les empreintes de mot de passe.
            Gardez-le dans un espace privé.
          </small>
        </section>
      </div>
      <JobHistory jobs={data.jobs.filter((j) => j.kind === "backup")} />
    </>
  );
}
function JobHistory({ jobs }) {
  return (
    <section className="panel section-gap">
      <div className="panel-heading">
        <h2>Le journal des opérations</h2>
        <Clock size={19} />
      </div>
      {jobs.length ? (
        <div className="job-list">
          {jobs.slice(0, 8).map((j) => (
            <div key={j.id}>
              <span className={"job-state " + j.state}>
                {j.state === "running" ? (
                  <LoaderCircle size={17} className="spin" />
                ) : j.state === "done" ? (
                  <CheckCircle2 size={17} />
                ) : (
                  <AlertCircle size={17} />
                )}
              </span>
              <div>
                <strong>
                  {j.state === "running"
                    ? "En cours"
                    : j.state === "done"
                      ? "Terminée"
                      : j.state === "interrupted"
                        ? "Interrompue"
                        : "Échec"}
                </strong>
                <small>
                  {j.state === "done"
                    ? "Données traitées et opération enregistrée."
                    : j.detail || "Traitement en cours…"}
                </small>
              </div>
              <OperationSummary detail={j.detail} />
              <time dateTime={j.created_at}>
                {new Date(j.created_at).toLocaleString("fr-FR")}
              </time>
            </div>
          ))}
        </div>
      ) : (
        <div className="panel-foot">Aucune opération pour le moment.</div>
      )}
    </section>
  );
}
function Sync({ data, notify, reload }) {
  const [input, setInput] = useState(null),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false);
  const fileRef = useRef();
  const choose = async (file) => {
    if (!file) return;
    if (file.size > 8 * 1024 ** 2) {
      notify("8 Mo maximum pour un export JSON.", "error");
      return;
    }
    setBusy(true);
    setPreview(null);
    try {
      const parsed = JSON.parse(await file.text());
      const result = await api("/admin/import-preview", {
        method: "POST",
        body: parsed,
      });
      setInput(parsed);
      setPreview({ ...result, filename: file.name });
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="two-column">
        <section className="panel source-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">LA SOURCE DU REFUGE</span>
              <h2>Connecteur SPA</h2>
            </div>
            <RefreshCw size={22} />
          </div>
          <div className="source-identity">
            <span className="source-logo">
              <PawPrint size={28} />
            </span>
            <div>
              <strong>SPA · Refuge de Morée</strong>
              <small>
                Identifiants source stables, indépendants des prénoms
              </small>
            </div>
          </div>
          <div className="source-facts">
            <div>
              <span>Source configurée</span>
              <strong>
                {data.settings.sourceMode === "disabled"
                  ? "Non activée"
                  : data.settings.sourceMode === "spa"
                    ? data.settings.sourceRobotsPolicy === "spa_public_api"
                      ? "API publique SPA"
                      : "API SPA · robots.txt"
                    : data.settings.sourceMode === "json"
                      ? "Flux JSON"
                      : "Inventaire HTML"}
              </strong>
            </div>
            <div>
              <span>Fréquence</span>
              <strong>
                {data.settings.syncScheduleMode === "cron"
                  ? data.settings.syncCron + " · " + data.settings.syncTimeZone
                  : data.settings.syncScheduleMode !== "manual" &&
                      data.settings.syncIntervalHours
                    ? "Toutes les " + data.settings.syncIntervalHours + " h"
                    : "Manuelle"}
              </strong>
            </div>
            <div>
              <span>Archivage des absences</span>
              <strong>
                {data.settings.archiveMissing
                  ? data.settings.missingThreshold +
                    " inventaires complets" +
                    (data.settings.sourceMissingOutcome === "adopted"
                      ? " · adoption automatique"
                      : " · sans adoption")
                  : "Désactivé"}
              </strong>
            </div>
          </div>
          <a className="button secondary sync-settings-link" href="#api">
            Réglages et planification <ArrowUpRight size={15} />
          </a>
          <a
            className="text-link"
            href="https://www.la-spa.fr/etablissement/refuge-spa-de-moree-jean-leriche/"
            target="_blank"
            rel="noreferrer"
          >
            Voir le refuge <ExternalLink size={14} />
          </a>
        </section>
        <section className="panel json-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">REPRENDRE VOS DONNÉES</span>
              <h2>Importer un export JSON.</h2>
            </div>
            <FileJson size={22} />
          </div>
          <p>
            Compatible avec GPIC SPA V1/V2 et le nouveau contrat Anipic. Une
            prévisualisation montre ce qui sera créé ou mis à jour.
          </p>
          <div
            className="dropzone small"
            role="button"
            tabIndex={0}
            onClick={() => fileRef.current.click()}
            onKeyDown={(e) => e.key === "Enter" && fileRef.current.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              choose(e.dataTransfer.files[0]);
            }}
          >
            <FileJson size={27} />
            <strong>Choisir votre export</strong>
            <small>.json · 8 Mo maximum</small>
            <input
              hidden
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={(e) => choose(e.target.files[0])}
            />
          </div>
          {busy && (
            <p className="muted">Vérification du format et des identifiants…</p>
          )}
          {preview && (
            <div className="import-preview">
              <strong>{preview.filename}</strong>
              <div>
                <span>
                  <b>{preview.created}</b> nouvelles fiches
                </span>
                <span>
                  <b>{preview.updated}</b> mises à jour
                </span>
              </div>
              <span className="tag sage">
                {preview.complete
                  ? "Inventaire déclaré complet"
                  : "Inventaire partiel · aucun archivage"}
              </span>
              <ul>
                {preview.sample.map((a) => (
                  <li key={a.sourceId}>
                    {a.name}
                    <code>{a.sourceId}</code>
                  </li>
                ))}
              </ul>
              <Button
                icon={Check}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const result = await api("/admin/import-json", {
                      method: "POST",
                      body: input,
                    });
                    notify(
                      `${result.created} fiche(s) créée(s), ${result.updated} mise(s) à jour.`,
                    );
                    setPreview(null);
                    setInput(null);
                    reload();
                  } catch (e) {
                    notify(e.message, "error");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Importer les {preview.total} fiches
              </Button>
            </div>
          )}
        </section>
      </div>
      <JobHistory jobs={data.jobs.filter((j) => j.kind === "sync")} />
    </>
  );
}
function Team({ data, notify, reload, user }) {
  const [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false);
  const roles = {
    admin: [
      "Administration",
      "Configuration, comptes et toutes les opérations",
    ],
    editor: ["Photographe", "Photos, albums, studio vidéo et archivage"],
    agent: [
      "Agent SPA",
      "Planning, photos, albums et publications ; sans administration",
    ],
    viewer: [
      "Lecteur",
      "Consultation, favoris et téléchargement des originaux",
    ],
    volunteer: [
      "Bénévole",
      "Créations photo/vidéo, affiches, albums privés, archives, statistiques et C8 ; après validation",
    ],
  };
  return (
    <>
      <VolunteerRequests users={data.users} notify={notify} reload={reload} />
      <GoogleAuthSettings notify={notify} />
      <div className="panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">VOTRE ÉQUIPE</span>
            <h2>Les membres de l’équipe</h2>
          </div>
          <Button icon={Plus} onClick={() => setCreating(!creating)}>
            Ajouter un membre
          </Button>
        </div>
        <div className="team-list">
          {data.users
            .filter((u) => !u.google_status || u.google_status === "approved")
            .map((u) => (
              <div key={u.id}>
                <UserPicture user={u} />
                <span>
                  <strong>
                    {u.name}
                    {u.id === user.id && <span className="tag sage">Vous</span>}
                  </strong>
                  <small>Depuis le {date(u.created_at)}</small>
                  <small>
                    Dernière connexion :{" "}
                    {u.last_login_at
                      ? new Date(u.last_login_at).toLocaleString("fr-FR")
                      : "Pas encore de connexion enregistrée"}
                  </small>
                </span>
                <select
                  value={u.role}
                  disabled={u.id === user.id || !u.active}
                  aria-label={"Rôle de " + u.name}
                  onChange={async (e) => {
                    try {
                      await api("/admin/users/" + u.id, {
                        method: "PATCH",
                        body: { role: e.target.value },
                      });
                      notify(
                        "Rôle mis à jour. Les sessions du membre ont été fermées.",
                      );
                      reload();
                    } catch (e) {
                      notify(e.message, "error");
                    }
                  }}
                >
                  {Object.entries(roles).map(([role, [label]]) => (
                    <option key={role} value={role}>
                      {label}
                    </option>
                  ))}
                </select>
                <Button
                  variant="quiet"
                  disabled={u.id === user.id}
                  onClick={async () => {
                    try {
                      await api("/admin/users/" + u.id, {
                        method: "PATCH",
                        body: { active: !u.active },
                      });
                      notify(
                        u.active ? "Compte désactivé." : "Compte réactivé.",
                      );
                      reload();
                    } catch (e) {
                      notify(e.message, "error");
                    }
                  }}
                >
                  {u.active ? "Désactiver" : "Réactiver"}
                </Button>
              </div>
            ))}
        </div>
        {creating && (
          <form
            className="form-stack team-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              try {
                const input = Object.fromEntries(new FormData(e.currentTarget));
                await api("/admin/users", { method: "POST", body: input });
                notify("Membre ajouté à l’équipe.");
                setCreating(false);
                reload();
              } catch (e) {
                notify(e.message, "error");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="form-row">
              <label>
                Identifiant
                <input
                  name="name"
                  required
                  pattern="[a-zA-Z0-9_.-]{3,40}"
                  placeholder="prenom.nom"
                />
              </label>
              <label>
                Rôle
                <select name="role" defaultValue="agent">
                  <option value="agent">Agent SPA</option>
                  <option value="editor">Photographe</option>
                  <option value="viewer">Lecteur</option>
                  <option value="admin">Administrateur</option>
                </select>
              </label>
            </div>
            <label>
              Mot de passe initial
              <input
                type="password"
                name="password"
                minLength={12}
                maxLength={200}
                required
                autoComplete="new-password"
                placeholder="12 caractères minimum"
              />
            </label>
            <Button icon={Check} disabled={busy}>
              Créer le compte
            </Button>
          </form>
        )}
      </div>
      <div className="role-grid">
        {Object.entries(roles).map(([key, [label, description]]) => (
          <div key={key} className="panel text-panel">
            <span className="role-icon">
              {key === "admin" ? (
                <ShieldCheck size={24} />
              ) : key === "editor" ? (
                <Camera size={24} />
              ) : (
                <Eye size={24} />
              )}
            </span>
            <h3>{label}</h3>
            <p>{description}</p>
          </div>
        ))}
      </div>
      <section className="panel section-gap">
        <div className="panel-heading">
          <h2>Journal des accès et des actions</h2>
          <ShieldCheck size={20} />
        </div>
        <AuditList rows={data.audit} />
      </section>
      <AccessPanel
        users={data.users}
        notify={notify}
        version={data.audit[0]?.id}
      />
    </>
  );
}
