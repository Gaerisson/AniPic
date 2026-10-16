import * as cheerio from "cheerio";
const text = (value, max = 150, allowBoolean = false) => {
  if (value && typeof value === "object")
    value = value.rendered ?? value.label ?? value.name;
  if (
    !["string", "number", "boolean"].includes(typeof value) ||
    (typeof value === "boolean" && !allowBoolean)
  )
    return "";
  return cheerio
    .load("<body>" + String(value) + "</body>")("body")
    .text()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
};
const first = (record, keys, max, allowBoolean = false) => {
  for (const key of keys) {
    const value = text(record?.[key], max, allowBoolean);
    if (value) return value;
  }
  return "";
};
function date(value) {
  const raw = text(value);
  let result = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!result) {
    const match = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) result = `${match[3]}-${match[2]}-${match[1]}`;
  }
  if (!result) return "";
  const parsed = new Date(result + "T12:00:00Z");
  return Number.isFinite(+parsed) &&
    parsed.toISOString().slice(0, 10) === result
    ? result
    : "";
}
export function publicAnimalMetadata(record = {}) {
  const value = {
    ageLabel: first(record, ["ageLabel", "age_number", "age_label"], 60),
    thumbnail: publicSpaImage(
      record.thumbnail || record.image || record.imageWebp,
    ),
    size: first(record, ["size", "taille", "animal_size"]),
    weight: first(record, ["weight", "poids"]),
    coatColor: first(record, [
      "coatColor",
      "coat_color",
      "couleur",
      "robe",
      "color",
    ]),
    arrivalDate: date(
      first(record, [
        "arrivalDate",
        "arrival_date",
        "date_arrivee",
        "date_entree",
        "admission_date",
      ]),
    ),
    reference: first(record, [
      "reference",
      "reference_spa",
      "numero_dossier",
      "dossier",
    ]),
    descriptionEntente: first(
      record,
      ["descriptionEntente", "description_entente"],
      2500,
    ),
    descriptionBase: first(
      record,
      ["descriptionBase", "description_base"],
      2500,
    ),
    specialNeeds: first(
      record,
      ["specialNeeds", "special_needs", "besoins_specifiques"],
      1500,
    ),
    adoptionConditions: first(
      record,
      ["adoptionConditions", "adoption_conditions", "conditions_adoption"],
      1500,
    ),
  };
  const sterile = first(
    record,
    ["sterilized", "sterilised", "sterilise", "sterilisation"],
    undefined,
    true,
  );
  if (sterile)
    value.sterilized = /^(true|1|oui)$/i.test(sterile)
      ? "Oui"
      : /^(false|0|non)$/i.test(sterile)
        ? "Non"
        : sterile.slice(0, 100);
  if (
    !value.weight &&
    typeof record.weightKg === "number" &&
    record.weightKg > 0 &&
    record.weightKg < 200
  )
    value.weight = record.weightKg + " kg";
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== ""));
}
export function publicSpaImage(value) {
  if (typeof value !== "string" || value.length > 1500) return "";
  try {
    const u = new URL(value);
    return u.origin === "https://www.la-spa.fr" &&
      !u.username &&
      !u.password &&
      /^\/(?:app\/)+uploads\/(animals|\d{4})\//.test(u.pathname) &&
      /\.(webp|jpe?g|png)$/i.test(u.pathname) &&
      !u.search
      ? u.href
      : "";
  } catch {
    return "";
  }
}
export function publicCompatibility(record = {}) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return {};
  return Object.fromEntries(
    Object.entries(record)
      .slice(0, 12)
      .map(([key, value]) => [
        text(key, 40),
        typeof value === "boolean" ? (value ? "Oui" : "Non") : text(value, 100),
      ])
      .filter(([k, v]) => k && v),
  );
}
export function compatibilityFromText(value) {
  const description = text(value, 15000);
  if (!/entente/i.test(description)) return {};
  const result = {};
  for (const match of description.matchAll(
    /\b(chat|chien|enfant)s?\s*:\s*([^;\n.]{1,180})/gi,
  )) {
    result[match[1].toLowerCase()] = match[2]
      .replace(/\*/g, "")
      .trim()
      .slice(0, 100)
      .replace(/^a tester$/i, "À tester");
  }
  return result;
}
