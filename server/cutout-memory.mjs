export function cutoutProfile(available) {
  return {
    quality: "precise",
    allowed: available >= 3 * 1024 ** 3,
    requiredMiB: 3072,
    availableMiB: Math.floor(available / 1024 ** 2),
  };
}
