// Resolve only when every selected image has settled. A caller can keep playback
// blocked on failures instead of silently producing an empty frame.
export async function prepareImages(
  urls,
  { load, onProgress = () => {}, concurrency = 4 } = {},
) {
  const list = [...new Set(urls.filter(Boolean))],
    failed = [];
  let next = 0,
    done = 0;
  if (typeof load !== "function") throw new TypeError("Image loader required");
  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), list.length) },
      async () => {
        while (next < list.length) {
          const url = list[next++];
          try {
            await load(url);
          } catch {
            failed.push(url);
          }
          done++;
          onProgress({ done, total: list.length, failed: [...failed] });
        }
      },
    ),
  );
  return { done, total: list.length, failed };
}
