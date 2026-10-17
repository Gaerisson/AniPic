import { ArrowUp, ArrowDown } from "lucide-react";
import { textDefaults, seasonDefaults } from "../shared/content-defaults.mjs";
export const widgetNames = {
  photos: "Derniers portraits · carrousel",
  clockWeather: "Heure et météo",
  stats: "Chiffres de la photothèque",
  tv: "Programme TV en direct",
  priorities: "Priorités photo de l’équipe",
  activity: "Dernières nouvelles du refuge",
  agenda: "Agenda partagé · dates importantes",
};
export function WidgetSettings({ values: v, change }) {
  const list = v.homeWidgets || ["photos", "clockWeather"];
  return (
    <section className="panel widget-settings">
      <h2>Modules de l’accueil</h2>
      <p className="fineprint">
        Activez les modules et définissez leur ordre. Les priorités de l’équipe
        restent réservées aux comptes connectés.
      </p>
      {Object.entries(widgetNames).map(([key, label]) => (
        <div key={key}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={list.includes(key)}
              onChange={(e) =>
                change(
                  "homeWidgets",
                  e.target.checked
                    ? [...list, key]
                    : list.filter((x) => x !== key),
                )
              }
            />
            {label}
          </label>
          {list.includes(key) && (
            <span>
              {[
                [-1, ArrowUp, "Monter"],
                [1, ArrowDown, "Descendre"],
              ].map(([direction, Icon, text]) => (
                <button
                  type="button"
                  key={text}
                  aria-label={`${text} ${label}`}
                  disabled={
                    list.indexOf(key) + direction < 0 ||
                    list.indexOf(key) + direction >= list.length
                  }
                  onClick={() => {
                    const n = [...list],
                      i = n.indexOf(key);
                    [n[i], n[i + direction]] = [n[i + direction], n[i]];
                    change("homeWidgets", n);
                  }}
                >
                  <Icon size={14} />
                </button>
              ))}
            </span>
          )}
        </div>
      ))}
    </section>
  );
}
export function ContentDefaults({ values: v, change }) {
  const texts = { ...textDefaults, ...v.textDefaults },
    messages = { ...seasonDefaults, ...v.seasonMessages };
  return (
    <section className="panel content-defaults">
      <h2>Textes par défaut</h2>
      <p className="fineprint">
        Utilisés pour les nouvelles créations. Les projets déjà enregistrés
        gardent leurs textes.
      </p>
      <div className="form-two">
        {Object.entries({
          title: "Titre vidéo",
          subtitle: "Sous-titre vidéo",
          conclusion: "Conclusion vidéo",
          signature: "Signature",
          invitation: "Invitation finale",
          posterTitle: "Titre des affiches de box",
          posterFooter: "Pied des affiches",
          hours: "Horaires du refuge",
          spaInfo: "Informations SPA",
        }).map(([key, label]) => (
          <label key={key}>
            {label}
            <textarea
              rows={2}
              maxLength={500}
              value={texts[key]}
              onChange={(e) =>
                change("textDefaults", { ...texts, [key]: e.target.value })
              }
            />
          </label>
        ))}
      </div>
      <details>
        <summary>Messages saisonniers automatiques</summary>
        {Object.entries({
          classic: "Général",
          halloween: "Halloween",
          christmas: "Noël",
          easter: "Pâques",
          summer: "Été",
        }).map(([key, label]) => (
          <div className="season-default" key={key}>
            <h3>{label}</h3>
            <label>
              Titre
              <input
                maxLength={100}
                value={messages[key].title}
                onChange={(e) =>
                  change("seasonMessages", {
                    ...messages,
                    [key]: { ...messages[key], title: e.target.value },
                  })
                }
              />
            </label>
            <label>
              Message
              <textarea
                rows={2}
                maxLength={350}
                value={messages[key].body}
                onChange={(e) =>
                  change("seasonMessages", {
                    ...messages,
                    [key]: { ...messages[key], body: e.target.value },
                  })
                }
              />
            </label>
          </div>
        ))}
      </details>
    </section>
  );
}
