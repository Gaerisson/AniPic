import { useEffect, useState } from "react";
import { api, imageUrl } from "./api.js";
import { SpaPhoto } from "./spa-photo.jsx";
import { Heart, Plus, ArrowUpRight, Images } from "lucide-react";
export function MobileNews({ go, open }) {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    let live = true;
    const load = () =>
      api("/feed?latest=1&limit=4")
        .then((d) => live && setEvents(d.events))
        .catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);
  return events.length ? (
    <div className="mobile-news">
      {events.map((e) => (
        <button
          key={e.id}
          className="mobile-news-row"
          onClick={() => open({ type: "animal", id: e.animal_id })}
        >
          {e.photo_id ? (
            <img src={imageUrl(e.photo_id, 160)} alt="" />
          ) : (
            <SpaPhoto
              animal={{
                id: e.animal_id,
                name: e.name,
                source_metadata: e.source_metadata,
              }}
              compact
            />
          )}
          <span>
            <strong>{e.name}</strong>
            <small>
              {e.kind === "adopted"
                ? "Une nouvelle famille"
                : e.kind === "added"
                  ? "Bienvenue au refuge"
                  : "Fiche mise à jour"}
            </small>
            <time>
              {new Date(e.created_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              })}
            </time>
          </span>
          {e.kind === "adopted" ? (
            <Heart size={17} />
          ) : e.kind === "added" ? (
            <Plus size={17} />
          ) : (
            <ArrowUpRight size={17} />
          )}
        </button>
      ))}
    </div>
  ) : null;
}
export function MobilePortraits({ go, open }) {
  const [animals, setAnimals] = useState([]);
  useEffect(() => {
    let live = true;
    api("/animals?limit=6&sort=recent")
      .then((d) => live && setAnimals(d.items))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return (
    <section className="panel mobile-portraits">
      <header>
        <h2>
          <Images size={19} /> Les portraits
        </h2>
        <button className="text-link" onClick={() => go("mobilePhotos")}>
          Tout voir ↗
        </button>
      </header>
      <div>
        {animals.map((a) => (
          <button key={a.id} onClick={() => open({ type: "animal", id: a.id })}>
            {a.cover_id ? (
              <img src={imageUrl(a.cover_id, 320)} alt={a.name} />
            ) : (
              <SpaPhoto animal={a} compact />
            )}
            <strong>{a.name}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
