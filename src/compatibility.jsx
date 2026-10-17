import { CheckCircle2, XCircle, HelpCircle, AlertTriangle } from "lucide-react";
import { CompatibilityIcon } from "../shared/compatibility-icons.mjs";
import { compatibilityLabels } from "../video/facts.mjs";
import {
  normalizeCompatibility,
  compatibilityState,
} from "../shared/compatibility-text.mjs";

export function AnimalCompatibility({ values }) {
  return (
    <section
      className="compatibility animal-ententes"
      aria-label="Ententes de l’animal"
    >
      <h3>Ses ententes</h3>
      <dl className="entente-grid">
        {Object.entries(normalizeCompatibility(values)).map(([key, value]) => {
          const { subject, label } = compatibilityLabels({ [key]: value })[0];
          const raw = String(value ?? "").trim();
          const state = compatibilityState(raw),
            yes = state === "yes",
            no = state === "no";
          const display =
            yes || no
              ? label
              : raw
                ? raw[0].toLocaleUpperCase("fr") + raw.slice(1)
                : "À préciser";
          const Status = yes
            ? CheckCircle2
            : no
              ? XCircle
              : state === "conditional"
                ? AlertTriangle
                : HelpCircle;
          return (
            <div
              key={key}
              className={`entente-card ${display.length > 35 ? "entente-wide" : ""}`}
              data-state={state}
            >
              <span className="entente-picto">
                <CompatibilityIcon subject={subject} size={26} />
              </span>
              <dt>{subject}</dt>
              <dd>{display}</dd>
              <Status className="entente-state" size={15} aria-hidden="true" />
            </div>
          );
        })}
      </dl>
    </section>
  );
}
