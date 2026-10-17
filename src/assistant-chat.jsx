import { useState, useRef, useEffect } from "react";
import { Send, RotateCcw, Sparkles } from "lucide-react";
import { api, speciesName } from "./api.js";
import { AssistantAnswer, AssistantThinking } from "./assistant-answer.jsx";
import { NavLink } from "./nav-link.jsx";
export function AssistantChat({
  status,
  provider,
  setProvider,
  onNavigate,
  user,
}) {
  const [messages, setMessages] = useState([]),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const body = useRef(),
    sending = useRef(false);
  useEffect(() => {
    body.current?.scrollTo({
      top: body.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy, error]);
  async function send(e, value = query) {
    e?.preventDefault();
    if (!value.trim() || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    const history = messages
      .slice(-10)
      .map(({ role, content }) => ({ role, content: content.slice(0, 4000) }));
    const turn = { role: "user", content: value.trim() };
    setMessages((m) => [...m.slice(-38), turn]);
    setQuery("");
    try {
      const r = await api("/assistant/chat", {
        method: "POST",
        body: { query: turn.content, history, provider },
      });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: r.text,
          animals: r.animals,
          tools: r.tools,
        },
      ]);
    } catch (e) {
      setError(e.message);
      setQuery(turn.content);
      setMessages((m) => m.slice(0, -1));
    } finally {
      setBusy(false);
      sending.current = false;
    }
  }
  const configured = status?.gemini || status?.tokenharbor;
  return (
    <>
      <div className="chat-body" ref={body} aria-live="polite" aria-busy={busy}>
        {!messages.length && (
          <div className="chat-welcome">
            <Sparkles size={22} />
            <h3>Un coup de patte, {user?.name} ?</h3>
            <p>
              Parlons des animaux ou préparons votre prochaine création. Je
              garde le fil de cette conversation et je vous guide vers les
              outils.
            </p>
            <div className="chat-suggestions">
              {[
                "Comment créer une affiche de box ?",
                "Préparer une vidéo pour la TV",
                "Comment organiser ma séance photo ?",
              ].map((t) => (
                <button
                  key={t}
                  disabled={!configured || busy}
                  onClick={(e) => send(e, t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div className="chat-turn" data-role={m.role} key={i}>
            {m.role === "user" ? (
              m.content
            ) : (
              <>
                <AssistantAnswer text={m.content} />
                <div className="chat-links">
                  {m.animals?.map((a) => (
                    <NavLink
                      href={"#animal/" + a.id}
                      key={a.id}
                      onClick={() => onNavigate("animal", a.id)}
                    >
                      🐾 {a.name} · {speciesName[a.species]} · {a.sourceId}
                      {a.archived ? " · archivé" : ""} ↗
                    </NavLink>
                  ))}
                  {m.tools?.map((t) => (
                    <NavLink
                      href={"#" + t.id}
                      key={t.id}
                      onClick={() => onNavigate(t.id)}
                    >
                      {t.name} ↗
                    </NavLink>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
        {busy && <AssistantThinking />}
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        {status && !configured && (
          <p className="notice">
            Un administrateur doit configurer Gemini ou Token Harbor dans API &
            connexions pour activer le chat.
          </p>
        )}
      </div>
      <form className="chat-compose" onSubmit={send}>
        <textarea
          value={query}
          maxLength={2000}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              send(e);
            }
          }}
          placeholder="Votre question…"
          aria-label="Message au chatbot"
          disabled={!configured}
        />
        <div>
          <select
            aria-label="Modèle du chatbot"
            value={configured ? provider : ""}
            disabled={!configured}
            onChange={(e) => setProvider(e.target.value)}
          >
            {!configured && <option value="">IA à configurer</option>}
            {status?.gemini && <option value="gemini">Gemini</option>}
            {status?.tokenharbor && (
              <option value="tokenharbor">Token Harbor</option>
            )}
          </select>
          <button
            type="button"
            className="icon-button"
            aria-label="Nouvelle conversation"
            disabled={busy}
            onClick={() => {
              setMessages([]);
              setError("");
            }}
          >
            <RotateCcw size={17} />
          </button>
          <button
            className="button"
            disabled={!query.trim() || busy || !configured}
            type="submit"
          >
            <Send size={16} />
            Envoyer
          </button>
        </div>
        <small>
          Contexte : fiches publiques et outils. L’IA peut se tromper. Aucun
          changement automatique. Conversation gardée dans cette fenêtre,
          transmise au service choisi.
        </small>
      </form>
    </>
  );
}
