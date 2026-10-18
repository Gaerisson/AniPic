import { useEffect, useState } from "react";
import { Heart, Check, RefreshCw, ArrowUpRight, PawPrint } from "lucide-react";
import { api, imageUrl, speciesName, date } from "./api.js";
import { Button, Spinner, Empty } from "./ui.jsx";
import { SpaPhoto } from "./spa-photo.jsx";

export default function AdoptionReviews({
  user,
  version,
  reload,
  notify,
  open,
}) {
  const [data, setData] = useState(null),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (!["admin", "agent"].includes(user?.role)) return;
    let active = true;
    const load = () =>
      api(`/adoption-reviews?page=${page}`)
        .then((d) => {
          if (active) {
            setData(d);
            setError("");
            if (page > d.pages) setPage(d.pages);
          }
        })
        .catch((e) => active && setError(e.message));
    load();
    const timer = setInterval(load, 60000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [user?.id, version, page]);
  if (!["admin", "agent"].includes(user?.role))
    return (
      <Empty
        icon={Heart}
        title="Vérification des adoptions"
        text="Cette liste est réservée aux agents SPA et à l’administration."
      />
    );
  const confirm = async (a) => {
    setBusy(a.id);
    try {
      await api(`/adoption-reviews/${a.id}/confirm`, {
        method: "POST",
        body: { expectedAt: a.at },
      });
      notify(`Adoption de ${a.name} confirmée.`);
      reload();
    } catch (e) {
      setError(e.message);
      reload();
    } finally {
      setBusy("");
    }
  };
  return (
    <div className="adoption-reviews">
      <div className="page-heading">
        <div>
          <div className="eyebrow">LE REFUGE · VALIDATION ÉQUIPE</div>
          <h1>
            Adoptions à confirmer
            {data ? <span className="review-total">{data.total}</span> : null}
          </h1>
          <p>
            Les départs ont déjà été archivés automatiquement. Confirmez les
            adoptions connues de l’équipe.
          </p>
        </div>
        <Button variant="secondary" onClick={reload} disabled={!!busy}>
          <RefreshCw size={16} />
          Actualiser
        </Button>
      </div>
      <p className="panel adoption-review-help">
        <Heart size={20} />
        <span>
          Ces adoptions sont déduites des absences sur le site SPA et déjà
          incluses dans les statistiques. Votre validation les marque comme
          confirmées par l’équipe, sans les compter deux fois. Les photos sont
          conservées ; un retour dans l’inventaire SPA corrige automatiquement
          le départ.
        </span>
      </p>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      {!data ? (
        error ? (
          <Empty
            title="Liste indisponible"
            text="Utilisez Actualiser pour réessayer."
          />
        ) : (
          <Spinner />
        )
      ) : !data.total ? (
        <Empty
          icon={Check}
          title="Tout est à jour."
          text="Aucune adoption automatique en attente de validation."
        />
      ) : (
        <>
          <div className="adoption-review-grid">
            {data.items.map((a) => (
              <article key={a.id} className="panel adoption-review-card">
                <button
                  className="review-portrait"
                  aria-label={`Ouvrir ${a.name}`}
                  onClick={() => open({ type: "animal", id: a.id })}
                >
                  {a.cover_id ? (
                    <img src={imageUrl(a.cover_id, 320)} alt={a.name} />
                  ) : a.source_metadata?.thumbnail ? (
                    <SpaPhoto animal={a} />
                  ) : (
                    <PawPrint size={32} />
                  )}
                </button>
                <div className="review-animal">
                  <strong>{a.name}</strong>
                  <small>
                    {speciesName[a.species]} · {a.source_id}
                  </small>
                  <time dateTime={a.at}>Départ détecté le {date(a.at)}</time>
                  <small>
                    {a.confirmations} inventaires complets concordants
                  </small>
                </div>
                <div className="review-actions">
                  <Button onClick={() => confirm(a)} disabled={!!busy}>
                    <Check size={16} />
                    {busy === a.id ? "Validation…" : "Confirmer l’adoption"}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => open({ type: "animal", id: a.id })}
                  >
                    Voir la fiche <ArrowUpRight size={15} />
                  </Button>
                </div>
              </article>
            ))}
          </div>
          {data.pages > 1 && (
            <div className="review-pagination">
              <Button
                variant="secondary"
                disabled={page === 1 || !!busy}
                onClick={() => setPage((p) => p - 1)}
              >
                Précédente
              </Button>
              <span>
                Page {page} / {data.pages}
              </span>
              <Button
                variant="secondary"
                disabled={page >= data.pages || !!busy}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivante
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
