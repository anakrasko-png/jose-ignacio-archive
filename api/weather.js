const weatherUrl =
  "https://api.open-meteo.com/v1/forecast?latitude=-34.83&longitude=-54.63&current=temperature_2m,weather_code,wind_speed_10m,is_day&timezone=auto";

function weatherLabel(code) {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Partly cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Conditions changing";
}

module.exports = async (req, res) => {
  try {
    const response = await fetch(weatherUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Weather request failed with ${response.status}`);
    }

    const data = await response.json();
    const current = data.current;

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({
      location: "Jose Ignacio, Uruguay",
      temperatureC: current.temperature_2m,
      windKmh: current.wind_speed_10m,
      weatherCode: current.weather_code,
      isDay: current.is_day === 1,
      summary: weatherLabel(current.weather_code),
      time: current.time
    });
  } catch (error) {
    res.status(502).json({ error: "Weather unavailable" });
  }
};
