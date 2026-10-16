export function upcomingPhotoWindow(hourly, now) {
  const future = hourly
    .filter((h) => h.time >= now)
    .sort((a, b) => a.time.localeCompare(b.time));
  const first = future.findIndex((h) => h.suitable);
  if (first < 0) return null;
  let last = first;
  while (
    last + 1 < future.length &&
    future[last + 1].suitable &&
    Date.parse(future[last + 1].time + "Z") -
      Date.parse(future[last].time + "Z") ===
      3600000 &&
    future[last + 1].time.slice(0, 10) === future[first].time.slice(0, 10)
  )
    last++;
  const end = new Date(Date.parse(future[last].time + "Z") + 3600000)
    .toISOString()
    .slice(11, 16);
  return {
    date: future[first].time.slice(0, 10),
    start: future[first].time.slice(11, 16),
    end,
  };
}
