// Event kind takes precedence: an arrival with an adopted source status is still an arrival.
export function refugeEvent(event) {
  if (event.adoption_origin?.kind === "automatic_reversed")
    return {
      type: "returned",
      label: "Adoption automatique corrigée",
      symbol: "return",
    };
  if (["restored", "returned"].includes(event.kind))
    return { type: "returned", label: "De retour", symbol: "return" };
  if (event.kind === "added")
    return { type: "arrival", label: "Nouvel arrivant", symbol: "plus" };
  if (event.status === "adopted" || event.kind === "adopted") {
    const automatic = event.adoption_origin?.kind === "automatic_absence";
    return {
      type: automatic ? "pending" : "adoption",
      label: automatic
        ? "Adoption automatique · à confirmer"
        : "Adoption confirmée",
      symbol: "heart",
    };
  }
  if (["removed", "archived"].includes(event.kind))
    return {
      type: "departure",
      label:
        event.status === "source_missing"
          ? "Départ · motif à confirmer"
          : "Départ / archivage",
      symbol: "minus",
    };
  return { type: "update", label: "Nouvelle du refuge", symbol: "update" };
}
