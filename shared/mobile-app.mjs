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
  { page: "mobile", name: "Refuge", symbol: "home" },
  { page: "feed", name: "Fil", symbol: "feed" },
  { page: "mobilePhotos", name: "Photos", symbol: "photos" },
  { page: "collections", name: "Albums", symbol: "albums" },
  { page: "broadcasts", name: "C8", symbol: "tv" },
]);
