import { useEffect, useState } from "react";
import { api } from "./api.js";
import { useStatusAppearance } from "./animal-status.jsx";
import { statusKeys } from "../shared/animal-status.mjs";
export function LibraryFilters({
  page,
  status,
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
      {page !== "departures" && (
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
