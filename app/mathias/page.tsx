import { MATHIAS } from '@/lib/athletes'
import ProfilePage from '@/components/ProfilePage'
import { getActivities, getEvents, getFitness, getWellness, getAthlete, dateStr } from '@/lib/intervals'

export default async function MathiasPage() {
  const a = MATHIAS
  const today = dateStr(0)

  const [acts, events, fitness, wellness, profile] = await Promise.all([
    getActivities(a.id, a.apiKey, dateStr(-90), today),
    getEvents(a.id, a.apiKey, today, dateStr(21)),
    getFitness(a.id, a.apiKey, dateStr(-90), today),
    getWellness(a.id, a.apiKey, dateStr(-30), today),
    getAthlete(a.id, a.apiKey),
  ])

  return <ProfilePage athlete={a} acts={acts} events={events} fitness={fitness} wellness={wellness} profile={profile} />
}
