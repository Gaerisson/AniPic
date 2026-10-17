import { useEffect, useState } from "react";
import { api } from "./api.js";
import { useStatusAppearance } from "./animal-status.jsx";
import { statusKeys } from "../shared/animal-status.mjs";
export function LibraryFilters({
  page,
  status,
  compat,
  setCompat,
  photos,
  year,
  recent,
  change,
  user,
  publication = "all",
  mediaTag = "",
}) {
  const appearance = useStatusAppearance();
  const [tags, setTags] = useState([]);
  useEffect(() => {
    if (user)
      api("/media-tags")
        .then(setTags)
        .catch(() => {});
  }, [user?.id]);
  return (
    <section
      className="library-filters"
      id="animal-filters"
      aria-label="Filtres des animaux"
    >
      <label>
        Statut
        <select
          aria-label="Filtrer par statut"
          value={status}
          onChange={(e) => change("status", e.target.value)}
        >
          <option value="all">Tous les statuts</option>
          {statusKeys.map((key) => (
            <option key={key} value={key}>
              {appearance[key].label}
            </option>
          ))}
        </select>
      </label>
      <label>
        SOS
        <select
          aria-label="Filtrer les SOS"
          value={compat.sos}
          onChange={(e) => setCompat((v) => ({ ...v, sos: e.target.value }))}
        >
          <option value="all">Tous les animaux</option>
          <option value="yes">SOS uniquement</option>
          <option value="no">Hors SOS</option>
        </select>
      </label>
      {[
        ["cats", "Chats"],
        ["dogs", "Chiens"],
        ["children", "Enfants"],
      ].map(([key, label]) => (
        <label key={key}>
          Entente {label.toLowerCase()}
          <select
            aria-label={"Entente " + label.toLowerCase()}
            value={compat[key]}
            onChange={(e) =>
              setCompat((v) => ({ ...v, [key]: e.target.value }))
            }
          >
            <option value="all">Toutes</option>
            <option value="yes">Oui · sans réserve</option>
            <option value="conditional">À nuancer / sous conditions</option>
            <option value="no">Non</option>
            <option value="unknown">Non renseignée / à tester</option>
          </select>
        </label>
      ))}
      <label>
        Photos locales
        <select
          aria-label="Filtrer par photos locales"
          value={photos}
          onChange={(e) => change("photos", e.target.value)}
        >
          <option value="all">Avec ou sans photos</option>
          <option value="with">Avec photos</option>
          <option value="without">Sans photo</option>
        </select>
      </label>
      {page !== "archives" && (
        <label>
          {page === "archives" ? "Année d’archive" : "Année des photos"}
          <select
            aria-label="Filtrer par année"
            value={year}
            onChange={(e) => change("year", Number(e.target.value))}
          >
            <option value={0}>Toutes les années</option>
            {Array.from(
              { length: 40 },
              (_, i) => new Date().getFullYear() - i,
            ).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      )}
      {user && (
        <label>
          Mise en avant
          <select
            aria-label="Filtrer les animaux publiés"
            value={publication}
            onChange={(e) => change("publication", e.target.value)}
          >
            <option value="all">Tous</option>
            <option value="yes">Déjà publiés</option>
            <option value="no">Pas encore publiés</option>
          </select>
        </label>
      )}
      {user && (
        <label>
          Thème des photos
          <select
            aria-label="Filtrer par thème photo"
            value={mediaTag}
            onChange={(e) => change("mediaTag", e.target.value)}
          >
            <option value="">Tous les thèmes</option>
            {tags.map((t) => (
              <option key={t.tag}>{t.tag}</option>
            ))}
          </select>
        </label>
      )}
      <label className="recent-filter">
        <input
          type="checkbox"
          checked={recent}
          onChange={(e) => change("recent", e.target.checked)}
        />
        Photos de la semaine
      </label>
    </section>
  );
}
