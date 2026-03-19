'use client'
import { Event } from '@/lib/intervals'
import { NutritionPlan } from '@/lib/nutrition'

type WorkoutStep = {
  label: string
  durationMin: number
  watts?: number
  pace?: string
  zone: string
  color: string
}

const ZONE_COLORS: Record<string, string> = {
  'I-1': '#3b82f6',
  'I-2': '#22c55e',
  'I-3': '#eab308',
  'I-4': '#f97316',
  'I-5': '#ef4444',
  warm: '#60a5fa',
  cool: '#6ee7b7',
}

const ZONE_FEELINGS: Record<string, string> = {
  'I-1': 'Lett — snakker fritt',
  'I-2': 'Kontrollert — lange setninger',
  'I-3': 'Krevende — korte setninger',
  'I-4': 'Hardt — få ord',
  'I-5': 'Maksimalt — enkeltord',
}

function parseWorkoutSteps(event: Event): WorkoutStep[] {
  const desc = event.description || ''
  const type = event.type || ''
  const totalMin = Math.round((event.moving_time || 3600) / 60)

  // Prøv å parse strukturert økt fra description
  const steps: WorkoutStep[] = []

  // Sjekk om det er Zwift/ERG-økt med watt-info i navn
  if (type === 'Ride' || type === 'VirtualRide') {
    // Sjekk for terskel/sweet spot/intervall i navn
    const name = event.name?.toLowerCase() || ''

    if (name.includes('terskel') || name.includes('threshold') || name.includes('5x10') || name.includes('8x5')) {
      const warmMin = Math.round(totalMin * 0.2)
      const mainMin = Math.round(totalMin * 0.6)
      const coolMin = totalMin - warmMin - mainMin
      steps.push({ label: 'Oppvarming', durationMin: warmMin, watts: 165, zone: 'I-1', color: ZONE_COLORS['I-1'] })
      steps.push({ label: 'Terskel-intervaller', durationMin: mainMin, watts: 237, zone: 'I-3', color: ZONE_COLORS['I-3'] })
      steps.push({ label: 'Avkjøling', durationMin: coolMin, watts: 155, zone: 'I-1', color: ZONE_COLORS.cool })
    } else if (name.includes('sweet spot') || name.includes('sweetspot')) {
      const warmMin = 15
      const mainMin = totalMin - 25
      steps.push({ label: 'Oppvarming', durationMin: warmMin, watts: 165, zone: 'I-1', color: ZONE_COLORS['I-1'] })
      steps.push({ label: 'Sweet Spot 4×10 min', durationMin: mainMin, watts: 237, zone: 'I-3', color: ZONE_COLORS['I-3'] })
      steps.push({ label: 'Avkjøling', durationMin: 10, watts: 155, zone: 'I-1', color: ZONE_COLORS.cool })
    } else {
      // Rolig/aerob
      const warmMin = Math.min(20, Math.round(totalMin * 0.15))
      const mainMin = totalMin - warmMin * 2
      steps.push({ label: 'Innkjøring', durationMin: warmMin, watts: 160, zone: 'I-1', color: ZONE_COLORS['I-1'] })
      steps.push({ label: 'Aerob base', durationMin: mainMin, watts: 190, zone: 'I-2', color: ZONE_COLORS['I-2'] })
      steps.push({ label: 'Avkjøling', durationMin: warmMin, watts: 155, zone: 'I-1', color: ZONE_COLORS.cool })
    }
  } else if (type === 'Run') {
    const name = event.name?.toLowerCase() || ''
    if (name.includes('terskel') || name.includes('threshold')) {
      steps.push({ label: 'Oppvarming', durationMin: 20, pace: '5:30/km', zone: 'I-1', color: ZONE_COLORS['I-1'] })
      steps.push({ label: '4×5 min @ 3:56/km', durationMin: Math.round(totalMin * 0.5), pace: '3:56/km', zone: 'I-4', color: ZONE_COLORS['I-4'] })
      steps.push({ label: 'Rolig jogg', durationMin: Math.round(totalMin * 0.3), pace: '5:30/km', zone: 'I-1', color: ZONE_COLORS.cool })
    } else {
      steps.push({ label: 'Innkjøring', durationMin: 10, pace: '5:30/km', zone: 'I-1', color: ZONE_COLORS['I-1'] })
      steps.push({ label: 'Rolig løp', durationMin: totalMin - 15, pace: '5:00/km', zone: 'I-2', color: ZONE_COLORS['I-2'] })
      steps.push({ label: 'Avkjøling', durationMin: 5, pace: '5:45/km', zone: 'I-1', color: ZONE_COLORS.cool })
    }
  } else if (type === 'Swim') {
    steps.push({ label: 'Oppvarming', durationMin: 10, zone: 'I-1', color: ZONE_COLORS['I-1'] })
    steps.push({ label: 'Teknikk-drills', durationMin: Math.round(totalMin * 0.4), zone: 'I-2', color: ZONE_COLORS['I-2'] })
    steps.push({ label: 'CSS-hoveddel', durationMin: Math.round(totalMin * 0.4), zone: 'I-3', color: ZONE_COLORS['I-3'] })
    steps.push({ label: 'Avkjøling', durationMin: Math.round(totalMin * 0.1), zone: 'I-1', color: ZONE_COLORS.cool })
  }

  if (steps.length === 0) {
    steps.push({ label: event.name || 'Økt', durationMin: totalMin, zone: 'I-2', color: ZONE_COLORS['I-2'] })
  }

  return steps
}

// Watt-profil-visualisering
function BikeProfile({ steps }: { steps: WorkoutStep[] }) {
  const total = steps.reduce((s, st) => s + st.durationMin, 0)
  const maxW = Math.max(...steps.map(s => s.watts || 200)) * 1.1

  return (
    <div className="mt-3">
      <div className="text-xs text-zinc-500 mb-2">Watt-profil</div>
      <div className="flex items-end gap-0.5 h-16 w-full">
        {steps.map((step, i) => {
          const pct = step.durationMin / total
          const heightPct = ((step.watts || 160) / maxW) * 100
          return (
            <div
              key={i}
              className="flex flex-col justify-end items-center group relative"
              style={{ width: `${pct * 100}%` }}
            >
              <div
                className="w-full rounded-t transition-all"
                style={{ height: `${heightPct}%`, backgroundColor: step.color, opacity: 0.85 }}
              />
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-zinc-900 text-xs text-white px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                {step.watts}W · {step.durationMin}min
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-0 mt-1">
        {steps.map((step, i) => {
          const pct = step.durationMin / total
          return (
            <div key={i} style={{ width: `${pct * 100}%` }} className="overflow-hidden">
              <div className="text-xs text-zinc-600 truncate px-0.5">{step.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Pace-profil for løp
function RunProfile({ steps }: { steps: WorkoutStep[] }) {
  const total = steps.reduce((s, st) => s + st.durationMin, 0)
  return (
    <div className="mt-3">
      <div className="text-xs text-zinc-500 mb-2">Øktprofil</div>
      <div className="flex gap-1 h-10 w-full items-end">
        {steps.map((step, i) => {
          const pct = step.durationMin / total
          return (
            <div
              key={i}
              className="rounded flex items-center justify-center text-xs text-white/70 overflow-hidden"
              style={{ width: `${pct * 100}%`, backgroundColor: step.color, opacity: 0.8 }}
              title={`${step.label} · ${step.durationMin}min`}
            >
              {step.pace && pct > 0.15 && <span className="text-xs font-mono">{step.pace}</span>}
            </div>
          )
        })}
      </div>
      <div className="flex gap-1 mt-1">
        {steps.map((step, i) => {
          const pct = step.durationMin / total
          if (pct < 0.1) return null
          return (
            <div key={i} style={{ width: `${pct * 100}%` }} className="overflow-hidden">
              <div className="text-xs text-zinc-600 truncate">{step.durationMin}min</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Muskelgruppe-figur for styrke
function MuscleMap({ description }: { description: string }) {
  const desc = description?.toLowerCase() || ''
  const muscles = {
    quadriceps: desc.includes('squat') || desc.includes('leg press'),
    hamstrings: desc.includes('squat') || desc.includes('hamstring'),
    calves: desc.includes('calf'),
    back: desc.includes('lat pull') || desc.includes('back'),
    glutes: desc.includes('squat') || desc.includes('leg press'),
    core: desc.includes('core') || desc.includes('plank'),
  }

  return (
    <div className="mt-3 flex gap-4 items-start">
      <div className="flex flex-col items-center gap-1">
        <div className="text-xs text-zinc-500 mb-1">Aktiverte muskler</div>
        {/* Enkel SVG-kropp */}
        <svg width="80" height="140" viewBox="0 0 80 140" className="opacity-80">
          {/* Hode */}
          <circle cx="40" cy="12" r="10" fill="#3f3f46" />
          {/* Torso */}
          <rect x="25" y="24" width="30" height="40" rx="4" fill={muscles.back ? '#f97316' : '#3f3f46'} />
          {/* Core */}
          <rect x="28" y="40" width="24" height="20" rx="2" fill={muscles.core ? '#eab308' : '#3f3f46'} opacity="0.6" />
          {/* Armer */}
          <rect x="10" y="26" width="14" height="30" rx="6" fill={muscles.back ? '#f97316aa' : '#3f3f46'} />
          <rect x="56" y="26" width="14" height="30" rx="6" fill={muscles.back ? '#f97316aa' : '#3f3f46'} />
          {/* Glutes */}
          <rect x="25" y="64" width="30" height="14" rx="4" fill={muscles.glutes ? '#f97316' : '#3f3f46'} />
          {/* Quads */}
          <rect x="25" y="78" width="13" height="32" rx="4" fill={muscles.quadriceps ? '#22c55e' : '#3f3f46'} />
          <rect x="42" y="78" width="13" height="32" rx="4" fill={muscles.quadriceps ? '#22c55e' : '#3f3f46'} />
          {/* Hamstrings (bak) */}
          <rect x="27" y="80" width="10" height="28" rx="3" fill={muscles.hamstrings ? '#eab308aa' : 'transparent'} />
          <rect x="43" y="80" width="10" height="28" rx="3" fill={muscles.hamstrings ? '#eab308aa' : 'transparent'} />
          {/* Calves */}
          <rect x="26" y="112" width="11" height="24" rx="4" fill={muscles.calves ? '#38bdf8' : '#3f3f46'} />
          <rect x="43" y="112" width="11" height="24" rx="4" fill={muscles.calves ? '#38bdf8' : '#3f3f46'} />
        </svg>
      </div>
      <div className="flex flex-col gap-1.5 mt-6">
        {Object.entries(muscles).filter(([, v]) => v).map(([k]) => (
          <div key={k} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-400" />
            <span className="text-xs text-zinc-300 capitalize">{k === 'quadriceps' ? 'Lår (quad)' : k === 'hamstrings' ? 'Bakside lår' : k === 'calves' ? 'Leggmuskler' : k === 'back' ? 'Rygg/nakke' : k === 'glutes' ? 'Sete' : 'Core'}</span>
          </div>
        ))}
        {Object.values(muscles).every(v => !v) && (
          <span className="text-xs text-zinc-500">Generell styrkeøkt</span>
        )}
      </div>
    </div>
  )
}

// Ernærings-panel
function NutritionPanel({ plan }: { plan: NutritionPlan }) {
  return (
    <div className="mt-4 border-t border-zinc-700 pt-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Ernæring</div>
      <div className="grid grid-cols-1 gap-2">
        <div className="bg-zinc-700/40 rounded-lg p-2.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-zinc-300">Før</span>
            <span className="text-xs text-zinc-500">{plan.before.timing}</span>
          </div>
          <div className="text-xs text-zinc-400 leading-snug">{plan.before.notes}</div>
          <div className="flex gap-3 mt-1.5">
            <span className="text-xs text-amber-300">{plan.before.carbs}g karbo</span>
            <span className="text-xs text-blue-300">{plan.before.protein}g protein</span>
          </div>
        </div>
        {plan.during && (
          <div className="bg-zinc-700/40 rounded-lg p-2.5">
            <div className="text-xs font-medium text-zinc-300 mb-1">Under</div>
            <div className="text-xs text-zinc-400 leading-snug">{plan.during.notes}</div>
            <div className="flex gap-3 mt-1.5">
              <span className="text-xs text-amber-300">{plan.during.carbsPerHour}g karbo/time</span>
              <span className="text-xs text-sky-300">{plan.during.fluidMl}ml/time</span>
            </div>
          </div>
        )}
        <div className="bg-zinc-700/40 rounded-lg p-2.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-zinc-300">Etter</span>
            <span className="text-xs text-zinc-500">innen {plan.after.window}</span>
          </div>
          <div className="text-xs text-zinc-400 leading-snug">{plan.after.notes}</div>
          <div className="flex gap-3 mt-1.5">
            <span className="text-xs text-amber-300">{plan.after.carbs}g karbo</span>
            <span className="text-xs text-blue-300">{plan.after.protein}g protein</span>
          </div>
        </div>
      </div>
      <div className="mt-2 text-xs text-zinc-600">
        Estimert forbruk: ~{plan.totalExtra} kcal
      </div>
    </div>
  )
}

type Props = {
  event: Event
  nutrition: NutritionPlan
  athleteColor: string
  why?: string
}

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h > 0 ? `${h}t ${m}min` : `${m} min`
}

export default function WorkoutDetail({ event, nutrition, athleteColor, why }: Props) {
  const steps = parseWorkoutSteps(event)
  const type = event.type || ''
  const isBike = type === 'Ride' || type === 'VirtualRide'
  const isRun = type === 'Run'
  const isStrength = type === 'WeightTraining'
  const isSwim = type === 'Swim'

  const mainZone = steps.find(s => s.durationMin === Math.max(...steps.map(x => x.durationMin)))?.zone || 'I-2'
  const feeling = ZONE_FEELINGS[mainZone] || ''

  return (
    <div className="bg-zinc-800 rounded-xl p-5 flex flex-col gap-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1 h-6 rounded-full" style={{ backgroundColor: athleteColor }} />
            <h2 className="text-base font-semibold text-white leading-tight">{event.name}</h2>
          </div>
          <div className="flex gap-3 ml-3">
            {event.moving_time > 0 && (
              <span className="text-xs text-zinc-400">{formatTime(event.moving_time)}</span>
            )}
            {event.icu_training_load > 0 && (
              <span className="text-xs text-zinc-400">TSS {event.icu_training_load}</span>
            )}
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: ZONE_COLORS[mainZone] + '30', color: ZONE_COLORS[mainZone] }}>
              {mainZone} — {feeling}
            </span>
          </div>
        </div>
      </div>

      {/* Hvorfor */}
      {why && (
        <div className="bg-zinc-700/30 rounded-lg p-3 mb-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Hvorfor denne økten</div>
          <p className="text-sm text-zinc-300 leading-snug">{why}</p>
        </div>
      )}

      {/* Visualisering */}
      {isBike && <BikeProfile steps={steps} />}
      {isRun && <RunProfile steps={steps} />}
      {isStrength && <MuscleMap description={event.description || ''} />}
      {isSwim && (
        <div className="mt-3 flex gap-1 h-10">
          {steps.map((s, i) => {
            const total = steps.reduce((sum, x) => sum + x.durationMin, 0)
            return (
              <div
                key={i}
                className="rounded flex items-center justify-center text-xs text-white/60"
                style={{ width: `${(s.durationMin / total) * 100}%`, backgroundColor: s.color, opacity: 0.8 }}
                title={s.label}
              >
                {s.durationMin}m
              </div>
            )
          })}
        </div>
      )}

      {/* Beskrivelse */}
      {event.description && (
        <div className="mt-3">
          <div className="text-xs text-zinc-500 mb-1">Øktinnhold</div>
          <pre className="text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap font-sans">
            {event.description}
          </pre>
        </div>
      )}

      {/* Ernæring */}
      <NutritionPanel plan={nutrition} />
    </div>
  )
}
