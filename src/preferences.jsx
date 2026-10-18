import { ContentDefaults, WidgetSettings } from "./content-settings.jsx";
import { SiteAccessSettings, GeoIPSettings } from "./site-access.jsx";
import { AudioSettings } from "./audio-settings.jsx";
import { useState, useEffect } from "react";
import { api } from "./api.js";
import { Button, Spinner } from "./ui.jsx";
import { Save, RefreshCw } from "lucide-react";
import { SourceSettings } from "./source-settings.jsx";
import { StatusSettings } from "./status-settings.jsx";
import { CanvaConnection } from "./canva.jsx";
import { AssistantAvatarSettings } from "./assistant-avatar-settings.jsx";
import { PhotoRulesSettings } from "./photo-rules-settings.jsx";
import {
  pageAccessDefaults,
  pageAccessLabels,
} from "../shared/page-access.mjs";
function useSettings(current, notify, reload) {
  const [values, setValues] = useState(current),
    [busy, setBusy] = useState(false);
  useEffect(() => setValues(current), [current]);
  const change = (k, v) =>
    setValues((p) => ({ ...p, ...(typeof k === "object" ? k : { [k]: v }) }));
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/admin/settings", { method: "PUT", body: values });
      notify("Réglages enregistrés.");
      reload();
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return { values, change, save, busy };
}
export function InterfaceSettings({
  current,
  notify,
  reload,
  avatarUrl,
  updateAssistantAvatar,
}) {
  const {
    values: v,
    change,
    save,
    busy,
  } = useSettings(current, notify, reload);
  const range = (key, label, min = 0, max = 100, step = 1, unit = "%") => (
    <label key={key}>
      {label} · {v[key]} {unit}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={v[key]}
        onChange={(e) => change(key, Number(e.target.value))}
      />
    </label>
  );
  return (
    <form className="preferences-form" onSubmit={save}>
      <ContentDefaults values={v} change={change} />
      <WidgetSettings values={v} change={change} />
      <SiteAccessSettings notify={notify} />
      <GeoIPSettings notify={notify} />
      <section className="panel page-access-settings">
        <h2>Accès aux pages</h2>
        <p className="fineprint">
          Choisissez les pages consultables sans connexion. Les comptes et les
          opérations d’administration restent privés.
        </p>
        {Object.entries(pageAccessLabels).map(([key, label]) => (
          <label key={key}>
            <span>{label}</span>
            <select
              value={v.pageAccess?.[key] || pageAccessDefaults[key]}
              onChange={(e) =>
                change("pageAccess", {
                  ...pageAccessDefaults,
                  ...v.pageAccess,
                  [key]: e.target.value,
                })
              }
            >
              <option value="team">Équipe connectée</option>
              <option value="public">Public · sans connexion</option>
            </select>
          </label>
        ))}
        <small>
          Un accès public à Vidéo C8 rend les émissions du dossier configuré
          accessibles à toute personne disposant du lien.
        </small>
      </section>
      <section className="panel settings-export">
        <div>
          <h2>Exporter les paramètres</h2>
          <p>
            Interface, connecteur SPA et programme TV · sans clés API, comptes
            ni photos.
          </p>
        </div>
        <a
          className="button secondary"
          href="/api/admin/settings/export"
          download="anipic-parametres.json"
        >
          Télécharger les paramètres JSON
        </a>
      </section>
      <AssistantAvatarSettings
        url={avatarUrl}
        onUpdate={updateAssistantAvatar}
        notify={notify}
      />
      <section className="panel interface-presets">
        <h2>Votre style</h2>
        <p className="fineprint">
          Choisissez une base puis ajustez-la. L’aperçu réagit immédiatement ;
          l’enregistrement applique vos choix au site.
        </p>
        <div className="preset-row">
          {[
            [
              "Épuré",
              {
                tiltIntensity: 15,
                reflectionIntensity: 8,
                glowIntensity: 40,
                photoRatio: "landscape",
                cardRadius: 12,
                gridGap: 16,
                compactUI: true,
                photoZoom: 2,
                parallaxIntensity: 10,
              },
            ],
            [
              "Photographe",
              {
                tiltIntensity: 30,
                reflectionIntensity: 15,
                glowIntensity: 65,
                photoRatio: "portrait",
                cardRadius: 18,
                gridGap: 24,
                compactUI: true,
                photoZoom: 3,
                parallaxIntensity: 25,
              },
            ],
            [
              "Sans mouvement",
              {
                tiltIntensity: 0,
                reflectionIntensity: 0,
                glowIntensity: 35,
                photoZoom: 0,
                parallaxIntensity: 0,
                hoverSlideshow: false,
              },
            ],
          ].map(([label, values]) => (
            <Button
              key={label}
              type="button"
              variant="secondary"
              onClick={() => change(values)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div
          className="preference-preview"
          style={{
            "--preview-glow": v.glowColor,
            "--preview-radius": `${v.cardRadius}px`,
            "--preview-halo": v.glowIntensity / 100,
          }}
        >
          <article
            className="preference-preview-card"
            onPointerMove={(e) => {
              if (
                e.pointerType !== "mouse" ||
                matchMedia("(prefers-reduced-motion: reduce)").matches
              )
                return;
              const r = e.currentTarget.getBoundingClientRect(),
                x = (e.clientX - r.left) / r.width - 0.5,
                y = (e.clientY - r.top) / r.height - 0.5;
              e.currentTarget.style.setProperty(
                "--preview-x",
                `${(-y * 24 * v.tiltIntensity) / 100}deg`,
              );
              e.currentTarget.style.setProperty(
                "--preview-y",
                `${(x * 30 * v.tiltIntensity) / 100}deg`,
              );
              e.currentTarget.style.setProperty(
                "--shine-x",
                `${(x + 0.5) * 100}%`,
              );
              e.currentTarget.style.setProperty(
                "--shine-y",
                `${(y + 0.5) * 100}%`,
              );
            }}
            onPointerLeave={(e) => {
              e.currentTarget.style.setProperty("--preview-x", "0deg");
              e.currentTarget.style.setProperty("--preview-y", "0deg");
            }}
          >
            <div
              className="preference-preview-photo"
              style={{
                aspectRatio:
                  v.photoRatio === "square"
                    ? "1"
                    : v.photoRatio === "portrait"
                      ? "4 / 5"
                      : "4 / 3",
              }}
            >
              <img
                src="/story/maya.jpg"
                alt="Photo de démonstration des effets"
              />
              <i style={{ opacity: v.reflectionIntensity / 100 }} />
              <span>Photo récente</span>
            </div>
            <div>
              <strong>Maya</strong>
              <small>
                {v.showCardFacts
                  ? "Chat · portrait de démonstration"
                  : "Aperçu"}
              </small>
            </div>
          </article>
          <p>
            Survolez la photo
            <br />
            <small>Relief, reflet et halo en direct</small>
          </p>
        </div>
      </section>
      <section className="panel">
        <h2>Apparence</h2>
        <div className="form-row">
          <label>
            Thème par défaut
            <select
              value={v.themeDefault}
              onChange={(e) => change("themeDefault", e.target.value)}
            >
              <option value="night">Studio nuit</option>
              <option value="amber">Ambre SPA</option>
              <option value="sage">Lumière</option>
              <option value="spa">SPA · clair & verre</option>
            </select>
          </label>
          <label>
            Accent
            <input
              type="color"
              value={v.accentColor}
              onChange={(e) => change("accentColor", e.target.value)}
            />
          </label>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={v.compactUI}
            onChange={(e) => change("compactUI", e.target.checked)}
          />
          Interface compacte
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={v.glassEnabled}
            onChange={(e) => change("glassEnabled", e.target.checked)}
          />
          Glassmorphism · verre dépoli
        </label>
        {v.glassEnabled && (
          <>
            {range("glassBlur", "Flou du verre", 0, 48, 1, "px")}
            {range("glassOpacity", "Opacité du verre", 35, 95, 1)}
            {range("glassSaturation", "Richesse du verre", 100, 180, 5)}
            <div className="glass-sample">
              <span
                style={{
                  backdropFilter: `blur(${v.glassBlur}px)`,
                  background: `color-mix(in srgb, var(--surface) ${v.glassOpacity}%, transparent)`,
                }}
              >
                Aperçu du verre
              </span>
            </div>
          </>
        )}
        <small>
          Option commune à tous les visiteurs, enregistrée côté serveur.
        </small>
      </section>
      <PhotoRulesSettings
        value={v.photoRules}
        onChange={(value) => change("photoRules", value)}
      />
      <section className="panel">
        <h2>Effets des photos</h2>
        {range("tiltIntensity", "Relief au survol")}
        {range("reflectionIntensity", "Intensité du reflet")}
        {range("glowIntensity", "Halo des photos récentes")}
        {range("parallaxIntensity", "Déplacement de la photo")}
        {range("photoZoom", "Agrandissement au survol", 0, 10, 1)}
        {range("motionSpeed", "Vitesse des transitions", 50, 150, 5)}
        <div className="form-row">
          <label>
            Couleur du halo
            <input
              type="color"
              value={v.glowColor}
              onChange={(e) => change("glowColor", e.target.value)}
            />
          </label>
          <label>
            Photo récente pendant (jours)
            <input
              type="number"
              min="1"
              max="30"
              value={v.recentDays}
              onChange={(e) => change("recentDays", +e.target.value)}
            />
          </label>
        </div>
        <p className="fineprint">
          0 désactive l’effet. Les réglages s’appliquent à tous les visiteurs ;
          la réduction des mouvements de leur appareil reste respectée.
        </p>
      </section>
      <section className="panel">
        <h2>Cartes et lecture</h2>
        <div className="form-row">
          <label>
            Format photo
            <select
              value={v.photoRatio}
              onChange={(e) => change("photoRatio", e.target.value)}
            >
              <option value="landscape">Paysage · 4:3</option>
              <option value="square">Carré · 1:1</option>
              <option value="portrait">Portrait · 4:5</option>
            </select>
          </label>
          <label>
            Colonnes sur grand écran
            <select
              value={v.gridColumns}
              onChange={(e) => change("gridColumns", +e.target.value)}
            >
              {[0, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n || "Automatique"}
                </option>
              ))}
            </select>
          </label>
        </div>
        {range("cardRadius", "Arrondi", 0, 32, 1, "px")}
        {range("gridGap", "Espace entre les cartes", 8, 36, 1, "px")}
        {range("fontScale", "Taille du texte", 90, 115, 5)}
        <div className="form-row">
          <label>
            Vue par défaut
            <select
              value={v.defaultView}
              onChange={(e) => change("defaultView", e.target.value)}
            >
              <option value="grid">Grille</option>
              <option value="list">Liste</option>
            </select>
          </label>
          <label>
            Tri par défaut
            <select
              value={v.defaultSort}
              onChange={(e) => change("defaultSort", e.target.value)}
            >
              <option value="recent">Dernières photos</option>
              <option value="name">Nom A → Z</option>
              <option value="photos">Nombre de photos</option>
              <option value="oldest">Photos anciennes</option>
            </select>
          </label>
        </div>
        {[
          ["showCardFacts", "Infos sur les cartes"],
          ["showPhotoCounts", "Compteur de photos"],
          ["hoverSlideshow", "Défilement des photos au survol"],
        ].map(([k, label]) => (
          <label className="checkbox-label" key={k}>
            <input
              type="checkbox"
              checked={v[k]}
              onChange={(e) => change(k, e.target.checked)}
            />
            {label}
          </label>
        ))}
        {range("hoverSeconds", "Une photo toutes les", 0.8, 5, 0.1, "s")}
      </section>
      <StatusSettings
        value={v.statusAppearance}
        change={(value) => change("statusAppearance", value)}
      />
      <section className="panel">
        <h2>Accueil</h2>
        {[
          ["showCarousel", "Carrousel"],
          ["showClock", "Horloge"],
          ["showWeather", "Météo"],
        ].map(([k, label]) => (
          <label className="checkbox-label" key={k}>
            <input
              type="checkbox"
              checked={v[k]}
              onChange={(e) => change(k, e.target.checked)}
            />
            {label}
          </label>
        ))}
        <label>
          Intervalle du carrousel (secondes)
          <input
            type="number"
            min="3"
            max="20"
            value={v.carouselSeconds}
            onChange={(e) => change("carouselSeconds", Number(e.target.value))}
          />
        </label>
        <label>
          Animaux par page
          <select
            value={v.cardsPerPage}
            onChange={(e) => change("cardsPerPage", Number(e.target.value))}
          >
            {[12, 24, 48, 96, 200].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </section>
      <section className="panel">
        <h2>Identité et stockage</h2>
        <label>
          Nom du refuge
          <input
            value={v.refugeName}
            maxLength="100"
            required
            onChange={(e) => change("refugeName", e.target.value)}
          />
        </label>
        <div className="form-row">
          {[
            ["cacheMB", "Cache Mo", 16, 16384],
            ["thumbQuality", "Qualité WebP", 40, 90],
            ["backupIntervalHours", "Sauvegarde toutes les (h)", 0, 168],
            ["backupKeep", "Copies conservées", 1, 30],
          ].map(([k, label, min, max]) => (
            <label key={k}>
              {label}
              <input
                type="number"
                min={min}
                max={max}
                value={v[k]}
                onChange={(e) => change(k, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
      </section>
      <div className="preferences-save">
        <Button icon={Save} disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer l’interface"}
        </Button>
      </div>
    </form>
  );
}
export function ApiSettings({ current, notify, reload }) {
  const {
      values: v,
      change,
      save,
      busy,
    } = useSettings(current, notify, reload),
    [status, setStatus] = useState(null),
    [error, setError] = useState("");
  const refresh = () =>
    api("/admin/connections")
      .then((s) => {
        setStatus(s);
        setError("");
      })
      .catch((e) => setError(e.message));
  useEffect(() => {
    refresh();
  }, [current]);
  return (
    <form className="preferences-form" onSubmit={save}>
      <SourceSettings values={v} change={change} notify={notify} />
      <CanvaConnection setup notify={notify} />
      <AudioSettings notify={notify} />
      <section className="panel">
        <h2>Rédaction IA</h2>
        {status ? (
          <>
            <div className="connection-status">
              Gemini{" "}
              <strong>
                {status.gemini.configured ? "Clé présente" : "Clé absente"}
              </strong>
            </div>
            <label>
              Modèle Gemini
              <input
                value={v.geminiModel}
                placeholder={status.gemini.model}
                maxLength="100"
                onChange={(e) => change("geminiModel", e.target.value)}
              />
            </label>
            <div className="connection-status">
              Token Harbor{" "}
              <strong>
                {status.tokenharbor.configured ? "Clé présente" : "Clé absente"}
              </strong>
            </div>
            <label>
              Modèle Token Harbor
              <input
                value={v.tokenharborModel}
                placeholder={
                  status.tokenharbor.model || "Identifiant du modèle"
                }
                maxLength="150"
                onChange={(e) => change("tokenharborModel", e.target.value)}
              />
            </label>
            <p className="fineprint">
              Endpoint : https://tokenharbor.ai/v1. Les clés restent dans
              GEMINI_API_KEY / TOKENHARBOR_API_KEY côté serveur. Elles ne sont
              jamais renvoyées à l’interface.
            </p>
          </>
        ) : (
          <Spinner />
        )}
        <Button
          type="button"
          variant="secondary"
          icon={RefreshCw}
          onClick={refresh}
        >
          Actualiser l’état des connexions
        </Button>
        {error && <p className="error-text">{error}</p>}
        <p className="fineprint">
          Cette vérification lit la configuration locale ; aucun appel IA
          facturé n’est lancé.
        </p>
      </section>
      <section className="panel">
        <h2>Flux et API Anipic</h2>
        {status?.endpoints.map((x) => (
          <div className="api-endpoint" key={x.path}>
            <a href={x.path} target="_blank" rel="noreferrer">
              <code>{x.path}</code>
            </a>
            <small>{x.access}</small>
          </div>
        ))}
        <p className="fineprint">
          Les modifications exigent un compte et un jeton CSRF. Originaux,
          albums privés et émissions sont protégés.
        </p>
      </section>
      <section className="panel">
        <h2>Stockage C8</h2>
        <p>
          {status?.broadcasts.configured
            ? "Dossier configuré au serveur."
            : "Dossier à raccorder."}
        </p>
        <p className="fineprint">
          BROADCAST_DIR dans l’environnement ; compose.c8.yml pour monter le NAS
          en lecture seule.
        </p>
      </section>
      <div className="preferences-save">
        <Button icon={Save} disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer les connexions"}
        </Button>
      </div>
    </form>
  );
}
