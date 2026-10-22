import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, HardDrive } from "lucide-react";
import { api } from "./api.js";
import { Button, Spinner } from "./ui.jsx";
export function StorageChecks({ notify }) {
  const [rows, setRows] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function check(write = false) {
    setBusy(true);
    try {
      setRows(
        await api(
          "/admin/storage/" + (write ? "check" : "health"),
          write ? { method: "POST" } : {},
        ),
      );
      setError("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    check();
  }, []);
  return (
    <section className="panel storage-checks">
      <header>
        <div>
          <h2>État des dossiers</h2>
          <small>Permissions du compte utilisé par AniPic</small>
        </div>
        <Button
          variant="secondary"
          icon={RefreshCw}
          disabled={busy}
          onClick={() => check(true)}
        >
          {busy ? "Vérification…" : "Tester l’accès"}
        </Button>
      </header>
      {error && <p role="alert">{error}</p>}
      <div>
        {rows?.map((r) => (
          <article key={r.key} data-ok={r.ok}>
            <span>
              {r.ok ? <CheckCircle2 /> : <AlertCircle />}
              <strong>{r.label}</strong>
            </span>
            <b>
              {!r.configured
                ? "Non configuré"
                : r.ok
                  ? "Accessible"
                  : "Indisponible"}
            </b>
            {r.path && <code>{r.path}</code>}
            <small>{r.error || r.mode || "Dossier facultatif"}</small>
          </article>
        ))}
      </div>
    </section>
  );
}
export { default as Journal } from "./journal-view.jsx";
