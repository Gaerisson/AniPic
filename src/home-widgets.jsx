import { useState, useEffect, lazy, Suspense } from "react";
import {
  Camera,
  Rss,
  Monitor,
  ArrowUpRight,
  Plus,
  Minus,
  Heart,
  Undo2,
  RefreshCw,
} from "lucide-react";
import { AdoptionActions, decideAdoption } from "./adoption-actions.jsx";
import { refugeEvent } from "../shared/feed-event.mjs";
import { api, imageUrl } from "./api.js";
import { SpaPhoto } from "./spa-photo.jsx";
import { parisDate, agendaDateLabel } from "../shared/agenda.mjs";
const Player = lazy(() =>
  import("./show-player.jsx").then((m) => ({ default: m.ShowPlayer })),
);
export function HomeWidgets({ widgets, user, overview, open, notify, reload }) {
  const [tasks, setTasks] = useState([]),
    [revision, setRevision] = useState(0),
    [deciding, setDeciding] = useState(""),
    [feed, setFeed] = useState(null),
    [feedError, setFeedError] = useState(""),
    [tv, setTv] = useState(null),
    [agenda, setAgenda] = useState(null),
    [agendaError, setAgendaError] = useState("");
  useEffect(() => {
    if (!widgets.includes("agenda") || !user) return;
    let stop = false;
    const load = () => {
      const from = parisDate(),
        end = new Date(from + "T12:00:00Z");
      end.setUTCDate(end.getUTCDate() + 90);
      api(`/agenda?from=${from}&to=${end.toISOString().slice(0, 10)}`)
        .then((r) => {
          if (!stop) {
            setAgenda(
              r.items
                .filter((e) => e.keyEvent && e.status !== "cancelled")
                .slice(0, 6),
            );
            setAgendaError("");
          }
        })
        .catch((e) => {
          if (!stop) setAgendaError(e.message);
        });
    };
    load();
    const timer = setInterval(load, 60000);
    window.addEventListener("focus", load);
    return () => {
      stop = true;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [widgets.includes("agenda"), user?.id]);
  useEffect(() => {
    if (widgets.includes("priorities") && user)
      api("/tasks")
        .then(setTasks)
        .catch(() => {});
  }, [widgets.join("|"), user?.id]);
  useEffect(() => {
    if (!widgets.includes("activity")) return;
    let active = true,
      inFlight = false;
    const load = async () => {
      if (inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const [v, reviews] = await Promise.all([
          api("/feed?latest=1&limit=12"),
          ["admin", "agent"].includes(user?.role)
            ? api("/adoption-reviews?limit=2")
            : Promise.resolve(null),
        ]);
        const combined = [
          ...(reviews?.items || []).map((a) => ({
            ...a,
            id: "review:" + a.id,
            animal_id: a.id,
            photo_id: a.cover_id,
            kind: "removed",
            created_at: a.at,
          })),
          ...(v.events || []),
        ];
        const ids = new Set();
        const recent = combined
          .filter((a) => {
            if (ids.has(a.animal_id)) return false;
            ids.add(a.animal_id);
            return true;
          })
          .slice(0, 4);
        if (active) {
          setFeed(recent);
          setFeedError("");
        }
      } catch {
        /* Keep the last known activity during an outage. */
        if (active)
          setFeedError("Le fil du refuge est temporairement indisponible.");
      } finally {
        inFlight = false;
      }
    };
    load();
    const timer = setInterval(load, 60000);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
    };
  }, [widgets.includes("activity"), user?.id, overview, revision]);
  useEffect(() => {
    if (!widgets.includes("tv")) return;
    const load = () =>
      api("/public/display")
        .then(setTv)
        .catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [widgets.includes("tv")]);
  return (
    <>
      {widgets
        .filter((k) => !["photos", "clockWeather"].includes(k))
        .map((key) => (
          <section
            key={key}
            className={`panel home-widget widget-${key}`}
            style={{ order: widgets.indexOf(key), gridColumn: "1 / -1" }}
          >
            {key === "stats" ? (
              <>
                <h2>La photothèque</h2>
                <p className="small-note">
                  Animaux présents · portraits réalisés par l’équipe
                </p>
                <div className="photo-coverage-grid">
                  {(overview?.stats?.photoCoverage || []).map((c) => (
                    <div className="photo-coverage" key={c.species}>
                      <div>
                        <strong>{c.total}</strong>
                        <span>
                          {
                            { dog: "chiens", cat: "chats", other: "NAC" }[
                              c.species
                            ]
                          }
                        </span>
                      </div>
                      <p>
                        <b>{c.photographed}</b> photographiés sur {c.total}
                        <small>
                          {c.remaining} restant{c.remaining > 1 ? "s" : ""}
                        </small>
                      </p>
                      <div
                        className="photo-coverage-track"
                        role="progressbar"
                        aria-label={`Portraits locaux · ${{ dog: "chiens", cat: "chats", other: "NAC" }[c.species]}`}
                        aria-valuenow={c.photographed}
                        aria-valuemin={0}
                        aria-valuemax={Math.max(1, c.total)}
                      >
                        <i style={{ width: `${c.percent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : key === "tv" ? (
              <>
                <h2>
                  <Monitor size={18} />À l’écran du refuge
                  <a href="#display" target="_blank" rel="noreferrer">
                    Ouvrir <ArrowUpRight size={14} />
                  </a>
                </h2>
                {tv?.enabled ? (
                  <div className="home-tv-player">
                    <Suspense fallback={<p>Chargement…</p>}>
                      <Player show={tv} synced />
                    </Suspense>
                  </div>
                ) : (
                  <p className="muted">Le programme TV n’est pas activé.</p>
                )}
              </>
            ) : key === "agenda" ? (
              <>
                <h2>
                  Les prochains rendez-vous{" "}
                  <a href="#agenda">
                    Tout l’agenda <ArrowUpRight size={14} />
                  </a>
                </h2>
                {!user ? (
                  <p className="muted">
                    Connectez-vous pour consulter l’agenda de l’équipe.
                  </p>
                ) : agendaError ? (
                  <p role="alert">{agendaError}</p>
                ) : agenda === null ? (
                  <p role="status">Chargement des rendez-vous…</p>
                ) : agenda.length ? (
                  <div className="home-agenda-list">
                    {agenda.map((e) => (
                      <a href="#agenda" key={e.id}>
                        <time dateTime={e.date}>
                          {agendaDateLabel(e.date)}
                          {e.time && ` · ${e.time}`}
                        </time>
                        <strong>{e.title}</strong>
                        {e.location && <small>{e.location}</small>}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    Aucune date clé prévue dans les 90 prochains jours.
                  </p>
                )}
              </>
            ) : key === "priorities" ? (
              <>
                <h2>
                  <Camera size={18} />
                  Planning photo
                  <a href="#todo">
                    Voir le planning <ArrowUpRight size={14} />
                  </a>
                </h2>
                {user ? (
                  <div className="home-widget-list">
                    {tasks
                      .filter((t) => t.state !== "done")
                      .slice(0, 4)
                      .map((t) => (
                        <button
                          key={t.id}
                          onClick={() =>
                            open({ type: "animal", id: t.animal_id })
                          }
                        >
                          <span>
                            {t.cover_id ? (
                              <img src={imageUrl(t.cover_id, 160)} alt="" />
                            ) : (
                              <SpaPhoto
                                animal={{
                                  ...t,
                                  id: t.animal_id,
                                  name: t.animal_name,
                                }}
                                compact
                                watermark={false}
                              />
                            )}
                          </span>
                          <strong>
                            {t.animal_name}
                            <small>
                              {t.state === "progress"
                                ? "Photographié · en traitement"
                                : t.title}
                            </small>
                          </strong>
                          <ArrowUpRight size={16} />
                        </button>
                      ))}
                  </div>
                ) : (
                  <p className="muted">
                    Connectez-vous pour consulter les priorités.
                  </p>
                )}
              </>
            ) : (
              <>
                <h2>
                  <Rss size={18} />
                  Au fil du refuge
                  <a href="#feed">
                    Tout voir <ArrowUpRight size={14} />
                  </a>
                </h2>
                {feedError && feed !== null && (
                  <p role="alert" className="error-text">
                    {feedError}
                  </p>
                )}
                <div className="home-widget-list refuge-mini-feed">
                  {(feed || []).slice(0, 4).map((t) => {
                    const event = refugeEvent(t),
                      Icon = {
                        plus: Plus,
                        minus: Minus,
                        heart: Heart,
                        return: Undo2,
                        update: RefreshCw,
                      }[event.symbol];
                    return (
                      <article
                        className={`refuge-mini-event event-${event.type}`}
                        key={t.id || t.seq}
                      >
                        <button
                          className="refuge-event-main"
                          onClick={() =>
                            open({ type: "animal", id: t.animal_id })
                          }
                        >
                          <span className="refuge-event-portrait">
                            {t.photo_id ? (
                              <img src={imageUrl(t.photo_id, 160)} alt="" />
                            ) : (
                              <SpaPhoto
                                animal={{ ...t, id: t.animal_id }}
                                compact
                                watermark={false}
                              />
                            )}
                          </span>
                          <span
                            className="refuge-event-icon"
                            aria-hidden="true"
                          >
                            <Icon size={18} />
                          </span>
                          <strong>
                            {t.name}
                            <small className="refuge-event-label">
                              {event.label}
                            </small>
                            <time dateTime={t.created_at}>
                              {new Date(t.created_at).toLocaleString("fr-FR", {
                                timeZone: "Europe/Paris",
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </time>
                          </strong>
                          <ArrowUpRight
                            size={15}
                            className="refuge-event-open"
                          />
                        </button>
                        <AdoptionActions
                          review={t.adoption_review}
                          busy={deciding === t.animal_id}
                          onDecide={async (action) => {
                            setDeciding(t.animal_id);
                            try {
                              await decideAdoption(
                                t.animal_id,
                                t.adoption_review,
                                action,
                              );
                              notify?.(
                                action === "confirm"
                                  ? `Adoption de ${t.name} confirmée.`
                                  : `Adoption de ${t.name} annulée.`,
                              );
                              reload?.();
                            } catch (e) {
                              setFeedError(e.message);
                              notify?.(e.message);
                            } finally {
                              setDeciding("");
                              setRevision((r) => r + 1);
                            }
                          }}
                        />
                      </article>
                    );
                  })}
                  {feed === null && (
                    <p className="muted" role="status">
                      {feedError || "Chargement des nouvelles…"}
                    </p>
                  )}
                  {feed?.length === 0 && (
                    <p className="muted">
                      Les prochaines nouvelles du refuge apparaîtront ici.
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        ))}
    </>
  );
}
