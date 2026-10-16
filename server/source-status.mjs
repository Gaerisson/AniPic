const flag = (value) =>
  value === true ||
  value === 1 ||
  ["1", "true", "oui"].includes(String(value).toLowerCase());
export function sourceStatus(record) {
  const raw = record.statut ?? record.adoption_status ?? record.status ?? "";
  const label = String(raw)
    .replace(/<[^>]*>/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  const name = String(
    record.name || record.post_title?.rendered || record.post_title || "",
  )
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const reservedInTitle =
    (!label || ["publish", "published"].includes(label)) &&
    /(?:^|[\s_])[(\[]\s*reservee?\s*[)\]]/.test(name);
  if (["adopted", "adopte", "adoptee"].includes(label) || flag(record.adopted))
    return "adopted";
  if (
    ["reserved", "reserve", "reservee"].includes(label) ||
    flag(record.reserved) ||
    flag(record.is_reserved) ||
    reservedInTitle
  )
    return "reserved";
  if (
    label &&
    ![
      "available",
      "disponible",
      "a adopter",
      "au refuge",
      "publish",
      "published",
    ].includes(label)
  )
    throw new Error(
      "Statut animal source inconnu. Vérifier le flux avant import.",
    );
  // Historical exports list animals offered for adoption. Absence is handled
  // separately and must never be converted to an adoption here.
  return "available";
}
