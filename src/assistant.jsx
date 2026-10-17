import { NavLink } from "./nav-link.jsx";
import { AssistantChat } from "./assistant-chat.jsx";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  MessageCircle,
  X,
  ArrowUpRight,
  Search,
  Sparkles,
  Send,
  PawPrint,
  Mic,
  CloudSun,
  Image,
  Wand2,
  ChevronRight,
  Github,
  SlidersHorizontal as SlidersIcon,
} from "lucide-react";
import { api, speciesName } from "./api.js";
import { FoxAvatar } from "./fox-avatar.jsx";
import { AssistantAnswer, AssistantThinking } from "./assistant-answer.jsx";
const aliases = {
  history: "historique changements api publique avant apres spa",
  displaySettings: "tele television ecran kiosk masquer diffusion affichage",
  gallery: "accueil galerie photos",
  animals: "chien chat animaux compagnon fiche",
  todo: "sans photo photographier priorite seance planning liste imprimer",
  inbox: "importer attribuer trier depot lightroom photoshop",
  editor: "editer retouche recadrer contraste photo",
  studio: "video voix narration montage film musique",
  motion: "fond anime motion design logo spa video story reseaux tv",
  wallpaper: "fond ecran wallpaper pc mosaique tirages logo",
  print: "feuille seance imprimable imprimer pdf photographier",
  messages: "message notification agents equipe annonce",
  migration: "gpic ancienne phototheque migration import archives",
  broadcasts: "c8 emissions regarder",
  collections: "albums prive dossiers evenement",
  archives: "archive ancien",
  stats: "statistique adoptions chiffres",
  api: "api connexion scrap canva ia mistral gemini",
  settings: "theme couleur configuration personnalisation",
  about: "a propos github gaerisson auteur",
  feed: "fil refuge nouveautes rss",
};
export const normalizeCommand = (value) =>
  value
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
export function QuickAssistant({
  pages,
  go,
  open: openModal,
  user,
  canEdit,
  hidden,
  overview,
  teamMessages = [],
  readMessage,
}) {
  const [opened, setOpened] = useState(false),
    [mode, setMode] = useState("search"),
    [query, setQuery] = useState(""),
    [animals, setAnimals] = useState([]),
    [status, setStatus] = useState(null),
    [provider, setProvider] = useState("gemini"),
    [answer, setAnswer] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [position, setPosition] = useState({ top: 80, right: 18, width: 350 });
  const field = useRef(),
    launcher = useRef(),
    panel = useRef();
  useEffect(() => {
    if (!opened || hidden) return;
    const place = () => {
      const r = launcher.current?.getBoundingClientRect();
      if (r) {
        const available = document.documentElement.clientWidth,
          width = Math.min(mode === "chat" ? 490 : 410, available - 32);
        setPosition({
          top: Math.max(16, Math.min(r.bottom + 12, innerHeight - 160)),
          right: Math.max(
            16,
            Math.min(available - r.right, available - width - 16),
          ),
          width,
        });
      }
    };
    place();
    const outside = (e) => {
      if (
        !panel.current?.contains(e.target) &&
        !launcher.current?.contains(e.target)
      )
        setOpened(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", place);
    };
  }, [opened, hidden, mode]);
  useEffect(() => {
    const key = (e) => {
      if (!hidden && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpened((v) => !v);
      }
      if (e.key === "Escape" && opened) {
        setOpened(false);
        launcher.current?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [hidden, opened]);
  useEffect(() => {
    if (opened && !hidden) {
      if (mode === "chat")
        panel.current?.querySelector(".chat-compose textarea")?.focus();
      else field.current?.focus();
    }
    if (opened && user)
      api("/team-ai/status")
        .then((s) => {
          setStatus(s);
          if (!s.gemini && s.tokenharbor) setProvider("tokenharbor");
        })
        .catch(() => {});
  }, [opened, hidden, user?.id, mode]);
  const q = normalizeCommand(query),
    words = q.split(/\s+/).filter((w) => w.length > 2),
    destinations = Object.entries(pages)
      .filter(
        ([key, p]) =>
          key !== "print" &&
          (p.group !== "admin" || user?.role === "admin") &&
          (key !== "inbox" || canEdit),
      )
      .map(([key, p]) => ({
        key,
        ...p,
        score: words.reduce(
          (n, w) =>
            n +
            Number(
              normalizeCommand(p.name + " " + (aliases[key] || "")).includes(w),
            ),
          0,
        ),
      }))
      .filter((p) =>
        query
          ? p.score > 0
          : ["editor", "todo", "studio", "inbox"].includes(p.key),
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  useEffect(() => {
    if (!opened || hidden || query.trim().length < 2) {
      setAnimals([]);
      return;
    }
    let alive = true;
    const clean = query
      .replace(
        /\b(ouvre|ouvrir|le|la|les|fiche|chien|chat|animal|de|du|voir|cherche|chercher|montre|moi|svp)\b/gi,
        " ",
      )
      .trim();
    if (clean.length < 2) {
      setAnimals([]);
      return;
    }
    const timer = setTimeout(
      () =>
        api("/animals?limit=5&q=" + encodeURIComponent(clean))
          .then((r) => {
            if (alive) setAnimals(r.items);
          })
          .catch(() => {}),
      220,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, opened, hidden]);
  function destination(key) {
    setOpened(false);
    go(key);
  }
  async function ask(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api("/assistant/answer", {
        method: "POST",
        body: { query, provider },
      });
      setAnswer(r.text);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (hidden) return null;
  return (
    <div className="quick-assistant">
      {createPortal(
        <section
          hidden={!opened}
          ref={panel}
          className={`assistant-panel ${mode === "chat" ? "assistant-chat-panel" : ""}`}
          style={{
            top: position.top,
            right: position.right,
            width: position.width,
            "--assistant-top": position.top + "px",
          }}
          role="dialog"
          aria-label="Assistant Anipic"
        >
          <header>
            <div className="assistant-identity">
              <FoxAvatar decorative src={overview?.assistantAvatarUrl} />
              <span>
                <strong>Assistant Anipic</strong>
                <small>Animaux, pages et outils</small>
              </span>
            </div>
            <button
              className="icon-button"
              aria-label="Fermer l’assistant"
              onClick={() => setOpened(false)}
            >
              <X size={18} />
            </button>
          </header>
          {user && (
            <div
              className="assistant-mode"
              role="tablist"
              aria-label="Mode de l’assistant"
            >
              <button
                role="tab"
                aria-selected={mode === "search"}
                onClick={() => setMode("search")}
              >
                Rechercher
              </button>
              <button
                role="tab"
                aria-selected={mode === "chat"}
                onClick={() => setMode("chat")}
              >
                Discuter avec l’IA
              </button>
            </div>
          )}
          {user && (
            <div className="assistant-chat-slot" hidden={mode !== "chat"}>
              <AssistantChat
                key={user.id}
                user={user}
                status={status}
                provider={provider}
                setProvider={setProvider}
                onNavigate={(key, id) => {
                  if (key === "animal") {
                    setOpened(false);
                    openModal({ type: "animal", id });
                  } else destination(key);
                }}
              />
            </div>
          )}
          <div className="assistant-search-slot" hidden={mode === "chat"}>
            <div className="assistant-search">
              <Search size={16} />
              <input
                ref={field}
                value={query}
                maxLength={1000}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setAnswer("");
                }}
                aria-label="Rechercher une page ou un animal"
                placeholder="Un animal, une page, un outil…"
              />
            </div>
            {user && teamMessages.length > 0 && (
              <details className="assistant-messages">
                <summary>
                  Messages de l’équipe{" "}
                  <span>
                    {teamMessages.filter((m) => !m.read_at).length} non lu(s)
                  </span>
                </summary>
                {teamMessages.slice(0, 8).map((m) => (
                  <article key={m.id} data-read={!!m.read_at}>
                    <strong>{m.title}</strong>
                    <p>{m.body}</p>
                    {m.read_at ? (
                      <small>Lu</small>
                    ) : (
                      <button type="button" onClick={() => readMessage(m.id)}>
                        Marquer comme lu
                      </button>
                    )}
                  </article>
                ))}
              </details>
            )}
            <div className="assistant-results">
              {animals.length > 0 && (
                <>
                  <small>Animaux</small>
                  {animals.map((a) => (
                    <NavLink
                      href={"#animal/" + a.id}
                      key={a.id}
                      onClick={() => {
                        setOpened(false);
                        openModal({ type: "animal", id: a.id });
                      }}
                    >
                      <PawPrint size={17} />
                      <span>
                        <strong>{a.name}</strong>
                        <small>
                          {speciesName[a.species]} ·{" "}
                          {a.source_id || a.id.slice(0, 8)}
                        </small>
                      </span>
                      <ArrowUpRight size={15} />
                    </NavLink>
                  ))}
                </>
              )}
              {destinations.length > 0 && (
                <>
                  <small>Accès rapide</small>
                  {destinations.map((p) => (
                    <NavLink
                      href={"#" + p.key}
                      key={p.key}
                      onClick={() => destination(p.key)}
                    >
                      <p.icon size={17} />
                      <span>{p.name}</span>
                      <ArrowUpRight size={15} />
                    </NavLink>
                  ))}
                </>
              )}
              {query && !animals.length && !destinations.length && (
                <p>Aucun résultat. Essayez le nom de l’animal ou de l’outil.</p>
              )}
            </div>
            {canEdit && (status?.gemini || status?.tokenharbor) && (
              <form className="assistant-ai" onSubmit={ask}>
                <div>
                  <Sparkles size={14} />
                  <select
                    aria-label="Service IA de l’assistant"
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                  >
                    {status.gemini && <option value="gemini">Gemini</option>}
                    {status.tokenharbor && (
                      <option value="tokenharbor">Token Harbor</option>
                    )}
                  </select>
                  <button
                    className="button secondary"
                    disabled={!query.trim() || busy}
                    type="submit"
                  >
                    <Send size={14} />
                    {busy ? "Réponse…" : "Demander à l’IA"}
                  </button>
                </div>
                <small>
                  Envoie votre question et les fiches publiques correspondantes
                  au service choisi.
                </small>
                {busy && <AssistantThinking />}
                {answer && <AssistantAnswer text={answer} />}
                {error && (
                  <p role="alert" className="error-text">
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
          <footer>
            <span>Ctrl / ⌘ K</span>
            <button onClick={() => destination("about")}>
              À propos · Gaerisson
            </button>
          </footer>
        </section>,
        document.body,
      )}
      <button
        className={`assistant-launcher ${opened ? "opened" : ""}`}
        ref={launcher}
        aria-label={opened ? "Masquer l’assistant" : "Ouvrir l’assistant"}
        aria-expanded={opened}
        onClick={() => setOpened((v) => !v)}
      >
        <FoxAvatar decorative src={overview?.assistantAvatarUrl} />
        <span>Assistant</span>
        {teamMessages.some((m) => !m.read_at) && (
          <i className="assistant-unread" aria-label="Messages non lus" />
        )}
        <kbd>
          {/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘ K" : "Ctrl K"}
        </kbd>
      </button>
      {user && (
        <button
          className="chat-launcher"
          aria-label="Discuter avec le chatbot"
          onClick={() => {
            setMode("chat");
            setOpened(true);
          }}
        >
          <FoxAvatar decorative src={overview?.assistantAvatarUrl} />
          <MessageCircle size={15} />
        </button>
      )}
    </div>
  );
}
export function About({ overview, go, user, voice }) {
  const services = [
    {
      icon: PawPrint,
      title: "Fiches SPA",
      text: "Identité, statut et informations du refuge.",
    },
    {
      icon: CloudSun,
      title: "Météo",
      text: "Prévisions Open-Meteo pour Morée.",
    },
    {
      icon: Image,
      title: "Photo & vidéo",
      text: "Retouche, studio Remotion et Canva.",
    },
    {
      icon: Sparkles,
      title: "IA à la demande",
      text: "Gemini, Token Harbor et voix Mistral.",
    },
  ];
  return (
    <div className="about-page">
      <div className="page-heading">
        <h1>À propos</h1>
        <span className="about-version">Version 3.4.0</span>
      </div>
      <section className="panel about-author">
        <FoxAvatar
          interactive
          src="/api/author/avatar"
          alt="Avatar GitHub de Gaerisson"
        />
        <div className="about-intro">
          <span className="about-byline">Un projet de Gaerisson</span>
          <h2>
            AniPic<span>.</span>
          </h2>
          <p>La photothèque et les outils de l’équipe du refuge.</p>
          {overview.authorGithubUrl && (
            <a
              className="button secondary"
              href={overview.authorGithubUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={17} /> GitHub · Gaerisson <ArrowUpRight size={15} />
            </a>
          )}
        </div>
      </section>
      <section className="panel about-services">
        <div className="about-section-heading">
          <h2>Les services d’Anipic</h2>
          <span>Selon votre configuration</span>
        </div>
        <div className="about-services-grid">
          {services.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <span className="about-service-icon">
                <Icon size={20} />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="about-actions">
        <div className="about-section-heading">
          <h2>Accès aux outils</h2>
        </div>
        <div className="about-ai-tools">
          <button onClick={voice}>
            <span className="about-tool-icon">
              <Mic size={22} />
            </span>
            <strong>Voix off</strong>
            <span>Préparer une narration pour une vidéo.</span>
            <em>
              Ouvrir le studio <ChevronRight size={15} />
            </em>
          </button>
          <button onClick={() => go("animals")}>
            <span className="about-tool-icon">
              <Wand2 size={22} />
            </span>
            <strong>Publications</strong>
            <span>Composer un visuel et un texte depuis une fiche.</span>
            <em>
              Choisir un animal <ChevronRight size={15} />
            </em>
          </button>
          <button onClick={() => go(user?.role === "admin" ? "api" : "editor")}>
            <span className="about-tool-icon">
              <SlidersIcon size={22} />
            </span>
            <strong>
              {user?.role === "admin" ? "Connecteurs" : "Éditeur photo"}
            </strong>
            <span>
              {user?.role === "admin"
                ? "Configurer les API et les modèles utilisés."
                : "Ouvrir et retoucher votre propre fichier."}
            </span>
            <em>
              {user?.role === "admin"
                ? "Configurer les API"
                : "Ouvrir l’éditeur"}{" "}
              <ChevronRight size={15} />
            </em>
          </button>
        </div>
      </section>
      <div className="about-credits">
        <span>
          Conception & photographie <strong>Gaerisson</strong>
        </span>
        <span>
          Développement assisté par <strong>OpenAI Codex</strong>
        </span>
      </div>
    </div>
  );
}
