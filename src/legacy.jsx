import { useState, useEffect } from "react";
import { Archive, Upload, FileJson, LoaderCircle, Check } from "lucide-react";
import { api } from "./api.js";
import { Button } from "./ui.jsx";
export function LegacyImport({ notify, reload }) {
  const [zip, setZip] = useState(null),
    [mapping, setMapping] = useState(null),
    [busy, setBusy] = useState(false),
    [job, setJob] = useState(null),
    [result, setResult] = useState(null);
  useEffect(() => {
    if (!job) return;
    const timer = setInterval(
      () =>
        api("/admin/jobs")
          .then((jobs) => {
            const current = jobs.find((j) => j.id === job);
            if (current?.state === "done") {
              setJob(null);
              try {
                setResult(JSON.parse(current.detail));
              } catch {}
              notify("Ancienne photothèque importée dans les archives.");
              reload();
            } else if (current && current.state !== "running") {
              setJob(null);
              notify(current.detail, "error");
            }
          })
          .catch(() => {}),
      2000,
    );
    return () => clearInterval(timer);
  }, [job]);
  return (
    <details className="panel legacy-import">
      <summary>
        <Archive size={20} /> Reprendre les anciennes photos de GPIC SPA
      </summary>
      <p>
        Déposez le ZIP des anciens dossiers photo. Les thumbnails et fichiers
        techniques sont ignorés. Les nouveaux albums restent archivés et les
        photos privées jusqu’à leur vérification. Les dates de fichier sont
        conservées.
      </p>
      <div className="form-row">
        <label>
          Archive ZIP · 1 Go maximum
          <input
            type="file"
            accept=".zip,application/zip"
            onChange={(e) => setZip(e.target.files[0])}
          />
        </label>
        <label>
          Correspondances dossier → ID SPA · facultatif
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => setMapping(e.target.files[0])}
          />
        </label>
      </div>
      <p className="fineprint">
        Un dossier non identifié reçoit son propre ID. Aucun regroupement par
        prénom. Les imports dans une fiche active existante sont rangés parmi
        ses photos archivées.
      </p>
      <Button
        icon={busy || job ? LoaderCircle : Upload}
        disabled={!zip || busy || !!job}
        onClick={async () => {
          if (zip.size > 1024 ** 3) {
            notify(
              "Archive limitée à 1 Go. Pour davantage, utilisez l’importeur sur le serveur.",
              "error",
            );
            return;
          }
          setBusy(true);
          setResult(null);
          try {
            const map = mapping ? JSON.parse(await mapping.text()) : {};
            const form = new FormData();
            form.append("mapping", JSON.stringify(map));
            form.append("archive", zip);
            const result = await api("/admin/import-legacy", {
              method: "POST",
              body: form,
            });
            setJob(result.id);
            notify("Archive transférée. L’import est lancé en arrière-plan.");
          } catch (error) {
            notify(error.message, "error");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Transfert de l’archive…"
          : job
            ? "Import en cours…"
            : "Importer dans les archives"}
      </Button>
      {result && (
        <div className="notice compact">
          <Check size={18} />
          {result.photos} photo(s) traitée(s) · {result.animals} album(s) ·{" "}
          {result.skipped} fichiers ignorés
        </div>
      )}
    </details>
  );
}
