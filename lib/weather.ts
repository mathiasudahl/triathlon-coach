// Open-Meteo — gratis, ingen API-nøkkel
// Oslo: lat 59.9139, lon 10.7522

export type WeatherData = {
  temp: number
  feelsLike: number
  windspeed: number
  weathercode: number
  description: string
  icon: string
  precipitation: number
}

const WMO_CODES: Record<number, { description: string; icon: string }> = {
  0:  { description: 'Klarvær', icon: '☀️' },
  1:  { description: 'Mest klart', icon: '🌤️' },
  2:  { description: 'Delvis skyet', icon: '⛅' },
  3:  { description: 'Overskyet', icon: '☁️' },
  45: { description: 'Tåke', icon: '🌫️' },
  48: { description: 'Tåke', icon: '🌫️' },
  51: { description: 'Lett yr', icon: '🌦️' },
  53: { description: 'Yr', icon: '🌦️' },
  55: { description: 'Yr', icon: '🌧️' },
  61: { description: 'Lett regn', icon: '🌧️' },
  63: { description: 'Regn', icon: '🌧️' },
  65: { description: 'Kraftig regn', icon: '🌧️' },
  71: { description: 'Lett snø', icon: '🌨️' },
  73: { description: 'Snø', icon: '❄️' },
  75: { description: 'Kraftig snø', icon: '❄️' },
  80: { description: 'Regnbyger', icon: '🌦️' },
  81: { description: 'Regnbyger', icon: '🌧️' },
  82: { description: 'Kraftige byger', icon: '⛈️' },
  95: { description: 'Tordenvær', icon: '⛈️' },
}

export async function getOsloWeather(): Promise<WeatherData | null> {
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=59.9139&longitude=10.7522&current=temperature_2m,apparent_temperature,precipitation,weathercode,windspeed_10m&timezone=Europe%2FOslo'
    const res = await fetch(url, { next: { revalidate: 1800 } })
    if (!res.ok) return null
    const data = await res.json()
    const c = data.current
    const wmo = WMO_CODES[c.weathercode] ?? { description: 'Ukjent', icon: '🌡️' }
    return {
      temp: Math.round(c.temperature_2m),
      feelsLike: Math.round(c.apparent_temperature),
      windspeed: Math.round(c.windspeed_10m),
      weathercode: c.weathercode,
      description: wmo.description,
      icon: wmo.icon,
      precipitation: c.precipitation ?? 0,
    }
  } catch {
    return null
  }
}
