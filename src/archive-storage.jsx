import { useState, useEffect } from "react";
import { Archive, RefreshCw, Minimize2 } from "lucide-react";
import { api, bytes } from "./api.js";
import { Button } from "./ui.jsx";
export function ArchiveCompression({ notify, reload }) {
  const [quality, setQuality] = useState(82),
    [maxDimension, setDimension] = useState(2560),
    [estimate, setEstimate] = useState(null),
    [busy, setBusy] = useState(false),
    [accepted, setAccepted] = useState(false),
    [job, setJob] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    setEstimate(null);
    setAccepted(false);
  }, [quality, maxDimension]);
  useEffect(() => {
    if (!job) return;
    let live = true;
    const timer = setInterval(async () => {
      try {
        const rows = await api("/admin/jobs"),
          r = rows.find((r) => r.id === job);
        if (!live || !r || r.state === "running") return;
        setJob(null);
        setBusy(false);
        if (r.state === "done") {
          const result = JSON.parse(r.detail);
          notify(
            `${result.processed} photos optimisées · ${bytes(result.savedBytes)} libérés dans les photos.`,
          );
          setEstimate(null);
          reload();
        } else setError(r.detail);
      } catch (e) {
        if (live) setError(e.message);
      }
    }, 2000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [job]);
  async function run(apply) {
    setBusy(true);
    setError("");
    try {
      const r = await api(
        "/admin/archives/" + (apply ? "compress" : "estimate"),
        {
          method: "POST",
          body: {
            quality,
            maxDimension,
            ...(apply ? { confirmLoss: true } : {}),
          },
        },
      );
      if (apply) setJob(r.id);
      else setEstimate(r);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    } finally {
      if (!apply) setBusy(false);
    }
  }
  return (
    <section className="panel archive-compression">
      <div className="panel-heading">
        <div>
          <h2>
            <Archive size={21} /> Alléger les archives
          </h2>
          <p>
            Compression WebP des photos d’animaux archivés. Les photos encore
            utilisées dans un album, une boîte d’import ou une fiche active sont
            conservées.
          </p>
        </div>
      </div>
      <div className="form-two">
        <label>
          Qualité · {quality}%
          <input
            type="range"
            min="65"
            max="95"
            value={quality}
            disabled={busy}
            onChange={(e) => setQuality(+e.target.value)}
          />
        </label>
        <label>
          Grand côté maximal
          <select
            value={maxDimension}
            disabled={busy}
            onChange={(e) => setDimension(+e.target.value)}
          >
            <option value="1920">1 920 px</option>
            <option value="2560">2 560 px</option>
            <option value="3840">3 840 px</option>
          </select>
        </label>
      </div>
      <Button
        type="button"
        icon={RefreshCw}
        variant="secondary"
        disabled={busy}
        onClick={() => run(false)}
      >
        {busy && !job ? "Estimation…" : "Estimer le gain"}
      </Button>
      {estimate && (
        <>
          <p>
            {estimate.count} fichiers · {bytes(estimate.bytes)} actuellement ·
            environ {bytes(estimate.estimatedSaving)} de gain (échantillon de{" "}
            {estimate.sample} fichiers).
          </p>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={accepted}
              disabled={busy}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            J’accepte la perte de qualité. AniPic doit créer et relire
            intégralement une sauvegarde avant de remplacer les originaux.
          </label>
          <Button
            type="button"
            icon={Minimize2}
            disabled={busy || !accepted || !estimate.count}
            onClick={() => run(true)}
          >
            {job
              ? "Sauvegarde et compression en cours…"
              : "Sauvegarder puis compresser"}
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <p className="small-note">
        Les imports et les modifications sont suspendus pendant l’opération. La
        sauvegarde des originaux est protégée de la rotation automatique. Le
        gain concerne le dossier photos ; la sauvegarde demande de l’espace
        supplémentaire. La restauration utilise cette sauvegarde complète.
      </p>
    </section>
  );
}
