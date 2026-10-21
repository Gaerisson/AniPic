export function mobileAppLayout({
  search = "",
  standalone = false,
  remembered = false,
} = {}) {
  const requested = new URLSearchParams(search).get("app");
  if (requested === "web") return false;
  return requested === "android" || standalone || remembered;
}
export const mobileDestinations = Object.freeze([
  { page: "mobile", name: "Mon refuge", symbol: "home" },
  { page: "feed", name: "Le fil", symbol: "feed" },
  { page: "volunteers", name: "Planning", symbol: "planning" },
  { page: "mobilePhotos", name: "Photos", symbol: "photos" },
  { page: "broadcasts", name: "C8", symbol: "tv" },
]);
