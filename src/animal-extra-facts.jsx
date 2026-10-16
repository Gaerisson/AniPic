import { date } from "./api.js";
export function AnimalExtraFacts({ animal }) {
  const facts = animal.source_metadata || {};
  const entries = [
    ["weight", "Poids indiqué"],
    ["coatColor", "Robe / couleur"],
    ["sterilized", "Stérilisation"],
    ["reference", "Référence SPA"],
  ].filter(([key]) => facts[key]);
  const arrival = facts.arrivalDate
    ? new Date(facts.arrivalDate + "T12:00:00")
    : null;
  const current = new Date();
  const days = arrival
    ? Math.round(
        (Date.UTC(
          current.getFullYear(),
          current.getMonth(),
          current.getDate(),
        ) -
          Date.UTC(
            arrival.getFullYear(),
            arrival.getMonth(),
            arrival.getDate(),
          )) /
          86400000,
      )
    : null;
  if (
    !entries.length &&
    !arrival &&
    !facts.specialNeeds &&
    !facts.adoptionConditions
  )
    return null;
  return (
    <section className="animal-extra-facts">
      <h3>Informations SPA</h3>
      {arrival && (
        <div className="animal-arrival">
          <span>Arrivée indiquée par la SPA</span>
          <strong>
            {date(facts.arrivalDate)}
            {days >= 0 ? ` · ${days} jour${days > 1 ? "s" : ""}` : ""}
          </strong>
        </div>
      )}
      {entries.length > 0 && (
        <dl>
          {entries.map(([key, label]) => (
            <div key={key}>
              <dt>{label}</dt>
              <dd>{facts[key]}</dd>
            </div>
          ))}
        </dl>
      )}
      {facts.specialNeeds && (
        <div>
          <h4>Besoins spécifiques</h4>
          <p>{facts.specialNeeds}</p>
        </div>
      )}
      {facts.adoptionConditions && (
        <div>
          <h4>Conditions d’adoption</h4>
          <p>{facts.adoptionConditions}</p>
        </div>
      )}
      <small>
        Informations de la source SPA ·{" "}
        {animal.source_seen_at
          ? "observées le " + date(animal.source_seen_at)
          : "date d’observation non renseignée"}
      </small>
    </section>
  );
}
