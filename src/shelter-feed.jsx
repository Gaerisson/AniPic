import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Archive,
  Camera,
  Heart,
  Plus,
  RefreshCw,
  Rss,
  Undo2,
} from "lucide-react";
import { api, imageUrl, speciesName } from "./api.js";
import { Empty, Spinner, Button } from "./ui.jsx";
import { SpaPhoto } from "./spa-photo.jsx";
const kinds = {
  added: ["Nouvel arrivant", Plus],
  removed: ["Archivé", Archive],
  restored: ["De retour", Undo2],
  adopted: ["Adoption", Heart],
};
export function Feed({ open, version }) {
  const [events, setEvents] = useState(null),
    [kind, setKind] = useState("all"),
    [more, setMore] = useState(false),
    [cursor, setCursor] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setEvents(null);
    setMore(false);
    setCursor(null);
    setError("");
    api(`/feed?latest=1&limit=40&kind=${kind}`)
      .then((d) => {
        if (active) {
          setEvents(d.events);
          setMore(d.hasMore);
          setCursor(d.before);
        }
      })
      .catch((e) => {
        if (active) {
          setEvents([]);
          setError(e.message);
        }
      });
    return () => {
      active = false;
    };
  }, [version, kind]);
  const groups = new Map();
  for (const event of events || []) {
    const day = new Date(event.created_at).toLocaleDateString("fr-FR", {
      timeZone: "Europe/Paris",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day).push(event);
  }
  return (
    <div className="shelter-feed">
      <div className="page-heading">
        <div>
          <h1>Le fil du refuge</h1>
          <p>Les arrivées, les retours et les adoptions.</p>
        </div>
        <a
          className="button secondary"
          href="/feed.xml"
          target="_blank"
          rel="noreferrer"
        >
          <Rss size={17} />
          <span>S’abonner au RSS</span>
        </a>
      </div>
      <div className="feed-filter-bar" aria-label="Filtrer les événements">
        {[
          ["all", "Tout le fil"],
          ["added", "Arrivées"],
          ["adopted", "Adoptions"],
          ["restored", "Retours"],
          ["removed", "Archives"],
        ].map(([key, text]) => (
          <button
            key={key}
            disabled={busy}
            aria-pressed={kind === key}
            onClick={() => setKind(key)}
          >
            {text}
          </button>
        ))}
        <a href="/api/feed" target="_blank" rel="noreferrer">
          API <ArrowUpRight size={13} />
        </a>
      </div>
      {error && <p className="error-text">{error}</p>}
      {!events ? (
        <Spinner />
      ) : !events.length ? (
        <Empty
          icon={Rss}
          title="Aucun événement ici."
          text="Les prochains événements apparaîtront dans ce fil."
        />
      ) : (
        <div className="feed-timeline">
          {[...groups].map(([day, rows]) => (
            <section className="feed-day" key={day}>
              <div className="feed-day-heading">
                <h2>{day}</h2>
                <span>{rows.length}</span>
                <i />
              </div>
              <div className="feed-day-entries">
                {rows.map((event) => {
                  const type =
                      event.status === "adopted" ? "adopted" : event.kind,
                    [label, Icon] = kinds[type] || ["Mise à jour", RefreshCw];
                  return (
                    <button
                      className={`feed-entry event-${type}`}
                      key={event.id}
                      onClick={() =>
                        open({ type: "animal", id: event.animal_id })
                      }
                    >
                      <span className="feed-entry-photo">
                        {event.photo_id ? (
                          <img
                            src={imageUrl(event.photo_id, 320)}
                            alt={`Portrait de ${event.name}`}
                            loading="lazy"
                          />
                        ) : event.source_metadata?.thumbnail ? (
                          <SpaPhoto
                            animal={{ ...event, id: event.animal_id }}
                          />
                        ) : (
                          <Camera size={25} />
                        )}
                      </span>
                      <span className="feed-entry-content">
                        <span className="feed-entry-meta">
                          <span className="feed-event-label">
                            <Icon size={12} />
                            {label}
                          </span>
                          <time dateTime={event.created_at}>
                            {new Date(event.created_at).toLocaleTimeString(
                              "fr-FR",
                              {
                                timeZone: "Europe/Paris",
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </time>
                        </span>
                        <strong>{event.name}</strong>
                        <small>
                          {speciesName[event.species]}
                          {event.sex === "female"
                            ? " · Femelle"
                            : event.sex === "male"
                              ? " · Mâle"
                              : ""}
                          {event.source_metadata?.ageLabel
                            ? " · " + event.source_metadata.ageLabel
                            : ""}
                          {event.status === "source_missing"
                            ? " · Statut SPA à confirmer"
                            : event.kind === "removed" &&
                                event.status !== "adopted"
                              ? " · Album archivé"
                              : ""}
                        </small>
                        {event.description && (
                          <span className="feed-entry-description">
                            {event.description}
                          </span>
                        )}
                        <span className="feed-entry-origin">
                          <Camera size={11} />
                          {event.photo_count
                            ? `${event.photo_count} photo${event.photo_count > 1 ? "s" : ""} locale${event.photo_count > 1 ? "s" : ""}`
                            : event.source_metadata?.thumbnail
                              ? "Portrait du site SPA"
                              : "Portrait à réaliser"}
                          {event.breed && <i>{event.breed}</i>}
                        </span>
                      </span>
                      <ArrowUpRight className="feed-entry-arrow" size={18} />
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
      {more && events && (
        <Button
          disabled={busy}
          variant="secondary"
          className="feed-more"
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              const data = await api(
                `/feed?latest=1&limit=40&kind=${kind}&before=${cursor}`,
              );
              setEvents((v) => [...v, ...data.events]);
              setMore(data.hasMore);
              setCursor(data.before);
            } catch (e) {
              setError(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Chargement…" : "Afficher les événements précédents"}
        </Button>
      )}
    </div>
  );
}
