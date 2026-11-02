import { useEffect, useState } from "react";
import { Link2, Check, LoaderCircle, Unlink } from "lucide-react";
import { api, copyText } from "./api.js";
import { Button } from "./ui.jsx";
import { ActionMenu } from "./action-menu.jsx";
import "./share-link.css";

export function ShareLink({ kind, targetId, notify, unavailable = false }) {
  const [items, setItems] = useState([]),
    [link, setLink] = useState(null),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false),
    [manual, setManual] = useState(false),
    [error, setError] = useState(""),
    [shareable, setShareable] = useState(false);
  const label = kind === "animal" ? "fiche" : "photo";
  const endpoint = `/shares?kind=${kind}&targetId=${encodeURIComponent(targetId)}`;
  useEffect(() => {
    let active = true;
    api(endpoint)
      .then((d) => {
        if (active) {
          setItems(d.items);
          setShareable(d.shareable);
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [endpoint, unavailable]);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = async () => {
    setBusy(true);
    setError("");
    try {
      const current = await api(endpoint);
      let value = link;
      if (!value || !current.items.some((item) => item.id === value.id)) {
        value = await api("/shares", {
          method: "POST",
          body: { kind, targetId },
        });
        setLink(value);
        setItems([value, ...current.items]);
      } else setItems(current.items);
      try {
        await copyText(value.url);
        setCopied(true);
        setManual(false);
        notify(
          "Lien public copié · accessible sans PIN ni compte pendant 30 jours.",
        );
      } catch {
        setManual(true);
        notify("Lien prêt : copiez-le dans le champ affiché.");
      }
    } catch (e) {
      setError(e.message);
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="public-share-control">
      <Button
        variant="secondary"
        icon={busy ? LoaderCircle : copied ? Check : Link2}
        disabled={busy || unavailable || !shareable}
        aria-label={`Copier le lien ${label}`}
        onClick={copy}
        title={
          unavailable || !shareable
            ? "Cet élément est privé, archivé ou indisponible. Seules les photos publiques peuvent être partagées."
            : "Toute personne disposant du lien pourra ouvrir cet élément pendant 30 jours, sans PIN ni compte."
        }
      >
        {copied ? "Lien copié" : `Copier le lien ${label}`}
      </Button>
      <ActionMenu label={`Liens ${label} (${items.length})`} busy={busy}>
        <strong>Partage public de la {label}</strong>
        <p>
          Tout détenteur du lien peut ouvrir cet élément sans PIN ni compte. Les
          liens expirent après 30 jours. Les photos privées sont exclues.
        </p>
        {link && (
          <label className="public-share-manual">
            Dernier lien créé
            <input
              aria-label={`Dernier lien public de la ${label}`}
              readOnly
              value={link.url}
              onFocus={(e) => e.currentTarget.select()}
            />
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              Voir le partage
            </a>
          </label>
        )}
        {error && <p role="alert">{error}</p>}
        {!items.length && <p>Aucun lien actif.</p>}
        {items.map((item) => (
          <div className="public-share-row" key={item.id}>
            <small>
              Créé le {new Date(item.created_at).toLocaleDateString("fr-FR")} ·
              expire le {new Date(item.expires_at).toLocaleDateString("fr-FR")}
            </small>
            <Button
              variant="quiet"
              icon={Unlink}
              disabled={busy}
              aria-label={`Désactiver le lien ${item.id.slice(0, 8)}`}
              onClick={async () => {
                setBusy(true);
                try {
                  await api(`/shares/${item.id}`, { method: "DELETE" });
                  setItems((previous) =>
                    previous.filter((row) => row.id !== item.id),
                  );
                  if (link?.id === item.id) {
                    setLink(null);
                    setManual(false);
                    setCopied(false);
                  }
                  notify(
                    "Lien désactivé. Il ne donne plus accès à cet élément.",
                  );
                } catch (e) {
                  setError(e.message);
                  notify(e.message, "error");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Désactiver
            </Button>
          </div>
        ))}
      </ActionMenu>
      {manual && link && (
        <label className="public-share-manual">
          Lien à partager
          <input
            aria-label={`Lien public de la ${label}`}
            readOnly
            value={link.url}
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
      )}
    </div>
  );
}
