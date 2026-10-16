import { useState, useEffect, lazy, Suspense } from "react";
import { Camera, Rss, Monitor, ArrowUpRight } from "lucide-react";
import { api, imageUrl } from "./api.js";
import { SpaPhoto } from "./spa-photo.jsx";
const Player = lazy(() =>
  import("./show-player.jsx").then((m) => ({ default: m.ShowPlayer })),
);
export function HomeWidgets({ widgets, user, overview, open }) {
  const [tasks, setTasks] = useState([]),
    [feed, setFeed] = useState([]),
    [tv, setTv] = useState(null);
  useEffect(() => {
    if (widgets.includes("priorities") && user)
      api("/tasks")
        .then(setTasks)
        .catch(() => {});
    if (widgets.includes("activity"))
      api("/feed?latest=1&limit=4")
        .then((v) => setFeed(v.items || v.events || []))
        .catch(() => {});
  }, [widgets.join("|"), user?.id]);
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
                <div className="home-widget-stats">
                  {[
                    [overview?.stats?.total, "compagnons"],
                    [overview?.stats?.photos, "photos"],
                    [overview?.stats?.needPhotos, "à photographier"],
                  ].map(([n, label]) => (
                    <div key={label}>
                      <strong>{n || 0}</strong>
                      <span>{label}</span>
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
                <div className="home-widget-list">
                  {feed.slice(0, 4).map((t) => (
                    <button
                      key={t.id || t.seq}
                      onClick={() => open({ type: "animal", id: t.animal_id })}
                    >
                      <strong>
                        {t.name}
                        <small>
                          {{
                            added: "Nouvel arrivant",
                            adopted: "Adoption",
                            archived: "Archivage",
                            removed: "Départ",
                            returned: "Retour",
                            restored: "Retour",
                          }[t.kind] || "Nouvelle du refuge"}
                        </small>
                      </strong>
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>
        ))}
    </>
  );
}
