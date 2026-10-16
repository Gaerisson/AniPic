export const moree = { name: "Morée", latitude: 47.9143, longitude: 1.2544 };
let cached = null;
let pending = null;
export function photoWindow(hour) {
  const suitable =
    hour.day === 1 &&
    hour.rainProbability < 35 &&
    hour.rain < 0.2 &&
    hour.wind < 30 &&
    hour.temperature >= 5 &&
    hour.temperature <= 30;
  return {
    ...hour,
    suitable,
    reason: !hour.day
      ? "Après le coucher du soleil"
      : hour.rainProbability >= 35 || hour.rain >= 0.2
        ? "Pluie possible"
        : hour.wind >= 30
          ? "Vent soutenu"
          : hour.temperature < 5
            ? "Froid"
            : hour.temperature > 30
              ? "Chaleur"
              : "Lumière du jour, peu de pluie et vent modéré",
  };
}
export function parseForecast(data) {
  if (
    !data?.hourly?.time?.length ||
    !data?.daily?.time?.length ||
    !Number.isFinite(data?.current?.temperature_2m) ||
    !Number.isFinite(data?.current?.wind_speed_10m)
  )
    throw new Error("Prévision météo indisponible.");
  const hourly = data.hourly.time
    .map((time, i) =>
      photoWindow({
        time,
        temperature: data.hourly.temperature_2m[i],
        rainProbability: data.hourly.precipitation_probability[i],
        rain: data.hourly.precipitation[i],
        wind: data.hourly.wind_speed_10m[i],
        day: data.hourly.is_day[i],
      }),
    )
    .filter((h) =>
      Object.values(h).every((v) => v !== null && v !== undefined),
    );
  const days = data.daily.time.map((date, i) => ({
    date,
    code: data.daily.weather_code[i],
    min: data.daily.temperature_2m_min[i],
    max: data.daily.temperature_2m_max[i],
    rainProbability: data.daily.precipitation_probability_max[i],
    wind: data.daily.wind_speed_10m_max[i],
    sunrise: data.daily.sunrise[i],
    sunset: data.daily.sunset[i],
    slots: hourly
      .filter((h) => h.time.startsWith(date) && h.suitable)
      .map((h) => h.time.slice(11, 16)),
  }));
  return {
    location: moree,
    timezone: "Europe/Paris",
    updatedAt: new Date().toISOString(),
    current: data.current,
    days,
    hourly,
    source: "Open-Meteo",
    stale: false,
  };
}
export async function forecast(fetcher = fetch) {
  if (cached && Date.now() - cached.at < 30 * 60_000) return cached.value;
  if (pending) return pending;
  pending = (async () => {
    try {
      const query = new URLSearchParams({
        latitude: String(moree.latitude),
        longitude: String(moree.longitude),
        timezone: "Europe/Paris",
        forecast_days: "7",
        current: "temperature_2m,weather_code,is_day,wind_speed_10m",
        hourly:
          "temperature_2m,precipitation_probability,precipitation,wind_speed_10m,is_day",
        daily:
          "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset",
      });
      const response = await fetcher(
        "https://api.open-meteo.com/v1/forecast?" + query,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!response.ok)
        throw new Error("Service météo temporairement indisponible.");
      const text = await response.text();
      if (text.length > 500000) throw new Error("Réponse météo hors limites.");
      const value = parseForecast(JSON.parse(text));
      cached = { at: Date.now(), value };
      return value;
    } catch (error) {
      if (cached) return { ...cached.value, stale: true };
      throw Object.assign(error, { statusCode: 503 });
    } finally {
      pending = null;
    }
  })();
  return pending;
}
