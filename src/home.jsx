import { HomeWidgets } from "./home-widgets.jsx";
import { useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Sun,
  Cloud,
  CloudRain,
  Wind,
  Clock,
  Camera,
  ArrowUpRight,
  Moon,
  Droplets,
  RefreshCw,
} from "lucide-react";
import { api, imageUrl } from "./api.js";
import { upcomingPhotoWindow } from "../shared/photo-weather.mjs";
export function Weather({ compact = false }) {
  const [weather, setWeather] = useState(null),
    [error, setError] = useState("");
  const load = () =>
    api("/weather")
      .then((data) => {
        setWeather(data);
        setError("");
      })
      .catch(() => setError("Prévision temporairement indisponible."));
  useEffect(() => {
    load();
  }, []);
  const current = weather?.current,
    code = current?.weather_code || 0,
    Icon =
      current?.is_day === 0
        ? Moon
        : code < 3
          ? Sun
          : code >= 51
            ? CloudRain
            : Cloud;
  const window = weather
    ? upcomingPhotoWindow(
        weather.hourly,
        new Intl.DateTimeFormat("sv-SE", {
          timeZone: "Europe/Paris",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
          .format(new Date())
          .replace(" ", "T"),
      )
    : null;
  return (
    <section
      className={`weather-widget meteo-card ${compact ? "compact" : ""}`}
    >
      <div className="meteo-heading">
        <span>Morée</span>
        <small>Météo</small>
      </div>
      {weather ? (
        <>
          <div className="meteo-current">
            <span
              className={`meteo-orb ${current.is_day === 0 ? "night" : ""}`}
            >
              <Icon size={42} strokeWidth={1.4} />
            </span>
            <div>
              <strong>
                {Math.round(current.temperature_2m)}
                <sup>°</sup>
              </strong>
              <span>
                {current.is_day === 0
                  ? "Nuit"
                  : code === 0
                    ? "Ciel dégagé"
                    : code < 3
                      ? "Éclaircies"
                      : code < 49
                        ? "Ciel couvert"
                        : "Précipitations"}
              </span>
            </div>
            <span className="meteo-wind">
              <Wind size={15} />
              {Math.round(current.wind_speed_10m)} km/h
            </span>
          </div>
          <div className="meteo-forecast">
            {weather.days.slice(0, compact ? 3 : 7).map((day, i) => {
              const DayIcon =
                day.rainProbability >= 40
                  ? CloudRain
                  : day.code < 3
                    ? Sun
                    : Cloud;
              return (
                <div key={day.date}>
                  <span>
                    {i === 0
                      ? "Aujourd’hui"
                      : new Date(day.date + "T12:00:00").toLocaleDateString(
                          "fr-FR",
                          { weekday: "short" },
                        )}
                  </span>
                  <DayIcon size={20} />
                  <strong>
                    {Math.round(day.max)}° <small>{Math.round(day.min)}°</small>
                  </strong>
                  <em>
                    <Droplets size={10} />
                    {day.rainProbability}%
                  </em>
                </div>
              );
            })}
          </div>
          <div className={`meteo-slot ${window ? "suitable" : ""}`}>
            <Camera size={16} />
            <span>
              {weather.stale
                ? "Prévisions à actualiser"
                : window
                  ? `Photos en extérieur · ${new Date(window.date + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "short" })} ${window.start}–${window.end}`
                  : "Pas de créneau extérieur conseillé"}
            </span>
          </div>
          <div className="meteo-source">
            <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
              Open-Meteo
            </a>
            <span>
              {weather.stale
                ? "Hors ligne"
                : new Date(weather.updatedAt).toLocaleTimeString("fr-FR", {
                    timeZone: "Europe/Paris",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
            </span>
          </div>
          {!compact && (
            <small className="weather-note">
              Créneau indicatif : journée, 5–30 °C, pluie peu probable, vent
              inférieur à 30 km/h.
            </small>
          )}
        </>
      ) : (
        <div className="meteo-loading">
          <Cloud size={28} />
          <span>{error || "Chargement…"}</span>
          {error && (
            <button onClick={load} aria-label="Actualiser la météo">
              <RefreshCw size={16} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
function ClockFace({ clock }) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(clock),
    n = (key) => Number(parts.find((p) => p.type === key)?.value || 0),
    h = n("hour"),
    m = n("minute"),
    sec = n("second");
  return (
    <div className="clock-widget clock-card">
      <div>
        <span className="clock-city">
          Morée <i /> Heure locale
        </span>
        <div className="clock-digital">
          {String(h).padStart(2, "0")}
          <b>:</b>
          {String(m).padStart(2, "0")}
          <small>{String(sec).padStart(2, "0")}</small>
        </div>
        <span className="clock-date">
          {clock.toLocaleDateString("fr-FR", {
            timeZone: "Europe/Paris",
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </span>
      </div>
      <svg className="clock-face" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="46" />
        {Array.from({ length: 12 }, (_, i) => (
          <line
            key={i}
            x1="50"
            y1="9"
            x2="50"
            y2={i % 3 === 0 ? "16" : "12"}
            transform={`rotate(${i * 30} 50 50)`}
          />
        ))}
        <line
          className="clock-hand"
          x1="50"
          y1="50"
          x2="50"
          y2="29"
          transform={`rotate(${h * 30 + m * 0.5} 50 50)`}
        />
        <line
          className="clock-hand minute"
          x1="50"
          y1="50"
          x2="50"
          y2="20"
          transform={`rotate(${m * 6 + sec * 0.1} 50 50)`}
        />
        <line
          className="clock-second"
          x1="50"
          y1="58"
          x2="50"
          y2="17"
          transform={`rotate(${sec * 6} 50 50)`}
        />
        <circle cx="50" cy="50" r="3" className="clock-pin" />
      </svg>
    </div>
  );
}
export function Home({
  animals = [],
  open,
  animations = true,
  ui = {},
  user,
  overview,
}) {
  // Three real faces rotate around one axis, as in the requested reference.
  const candidates = animals.filter((a) => a.cover_id).slice(0, 3);
  const [active, setActive] = useState(0),
    [paused, setPaused] = useState(false),
    [hovered, setHovered] = useState(false),
    [focused, setFocused] = useState(false),
    [stepped, setStepped] = useState(false),
    [clock, setClock] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setActive(0);
  }, [candidates.map((a) => a.id).join("|")]);
  useEffect(() => {
    if (!animations || paused || hovered || focused || candidates.length < 2)
      return;
    const timer = setInterval(
      () => setActive((i) => i + 1),
      (ui.carouselSeconds || 6) * 1000,
    );
    return () => clearInterval(timer);
  }, [
    paused,
    hovered,
    focused,
    animations,
    candidates.length,
    ui.carouselSeconds,
  ]);
  const widgets = ui.homeWidgets || ["photos", "clockWeather"];
  const move = (direction) => setActive((index) => index + direction);
  const count = candidates.length;
  const current = ((active % Math.max(1, count)) + count) % Math.max(1, count);
  return (
    <div className="home-experience home-widgets-grid">
      {widgets.includes("photos") && ui.showCarousel !== false && (
        <section
          className="photo-carousel prism-carousel"
          style={{
            order: widgets.indexOf("photos"),
            gridColumn: widgets.includes("clockWeather") ? "span 8" : "1 / -1",
          }}
          aria-label="Les regards du refuge"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setFocused(true)}
          onBlur={(e) =>
            !e.currentTarget.contains(e.relatedTarget) && setFocused(false)
          }
        >
          <div className="carousel-caption">
            <span>
              <i className="live-spark" /> LES REGARDS DU REFUGE
            </span>
            <h2>
              Derniers
              <br />
              <i>portraits</i>
            </h2>
          </div>
          <div
            className="prism-stage"
            style={{ "--faces": Math.max(1, count) }}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                move(-1);
              }
              if (e.key === "ArrowRight") {
                e.preventDefault();
                move(1);
              }
            }}
          >
            {candidates.length ? (
              <div
                className={`prism-rotor ${stepped ? "stepped" : ""} ${count === 1 ? "single" : ""}`}
                style={{ "--rotation": `${-active * (360 / count)}deg` }}
              >
                {candidates.map((animal, index) => {
                  return (
                    <button
                      key={animal.id}
                      className={`prism-face ${index === current ? "current" : ""}`}
                      style={{ "--face-angle": `${index * (360 / count)}deg` }}
                      tabIndex={index === current ? 0 : -1}
                      aria-hidden={index !== current}
                      onClick={() => open({ type: "animal", id: animal.id })}
                      aria-label={"Ouvrir l’album de " + animal.name}
                    >
                      <HoverPhoto
                        animal={animal}
                        animations={animations && ui.hoverSlideshow !== false}
                        intervalSeconds={ui.hoverSeconds}
                        loading="eager"
                      />
                      <span className="prism-photo-caption">
                        <strong>{animal.name}</strong>
                        <small>
                          {animal.photo_count} photo
                          {animal.photo_count > 1 ? "s" : ""}
                          <ArrowUpRight size={15} />
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="carousel-empty">
                Le premier regard arrive bientôt.
                <br />
                Ajoutez vos photos pour faire vivre cet espace.
              </div>
            )}
          </div>
          {candidates.length > 1 && (
            <div className="carousel-controls">
              <button aria-label="Animal précédent" onClick={() => move(-1)}>
                <ChevronLeft size={18} />
              </button>
              <span>
                {current + 1} / {count}
              </span>
              <button aria-label="Animal suivant" onClick={() => move(1)}>
                <ChevronRight size={18} />
              </button>
              <button
                aria-label={
                  paused
                    ? "Reprendre le carrousel"
                    : "Mettre le carrousel en pause"
                }
                aria-pressed={paused}
                onClick={() => setPaused(!paused)}
              >
                {paused ? <Play size={15} /> : <Pause size={15} />}
              </button>
              <label className="carousel-step-toggle">
                <input
                  type="checkbox"
                  checked={stepped}
                  onChange={(e) => setStepped(e.target.checked)}
                />
                Par étapes
              </label>
            </div>
          )}
        </section>
      )}
      {widgets.includes("clockWeather") && (
        <aside
          className="home-aside"
          style={{
            order: widgets.indexOf("clockWeather"),
            gridColumn: widgets.includes("photos") ? "span 4" : "1 / -1",
          }}
        >
          {ui.showClock !== false && <ClockFace clock={clock} />}
          {ui.showWeather !== false && <Weather compact />}
        </aside>
      )}
      <HomeWidgets
        widgets={widgets}
        user={user}
        overview={overview}
        open={open}
      />
    </div>
  );
}
export function HoverPhoto({
  animal,
  className = "",
  loading = "lazy",
  animations = true,
  intervalSeconds = 1.8,
  controls = false,
  onOpen,
}) {
  const [hover, setHover] = useState(false),
    [index, setIndex] = useState(0);
  const ids = [...new Set([animal.cover_id, ...(animal.preview_ids || [])])]
    .filter(Boolean)
    .slice(0, 6);
  useEffect(() => {
    if (!hover || !animations || ids.length < 2) return;
    const timer = setInterval(
      () => setIndex((i) => (i + 1) % ids.length),
      Math.max(0.8, intervalSeconds || 1.8) * 1000,
    );
    return () => clearInterval(timer);
  }, [hover, animations, intervalSeconds, ids.join("|")]);
  useEffect(() => setIndex(0), [animal.id, animal.cover_id]);
  const picture = (
    <img
      key={ids[index] || ids[0]}
      src={imageUrl(ids[index] || ids[0], 640)}
      srcSet={`${imageUrl(ids[index] || ids[0], 320)} 320w, ${imageUrl(ids[index] || ids[0], 640)} 640w`}
      sizes="(max-width: 580px) 44vw, (max-width: 1050px) 35vw, 28vw"
      alt={`Portrait de ${animal.name} · ${index + 1}/${ids.length}`}
      loading={loading}
    />
  );
  const move = (direction) => {
    setHover(false);
    setIndex((i) => (i + direction + ids.length) % ids.length);
  };
  return (
    <span
      className={"hover-photo " + className}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setHover(true);
      }}
      onPointerLeave={() => setHover(false)}
    >
      {onOpen ? (
        <button
          className="photo-link"
          aria-label={`Voir l’album de ${animal.name}`}
          onClick={onOpen}
        >
          {picture}
        </button>
      ) : (
        picture
      )}
      {ids.length > 1 && (
        <span className="hover-dots" aria-hidden="true">
          {ids.map((id, i) => (
            <i key={id} className={i === index ? "active" : ""} />
          ))}
        </span>
      )}
      {controls && ids.length > 1 && (
        <span
          className="card-photo-navigation"
          aria-label={`Photos de ${animal.name}`}
        >
          <button
            type="button"
            aria-label={`Photo précédente de ${animal.name}`}
            onClick={() => move(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <span aria-live="polite">
            {index + 1}/{ids.length}
          </span>
          <button
            type="button"
            aria-label={`Photo suivante de ${animal.name}`}
            onClick={() => move(1)}
          >
            <ChevronRight size={18} />
          </button>
        </span>
      )}
    </span>
  );
}
