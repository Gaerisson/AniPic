export function hasAnimalInfo(value) {
  const raw = String(value ?? "").trim();
  return (
    !!raw &&
    !/^(?:n\s*[/.]?\s*a|non renseign[ée]e?|non communiqu[ée]e?|inconnu[e]?|unknown|null|undefined|à préciser|a preciser|[-–—?.]+)$/i.test(
      raw,
    )
  );
}
