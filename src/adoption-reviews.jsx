import { AdoptionActions, decideAdoption } from "./adoption-actions.jsx";
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
    [filter, setFilter] = useState("pending"),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    if (!["admin", "agent"].includes(user?.role)) return;
    let active = true;
    const load = () =>
      api(`/adoption-reviews?page=${page}&state=${filter}`)
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
  }, [user?.id, version, page, filter, revision]);
  if (!["admin", "agent"].includes(user?.role))
    return (
      <Empty
        icon={Heart}
        title="Vérification des adoptions"
        text="Cette liste est réservée aux agents SPA et à l’administration."
      />
    );
  const decide = async (a, action) => {
    setBusy(a.id);
    try {
      await decideAdoption(a.id, a.adoption_review, action);
      notify(
        action === "confirm"
          ? `Adoption de ${a.name} confirmée.`
          : `Adoption de ${a.name} annulée.`,
      );
      reload();
    } catch (e) {
      setError(e.message);
      reload();
    } finally {
      setBusy("");
      setRevision((r) => r + 1);
    }
  };
  return (
    <div className="adoption-reviews">
      <div className="page-heading">
        <div>
          <div className="eyebrow">LE REFUGE · VALIDATION ÉQUIPE</div>
          <h1>
            Suivi des adoptions
            {data ? <span className="review-total">{data.total}</span> : null}
          </h1>
          <p>
            Confirmez les départs et retrouvez les décisions de l’équipe ou de
            la règle automatique.
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
          Les absences sont déduites des inventaires SPA. En mode 24 h,
          l’adoption reste en attente avant d’être comptée. Vous pouvez refuser
          une proposition ou annuler une décision à tout moment dans
          l’historique. Le refus conserve la fiche dans les archives, sans
          compter d’adoption. Les photos sont conservées. Un retour sur le site
          SPA corrige le départ.
        </span>
      </p>
      <label className="adoption-review-filter">
        Afficher{" "}
        <select
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setPage(1);
            setData(null);
          }}
        >
          <option value="pending">À confirmer</option>
          <option value="all">Toutes les décisions</option>
          <option value="confirmed">Adoptions confirmées</option>
          <option value="rejected">Adoptions annulées / refusées</option>
        </select>
      </label>
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
          text="Aucune décision dans cette liste."
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
                  <small>
                    {
                      {
                        pending: "En attente de validation",
                        confirmed:
                          a.adoption_review.by === "automatic"
                            ? "Confirmée automatiquement"
                            : "Confirmée par l’équipe",
                        rejected: "Adoption écartée par l’équipe",
                      }[a.adoption_review.state]
                    }
                  </small>
                  <time dateTime={a.at}>Départ détecté le {date(a.at)}</time>
                  <small>
                    {a.confirmations} inventaires complets concordants
                  </small>
                </div>
                <div className="review-actions">
                  <AdoptionActions
                    review={a.adoption_review}
                    busy={!!busy}
                    onDecide={(action) => decide(a, action)}
                  />
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
