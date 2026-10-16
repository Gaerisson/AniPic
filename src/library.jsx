import { PhotoUpdate } from "./photo-update.jsx";
import { useState, useEffect, useRef } from "react";
import {
  PawPrint,
  Dog,
  Cat,
  Rabbit,
  Images,
  Heart,
  Archive,
  Camera,
  Search,
  Plus,
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  List,
  Upload,
  SlidersHorizontal,
  CheckCheck,
  Info,
  Video,
  Download,
} from "lucide-react";
import { api, date, speciesName, imageUrl } from "./api.js";
import { Spinner, Empty, Button } from "./ui.jsx";
import { Home, HoverPhoto } from "./home.jsx";
import { AnimalStatus, StatusKey } from "./animal-status.jsx";
import { LibraryFilters } from "./library-filters.jsx";
import { SpaPhoto } from "./spa-photo.jsx";

const titles = {
  gallery: ["La photothèque", ""],
  animals: ["Les animaux", ""],
  archives: ["Archives", ""],
  favorites: ["Mes favoris", ""],
  todo: ["À photographier", ""],
  departures: ["Animaux partis", ""],
};
export function Library({
  page,
  q,
  setQ,
  overview,
  version,
  open,
  notify,
  reload,
  upload,
  canEdit,
  user,
  favorites,
  favorite,
  animations,
  video,
  ui,
}) {
  const [year, setYear] = useState(0);
  const [recentOnly, setRecentOnly] = useState(false);
  const [mediaTag, setMediaTag] = useState("");
  const [publication, setPublication] = useState("all");
  const [status, setStatus] = useState("all"),
    [photos, setPhotos] = useState("all"),
    [filtersOpen, setFiltersOpen] = useState(false);
  const [species, setSpecies] = useState("all"),
    [sort, setSort] = useState(ui?.defaultSort || "recent"),
    [view, setView] = useState(ui?.defaultView || "grid"),
    [data, setData] = useState(null),
    [number, setNumber] = useState(1),
    [loading, setLoading] = useState(false);
  const [debounced, setDebounced] = useState(q);
  useEffect(() => {
    const handler = (e) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement?.tagName,
        )
      ) {
        e.preventDefault();
        document.querySelector('[aria-label="Rechercher un animal"]')?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(q), 220);
    return () => clearTimeout(timer);
  }, [q]);
  useEffect(() => {
    setNumber(1);
  }, [
    species,
    debounced,
    page,
    sort,
    year,
    recentOnly,
    status,
    photos,
    publication,
    mediaTag,
  ]);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      q: debounced,
      species,
      status,
      photos,
      publication: user ? publication : "all",
      mediaTag: user ? mediaTag : "",
      sort,
      page: String(number),
      archive: page === "archives" || page === "departures" ? "1" : "0",
      missing: page === "todo" ? "1" : "0",
      favorites: page === "favorites" && user ? "1" : "0",
      limit: String(ui?.cardsPerPage || 24),
      recent: recentOnly ? "1" : "0",
    });
    if (year) params.set("year", String(year));
    if (page === "favorites" && !user) params.set("ids", favorites.join(","));
    api("/animals?" + params)
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((e) => !cancelled && notify(e.message, "error"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [
    species,
    sort,
    number,
    debounced,
    page,
    version,
    user?.id,
    favorites,
    year,
    recentOnly,
    status,
    photos,
    publication,
    mediaTag,
    ui?.cardsPerPage,
  ]);
  useEffect(() => {
    setYear(page === "departures" ? new Date().getFullYear() : 0);
    setRecentOnly(false);
    setStatus("all");
    setPhotos("all");
    setPublication("all");
    setMediaTag("");
    setSort(
      page === "archives" || page === "departures"
        ? "archive"
        : ui?.defaultSort || "recent",
    );
  }, [page, ui?.defaultSort]);
  useEffect(() => setView(ui?.defaultView || "grid"), [ui?.defaultView]);
  const title = titles[page] || titles.gallery;
  const filterCount =
    Number(status !== "all") +
    Number(publication !== "all") +
    Number(!!mediaTag) +
    Number(photos !== "all") +
    Number(recentOnly) +
    Number(page !== "departures" && year !== 0);
  const hasFilters = Boolean(q || species !== "all" || filterCount);
  const resetFilters = () => {
    setPublication("all");
    setMediaTag("");
    setStatus("all");
    setPhotos("all");
    setYear(page === "departures" ? new Date().getFullYear() : 0);
    setRecentOnly(false);
    setSpecies("all");
    setQ("");
    setNumber(1);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>
            {title[0].replace(/\.+$/, "")}
            <span className="heading-dot">.</span>
          </h1>
          {title[1] && <p>{title[1]}</p>}
        </div>
        <div className="heading-actions">
          <Button icon={Upload} onClick={upload}>
            Importer des photos
          </Button>
        </div>
      </div>
      {page === "gallery" && !hasFilters && (
        <Home
          animals={data?.items || []}
          open={open}
          animations={animations}
          user={user}
          overview={overview}
          ui={ui}
        />
      )}
      {page === "archives" && (
        <div className="notice">
          <Archive size={19} />
          <span>
            L’archivage conserve les photos sans copier les fichiers. Vous
            pouvez restaurer chaque album à tout moment.
          </span>
        </div>
      )}
      {page === "departures" && (
        <div className="departure-toolbar">
          <label>
            Année
            <select
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                setNumber(1);
              }}
            >
              <option value={0}>Toutes les années</option>
              {Array.from(
                { length: 27 },
                (_, i) => new Date().getFullYear() - i,
              ).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          {canEdit && (
            <Button
              icon={Video}
              variant="secondary"
              disabled={!year}
              onClick={() => video({ year })}
            >
              Créer le film de {year || "l’année"}
            </Button>
          )}
          <span>« Absent de la source » ne confirme pas une adoption.</span>
        </div>
      )}
      {page === "favorites" && !user && (
        <div className="notice">
          <Heart size={19} />
          <span>
            Vos favoris sont enregistrés sur cet appareil. Connectez-vous pour
            les retrouver sur vos autres appareils.
          </span>
        </div>
      )}
      <div className="library-toolbar">
        <div className="species-tabs">
          {[
            ["all", "Tous les compagnons"],
            ["dog", "Chiens"],
            ["cat", "Chats"],
            ["other", "NAC"],
          ].map(([key, name]) => (
            <button
              key={key}
              className={species === key ? "selected" : ""}
              onClick={() => setSpecies(key)}
            >
              {key === "all" ? (
                <PawPrint size={16} />
              ) : key === "dog" ? (
                <Dog size={17} />
              ) : key === "cat" ? (
                <Cat size={17} />
              ) : (
                <Rabbit size={17} />
              )}{" "}
              {name}
            </button>
          ))}
        </div>
        <div className="toolbar-controls">
          <label className="search">
            <Search size={17} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Un nom, une histoire…"
              aria-label="Rechercher un animal"
            />
            <kbd>/</kbd>
          </label>
        </div>
      </div>
      <div className="results-bar">
        <span>
          {loading ? (
            <span className="muted">Recherche…</span>
          ) : (
            <>
              <strong>{data?.total || 0}</strong>{" "}
              {page === "todo"
                ? `${data?.total === 1 ? "compagnon" : "compagnons"} à photographier`
                : page === "archives"
                  ? data?.total === 1
                    ? "album archivé"
                    : "albums archivés"
                  : data?.total === 1
                    ? "compagnon"
                    : "compagnons"}
              {q && <span className="muted"> · Recherche</span>}
            </>
          )}
        </span>
        <div className="result-controls">
          <button
            className={`filter-toggle ${filterCount ? "active" : ""}`}
            aria-expanded={filtersOpen}
            aria-controls="animal-filters"
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <SlidersHorizontal size={15} /> Filtres{" "}
            {filterCount > 0 && <span>{filterCount}</span>}
            <ChevronDown size={13} />
          </button>
          {hasFilters && (
            <button className="filter-reset" onClick={resetFilters}>
              Réinitialiser
            </button>
          )}
          <label className="sort">
            <SlidersHorizontal size={14} />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Trier"
            >
              <option value="recent">Photos les plus récentes</option>
              <option value="name">Nom : A à Z</option>
              <option value="photos">Le plus de photos</option>
              <option value="few_photos">Le moins de photos</option>
              <option value="oldest">Photos les plus anciennes</option>
              <option value="name_desc">Nom : Z à A</option>
              <option value="arrival">Fiches ajoutées récemment</option>
              {(page === "archives" || page === "departures") && (
                <option value="archive">Archivage le plus récent</option>
              )}
            </select>
            <ChevronDown size={13} />
          </label>
          <div className="view-switch">
            <button
              className={view === "grid" ? "on" : ""}
              onClick={() => setView("grid")}
              aria-label="Vue en grille"
            >
              <Grid2X2 size={17} />
            </button>
            <button
              className={view === "list" ? "on" : ""}
              onClick={() => setView("list")}
              aria-label="Vue en liste"
            >
              <List size={19} />
            </button>
          </div>
        </div>
      </div>
      {filtersOpen && (
        <LibraryFilters
          page={page}
          status={status}
          photos={photos}
          mediaTag={mediaTag}
          publication={publication}
          user={user}
          year={year}
          recent={recentOnly}
          change={(key, value) => {
            ({
              status: setStatus,
              photos: setPhotos,
              publication: setPublication,
              mediaTag: setMediaTag,
              year: setYear,
              recent: setRecentOnly,
            })[key](value);
            setNumber(1);
          }}
        />
      )}
      <StatusKey />
      {!data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <Empty
          icon={
            page === "todo" ? CheckCheck : page === "favorites" ? Heart : Images
          }
          title={
            hasFilters
              ? "Aucun animal ne correspond."
              : page === "todo"
                ? "Tout le monde a son portrait."
                : q
                  ? "Aucun compagnon trouvé."
                  : "Aucune photo dans cette sélection."
          }
          text={
            hasFilters
              ? "Essayez un autre nom ou retirez un filtre."
              : page === "todo"
                ? "La photothèque est à jour. Les prochains arrivants apparaîtront ici."
                : "Ajoutez un animal ou choisissez une autre catégorie."
          }
          action={
            hasFilters ? (
              <Button variant="secondary" onClick={resetFilters}>
                Réinitialiser les filtres
              </Button>
            ) : null
          }
        />
      ) : view === "grid" ? (
        <div
          className={
            "animal-grid " +
            (page === "animals"
              ? "animal-portraits"
              : page === "gallery"
                ? "home-animal-grid"
                : "")
          }
        >
          {data.items.map((a) => (
            <AnimalCard
              key={a.id}
              a={a}
              user={user}
              favorites={user ? [] : favorites}
              favorite={favorite}
              open={open}
              archived={page === "archives" || page === "departures"}
              animations={animations}
              profile={page === "animals"}
              ui={ui}
            />
          ))}
        </div>
      ) : (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Compagnon</th>
                <th>Identité</th>
                <th>Photos</th>
                <th>Statut</th>
                <th>Mis à jour</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((a) => (
                <tr key={a.id}>
                  <td>
                    <button
                      className="table-animal"
                      onClick={() => open({ type: "animal", id: a.id })}
                    >
                      {a.cover_id ? (
                        <img src={imageUrl(a.cover_id, 320)} alt="" />
                      ) : a.source_metadata?.thumbnail ? (
                        <SpaPhoto animal={a} />
                      ) : (
                        <span className="table-empty">
                          <PawPrint size={20} />
                        </span>
                      )}
                      <strong>{a.name}</strong>
                    </button>
                  </td>
                  <td>
                    <span>
                      {speciesName[a.species]} ·{" "}
                      {a.sex === "female"
                        ? "Femelle"
                        : a.sex === "male"
                          ? "Mâle"
                          : "Sexe inconnu"}
                    </span>
                    <small className="table-id">
                      {a.source_id || a.id.slice(0, 8)}
                    </small>
                  </td>
                  <td>{a.photo_count}</td>
                  <td>
                    <AnimalStatus animal={a} />
                  </td>
                  <td>{date(a.updated_at)}</td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Ouvrir ${a.name}`}
                      onClick={() => open({ type: "animal", id: a.id })}
                    >
                      <ArrowUpRight size={19} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data?.pages > 1 && (
        <div className="pagination">
          <Button
            variant="secondary"
            icon={ChevronLeft}
            disabled={number === 1}
            onClick={() => {
              setNumber((n) => n - 1);
              window.scrollTo(0, 0);
            }}
          >
            Précédent
          </Button>
          <span>
            Page {number} sur {data.pages}
          </span>
          <Button
            variant="secondary"
            disabled={number === data.pages}
            onClick={() => {
              setNumber((n) => n + 1);
              window.scrollTo(0, 0);
            }}
          >
            Suivant <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </>
  );
}
function AnimalCard({
  user,
  a,
  open,
  favorites,
  favorite,
  archived,
  animations,
  profile,
  ui = {},
}) {
  const ref = useRef(),
    frame = useRef();
  const [flipped, setFlipped] = useState(false);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const agePhoto = a.latest_photo_at
    ? (Date.now() - Date.parse(a.latest_photo_at)) / 86400_000
    : 9999;
  const recent = agePhoto >= 0 && agePhoto < (ui.recentDays || 7);
  const highlight =
    a.tags.find((tag) => /^sos(?:\s|$)/i.test(tag)) || a.tags[0];
  const liked = a.favorite || favorites.includes(a.id);
  const birth = a.birth_date
    ? Math.max(
        0,
        Math.floor((Date.now() - Date.parse(a.birth_date)) / 31557600000),
      )
    : null;
  return (
    <article
      ref={ref}
      className={`animal-card tilt-card ${!a.cover_id ? "no-photo" : ""} ${recent ? "recent-photo" : ""} ${recent && agePhoto < 2 ? "fresh-photo" : ""} ${flipped ? "flipped" : ""}`}
      onPointerMove={(e) => {
        if (!animations || e.pointerType !== "mouse") return;
        const bounds = ref.current.getBoundingClientRect();
        const x = (e.clientX - bounds.left) / bounds.width - 0.5,
          y = (e.clientY - bounds.top) / bounds.height - 0.5;
        cancelAnimationFrame(frame.current);
        frame.current = requestAnimationFrame(() => {
          ref.current?.style.setProperty(
            "--tilt-x",
            `${-y * 24 * Number(getComputedStyle(document.documentElement).getPropertyValue("--tilt-strength") || 0.25)}deg`,
          );
          ref.current?.style.setProperty(
            "--tilt-y",
            `${x * 30 * Number(getComputedStyle(document.documentElement).getPropertyValue("--tilt-strength") || 0.25)}deg`,
          );
          ref.current?.style.setProperty(
            "--parallax-x",
            `${(-x * 12 * (ui.parallaxIntensity ?? 25)) / 100}px`,
          );
          ref.current?.style.setProperty(
            "--parallax-y",
            `${(-y * 12 * (ui.parallaxIntensity ?? 25)) / 100}px`,
          );
          ref.current?.style.setProperty("--shine-x", `${(x + 0.5) * 100}%`);
          ref.current?.style.setProperty("--shine-y", `${(y + 0.5) * 100}%`);
        });
      }}
      onPointerLeave={() => {
        cancelAnimationFrame(frame.current);
        ref.current?.style.setProperty("--tilt-x", "0deg");
        ref.current?.style.setProperty("--tilt-y", "0deg");
        ref.current?.style.setProperty("--parallax-x", "0px");
        ref.current?.style.setProperty("--parallax-y", "0px");
      }}
    >
      <div className="card-flip-frame">
        <div className="animal-photo card-front" inert={flipped}>
          {a.cover_id ? (
            <HoverPhoto
              animal={a}
              animations={animations && ui.hoverSlideshow !== false}
              intervalSeconds={ui.hoverSeconds}
              controls
              onOpen={() => open({ type: "animal", id: a.id })}
            />
          ) : (
            <button
              className="photo-link"
              aria-label={`Voir l’album de ${a.name}`}
              onClick={() => open({ type: "animal", id: a.id })}
            >
              {a.source_metadata?.thumbnail ? (
                <SpaPhoto animal={a} />
              ) : (
                <span className="photo-placeholder">
                  <Camera size={30} />
                  <span>Aucune photo locale</span>
                </span>
              )}
            </button>
          )}
          <span className="card-reflection" aria-hidden="true" />
          <button
            className={`favorite-button ${liked ? "liked" : ""}`}
            onClick={() => favorite(a)}
            aria-label={
              liked
                ? `Retirer ${a.name} des favoris`
                : `Ajouter ${a.name} aux favoris`
            }
          >
            <Heart size={17} fill={liked ? "currentColor" : "none"} />
          </button>
          {recent && !archived ? (
            <span className="recent-label">
              {agePhoto < 2 ? "Nouveau · 48 h" : "Photos récentes"}
            </span>
          ) : null}
          <div className="photo-badge-stack">
            {archived ? (
              <span className="photo-badge archived">
                <Archive size={12} />
                Archivé
              </span>
            ) : (
              <>
                {highlight && (
                  <span
                    className={`photo-badge ${/^sos/i.test(highlight) ? "sos" : ""}`}
                  >
                    <span />
                    {highlight}
                  </span>
                )}
                {!a.photo_count && (
                  <span className="photo-badge needs-photo">
                    <Camera size={12} />À photographier
                  </span>
                )}
              </>
            )}
          </div>
          {a.photo_count > 0 && (
            <span className="photo-count">
              <Images size={12} />
              {a.photo_count} photo{a.photo_count > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="card-back" inert={!flipped}>
          <AnimalStatus animal={a} />
          <h3>{a.name}</h3>
          <p>{a.description || "Une personnalité à découvrir au refuge."}</p>
          {a.breed && <strong>{a.breed}</strong>}
          <div>
            {Object.entries(a.compatibility || {})
              .slice(0, 3)
              .map(([k, v]) => (
                <span key={k}>
                  {k} : {v}
                </span>
              ))}
          </div>
          <Button
            variant="secondary"
            onClick={() => open({ type: "animal", id: a.id })}
          >
            Voir sa fiche et ses photos
          </Button>
        </div>
      </div>
      <button
        className="card-info"
        aria-label={"Informations de " + a.name}
        aria-expanded={flipped}
        onClick={() => setFlipped(!flipped)}
      >
        <Info size={16} />
      </button>
      <div className="animal-card-body">
        <div>
          <div className="animal-name-line">
            <button
              onClick={() => open({ type: "animal", id: a.id })}
              className="animal-name"
            >
              {a.name}
              <span className="sex">
                {a.sex === "female" ? "♀" : a.sex === "male" ? "♂" : ""}
              </span>
            </button>
            <AnimalStatus animal={a} compact />
            {a.publication && (
              <span
                className="publication-badge"
                title={`Mis en avant le ${date(a.publication.published_at)}`}
              >
                <CheckCheck size={12} />
                Publié
              </span>
            )}
          </div>
          <span className="animal-subtitle">
            {speciesName[a.species]}
            {birth !== null
              ? " · " +
                (birth < 1
                  ? "Moins d’un an"
                  : birth + " an" + (birth > 1 ? "s" : ""))
              : a.source_metadata?.ageLabel
                ? " · " + a.source_metadata.ageLabel
                : ""}
          </span>
          {a.photoWorkflow === "progress" && (
            <span className="workflow-treatment">
              Photographié · en traitement
            </span>
          )}
          {profile && (
            <span className="animal-breed">
              {a.breed || "Race non renseignée"}
            </span>
          )}
        </div>
        <button
          className="card-arrow"
          onClick={() => open({ type: "animal", id: a.id })}
          aria-label={`Ouvrir ${a.name}`}
        >
          <ArrowUpRight size={20} />
        </button>
      </div>
      {a.cover_id && <PhotoUpdate animal={a} user={user} />}
      {a.cover_id && (
        <div className="card-download-row">
          <button
            className="card-download"
            onClick={() =>
              open({ type: "download", photoId: a.cover_id, animal: a })
            }
          >
            <Download size={15} />
            <span>Télécharger</span>
          </button>
          <span>
            {a.photo_count} photo{a.photo_count > 1 ? "s" : ""}
          </span>
        </div>
      )}
    </article>
  );
}
