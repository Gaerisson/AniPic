import { NavLink } from "./nav-link.jsx";
import { useState } from "react";
import { Camera, Download, ClipboardList } from "lucide-react";
import { api, speciesName } from "./api.js";
import { Button } from "./ui.jsx";
const csvCell = (v) => {
  let s = String(v ?? "");
  if (/^[=+@\-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
};
export function TeamUtilities({ go }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const download = (text, name, type) => {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const missing = async () => {
    setBusy(true);
    setError("");
    try {
      let all = [];
      for (let p = 1; p <= 50; p++) {
        const d = await api(
          "/animals?missing=1&sort=photo_priority&limit=60&page=" + p,
        );
        all.push(...d.items);
        if (p >= d.pages) break;
      }
      download(
        "\uFEFF" +
          [
            ["ID SPA", "Nom", "Espèce", "Sexe", "Lien SPA"],
            ...all.map((a) => [
              a.source_id,
              a.name,
              speciesName[a.species],
              a.sex,
              a.source_url,
            ]),
          ]
            .map((r) => r.map(csvCell).join(";"))
            .join("\r\n"),
        "animaux-sans-photos.csv",
        "text/csv;charset=utf-8",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <nav className="team-shortcuts" aria-label="Les outils de l’équipe">
        {[
          [
            "volunteers",
            "Présences & missions",
            "Qui sera là, pour quelle tâche et quel créneau.",
          ],
          [
            "writing",
            "Rédaction & relecture",
            "Préparer une belle présentation et comparer les corrections.",
          ],
          [
            "posters",
            "Affiches & créations",
            "Fiches de box, grands posters et bannières.",
          ],
        ].map(([p, title, text]) => (
          <NavLink href={"#" + p} onClick={() => go(p)} key={p}>
            <strong>{title} ↗</strong>
            <small>{text}</small>
          </NavLink>
        ))}
      </nav>
      <div className="utility-grid">
        <section className="panel form-stack">
          <h2>
            <Camera size={20} /> À photographier
          </h2>
          <p>
            Animaux actifs sans photo locale, y compris lorsqu’ils ont déjà un
            portrait sur le site SPA.
          </p>
          <Button onClick={() => go("todo")} icon={ClipboardList}>
            Ouvrir le planning photo
          </Button>
          <Button
            variant="secondary"
            onClick={missing}
            disabled={busy}
            icon={Download}
          >
            {busy ? "Préparation…" : "Exporter la liste CSV"}
          </Button>
          {error && <p className="error-text">{error}</p>}
        </section>
      </div>
    </>
  );
}
