'use client';

import { useState } from 'react';
import { parseWorkoutFromText } from '@/lib/parse-workout';
import { AddToIntervalsButton } from '@/components/ai/AddToIntervalsButton';
import type { WorkoutEvent, UserConfig } from '@/lib/types';
import type { AthleteAwayResult, AwayPlanResult } from '@/app/api/away-plan/route';

type AthleteSlug = 'mathias' | 'karoline';
type Step = 'action' | 'variant' | 'athlete' | 'sport' | 'result' | 'away_setup' | 'away_result';

export interface SuccessBanner {
  label: string;
  url: string;
  color: string;
}

export interface WorkoutPreview {
  workout: WorkoutEvent;
  athleteSlug: AthleteSlug;
}

const ATHLETES = [
  { slug: 'mathias' as AthleteSlug, label: 'Mathias', color: '#16a34a' },
  { slug: 'karoline' as AthleteSlug, label: 'Karoline', color: '#2563eb' },
];

const ACTIONS = [
  {
    id: 'extra',
    label: 'Ekstraøkt',
    icon: '⚡',
    description: 'AI foreslår en økt basert på dagsform',
  },
  {
    id: 'away',
    label: 'Borte',
    icon: '🧳',
    description: 'Tilpass plan til utstyret du har med',
  },
  {
    id: 'sick',
    label: 'Syk dag',
    icon: '🤒',
    description: 'Fjern planlagte økter for i dag',
  },
] as const;

const EQUIPMENT_OPTIONS = [
  { id: 'Run', label: 'Løpesko', icon: '👟' },
  { id: 'Ride', label: 'Sykkel', icon: '🚴' },
  { id: 'Swim', label: 'Svømmebasseng', icon: '🏊' },
  { id: 'WeightTraining', label: 'Treningsstudio', icon: '🏋️' },
  { id: 'NordicSki', label: 'Toppturski', icon: '⛷️' },
  { id: 'IceClimbing', label: 'Isøkser/stegjern', icon: '🧊' },
  { id: 'RockClimbing', label: 'Klatresele/-sko', icon: '🧗' },
  { id: 'Boxing', label: 'Boksehansker', icon: '🥊' },
  { id: 'Kayaking', label: 'Kajakk/padleåre', icon: '🛶' },
  { id: 'Hike', label: 'Tursko/sekk', icon: '🥾' },
];

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}
const SPORT_ICON: Record<string, string> = {
  Run: '🏃', Ride: '🚴', Swim: '🏊', WeightTraining: '🏋️',
  NordicSki: '⛷️', Rowing: '🚣', VirtualRide: '🚴', VirtualRun: '🏃',
};

const EXTRA_VARIANTS = [
  {
    id: 'extra_today',
    label: 'Legg til i dag',
    icon: '📅',
    description: 'Lett økt som passer dagsform',
  },
  {
    id: 'extra_load',
    label: 'Øk ukebelastning',
    icon: '📈',
    description: 'Ekstra stimulus uten å overbelaste',
  },
] as const;

const SPORTS = [
  { id: 'Run', label: 'Løp', icon: '🏃' },
  { id: 'Ride', label: 'Sykkel', icon: '🚴' },
  { id: 'Swim', label: 'Svøm', icon: '🏊' },
  { id: 'WeightTraining', label: 'Styrke', icon: '🏋️' },
  { id: 'NordicSki', label: 'Ski', icon: '⛷️' },
  { id: 'Rowing', label: 'Roing', icon: '🚣' },
];

// ─── Small UI ────────────────────────────────────────────────────────────────

function Breadcrumb({ parts }: { parts: string[] }) {
  return (
    <div className="flex items-center gap-1.5 mb-5 flex-wrap">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span style={{ color: 'var(--border)', fontSize: '12px' }}>›</span>}
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--bg)', color: 'var(--text-subtle)' }}
          >
            {p}
          </span>
        </span>
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium mb-3 uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>
      {children}
    </p>
  );
}

interface ActionCardProps {
  icon: string;
  label: string;
  description?: string;
  color?: string;
  onClick: () => void;
  fullWidth?: boolean;
}

function ActionCard({ icon, label, description, color, onClick, fullWidth }: ActionCardProps) {
  return (
    <div className={fullWidth ? 'col-span-2' : undefined}>
    <button
      onClick={onClick}
      className="flex items-start gap-3 px-4 py-3 rounded-2xl text-left transition-all w-full group"
      style={{
        backgroundColor: 'var(--bg)',
        border: '1px solid var(--border)',
      }}
    >
      <span className="text-xl mt-0.5 leading-none">{icon}</span>
      <div>
        <div className="text-sm font-semibold" style={{ color: color ?? 'var(--text)' }}>
          {label}
        </div>
        {description && (
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
            {description}
          </div>
        )}
      </div>
    </button>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs mb-5 flex items-center gap-1 transition-opacity opacity-60 hover:opacity-100"
      style={{ color: 'var(--text)' }}
    >
      ← Tilbake
    </button>
  );
}

function Spinner({ color }: { color: string }) {
  return (
    <div className="flex items-center gap-3 py-8">
      <div
        className="w-5 h-5 rounded-full border-2 animate-spin flex-shrink-0"
        style={{ borderColor: `${color}30`, borderTopColor: color }}
      />
      <span className="text-sm" style={{ color: 'var(--text-subtle)' }}>
        AI genererer økt…
      </span>
    </div>
  );
}

// ─── Result card ─────────────────────────────────────────────────────────────

interface ResultCardProps {
  workout: WorkoutEvent;
  athleteColor: string;
  athleteSlug: AthleteSlug;
  displayText: string;
  onAdded: (url: string) => void;
  onReset: () => void;
}

function ResultCard({ workout, athleteColor, athleteSlug, displayText, onAdded, onReset }: ResultCardProps) {
  const sportLabels: Record<string, string> = {
    Run: 'Løp', Ride: 'Sykkel', Swim: 'Svøm',
    WeightTraining: 'Styrke', NordicSki: 'Ski', Rowing: 'Roing',
  };

  return (
    <div className="space-y-4">
      {/* AI commentary */}
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-subtle)' }}>
        {displayText}
      </p>

      {/* Workout card */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: `1px solid ${athleteColor}30` }}
      >
        {/* Header bar */}
        <div
          className="px-4 py-3 flex items-center justify-between gap-2"
          style={{ backgroundColor: `${athleteColor}12` }}
        >
          <div>
            <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
              {workout.name}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <span
                className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: `${athleteColor}20`, color: athleteColor }}
              >
                {sportLabels[workout.type] ?? workout.type}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                {workout.start_date_local.slice(0, 10)}
              </span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            {workout.moving_time && (
              <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                {Math.round(workout.moving_time / 60)} min
              </div>
            )}
            {workout.icu_training_load && (
              <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                {workout.icu_training_load} TSS
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        {workout.description && (
          <div
            className="px-4 py-3 border-t"
            style={{ borderColor: `${athleteColor}20` }}
          >
            <pre
              className="text-xs leading-relaxed whitespace-pre-wrap font-mono"
              style={{ color: 'var(--text-subtle)' }}
            >
              {workout.description}
            </pre>
          </div>
        )}

        {/* Actions */}
        <div
          className="px-4 py-3 flex items-center gap-4 border-t"
          style={{ borderColor: `${athleteColor}20`, backgroundColor: `${athleteColor}06` }}
        >
          <AddToIntervalsButton
            workout={workout}
            athleteSlug={athleteSlug}
            color={athleteColor}
            onAdded={onAdded}
          />
          <button
            onClick={onReset}
            className="text-xs transition-opacity opacity-50 hover:opacity-100"
            style={{ color: 'var(--text)' }}
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Wizard ──────────────────────────────────────────────────────────────────

interface Props {
  config: UserConfig;
  onSuccess: (banner: SuccessBanner) => void;
  onPreview: (preview: WorkoutPreview | null) => void;
}

export function WorkoutWizard({ config, onSuccess, onPreview }: Props) {
  const [step, setStep] = useState<Step>('action');
  const [action, setAction] = useState<string | null>(null);
  const [actionLabel, setActionLabel] = useState<string | null>(null);
  const [variantLabel, setVariantLabel] = useState<string | null>(null);
  const [athleteSlug, setAthleteSlug] = useState<AthleteSlug | null>(null);
  const [sportLabel, setSportLabel] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sickLoading, setSickLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Away state
  const [awaySlugs, setAwaySlugs] = useState<AthleteSlug[]>(config.mode === 'preset' ? ['mathias', 'karoline'] : ['mathias']);
  const [awayFrom, setAwayFrom] = useState(() => addDays(todayIso(), 1));
  const [awayTo, setAwayTo] = useState(() => addDays(todayIso(), 4));
  const [awayEquipment, setAwayEquipment] = useState<string[]>(['Run']);
  const [awayResults, setAwayResults] = useState<AthleteAwayResult[]>([]);
  const [awayApplied, setAwayApplied] = useState<Set<number>>(new Set());
  const [awayApplying, setAwayApplying] = useState(false);

  const athleteColor = athleteSlug === 'mathias' ? '#16a34a' : '#2563eb';

  function reset() {
    setStep('action');
    setAction(null);
    setActionLabel(null);
    setVariantLabel(null);
    setAthleteSlug(null);
    setSportLabel(null);
    setAiResult(null);
    setError(null);
    setAwayResults([]);
    setAwayApplied(new Set());
    onPreview(null);
  }

  const defaultSlug: AthleteSlug = config.mode === 'preset' ? 'mathias' : 'mathias'; // placeholder for custom

  function pickAction(id: string, label: string) {
    setAction(id);
    setActionLabel(label);
    if (id === 'away') {
      setStep('away_setup');
      return;
    }
    if (config.mode !== 'preset') {
      // Skip athlete picker in custom mode
      setAthleteSlug(defaultSlug);
      if (id === 'sick') {
        handleSickDay(defaultSlug);
      } else {
        setStep(id === 'extra' ? 'variant' : 'sport');
      }
    } else {
      setStep(id === 'extra' ? 'variant' : 'athlete');
    }
  }

  async function fetchAwayPlan() {
    setLoading(true);
    setError(null);
    setAwayResults([]);
    try {
      const body = config.mode === 'preset'
        ? { athleteSlugs: awaySlugs, startDate: awayFrom, endDate: awayTo, equipment: awayEquipment }
        : { athleteId: config.athleteId, apiKey: config.apiKey, anthropicKey: config.anthropicKey, athleteName: config.name, startDate: awayFrom, endDate: awayTo, equipment: awayEquipment };

      const res = await fetch('/api/away-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Feil fra server');
      const data = await res.json();
      setAwayResults(data.athletes ?? []);
      setStep('away_result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ukjent feil');
    } finally {
      setLoading(false);
    }
  }

  async function applyAllChanges() {
    setAwayApplying(true);
    const allReplace = awayResults.flatMap((ar) =>
      ar.results.filter((r): r is AwayPlanResult & { action: 'replace'; newWorkout: WorkoutEvent } =>
        r.action === 'replace' && !!r.newWorkout && !awayApplied.has(r.eventId)
      ).map((r) => ({ ...r, athleteSlug: ar.athleteSlug }))
    );

    await Promise.all(allReplace.map(async (r) => {
      // Delete original
      await fetch('/api/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          config.mode === 'preset'
            ? { athleteSlug: r.athleteSlug, eventId: r.eventId }
            : { athleteId: config.athleteId, apiKey: config.apiKey, eventId: r.eventId }
        ),
      });
      // Create new
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          config.mode === 'preset'
            ? { athleteSlug: r.athleteSlug, event: r.newWorkout }
            : { athleteId: config.athleteId, apiKey: config.apiKey, event: r.newWorkout }
        ),
      });
      setAwayApplied((prev) => new Set([...prev, r.eventId]));
    }));

    setAwayApplying(false);
    onSuccess({ label: `${allReplace.length} økt${allReplace.length !== 1 ? 'er' : ''} tilpasset bortereise`, url: '', color: '#f59e0b' });
    reset();
  }

  function pickVariant(variantId: string, label: string) {
    setAction(variantId);
    setVariantLabel(label);
    if (config.mode !== 'preset') {
      setAthleteSlug(defaultSlug);
      setStep('sport');
    } else {
      setStep('athlete');
    }
  }

  function pickAthlete(slug: AthleteSlug) {
    setAthleteSlug(slug);
    if (action === 'sick') {
      handleSickDay(slug);
    } else {
      setStep('sport');
    }
  }

  function pickSport(sportId: string, label: string) {
    setSportLabel(label);
    setStep('result');
    fetchAI(athleteSlug!, action!, sportId);
  }

  function buildApiBody(slug: AthleteSlug, extra: Record<string, unknown> = {}) {
    if (config.mode === 'preset') {
      return { athleteSlug: slug, ...extra };
    }
    return {
      athleteId: config.athleteId,
      apiKey: config.apiKey,
      anthropicKey: config.anthropicKey,
      athleteName: config.name,
      ...extra,
    };
  }

  async function fetchAI(slug: AthleteSlug, actionId: string, sport: string) {
    setLoading(true);
    setError(null);
    setAiResult(null);
    onPreview(null);
    try {
      const res = await fetch('/api/quickactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildApiBody(slug, { action: actionId, sport })),
      });
      if (!res.ok) throw new Error('Feil fra server');
      const data = await res.json();
      setAiResult(data.text);
      const parsed = parseWorkoutFromText(data.text);
      if (parsed) onPreview({ workout: parsed, athleteSlug: slug });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ukjent feil');
    } finally {
      setLoading(false);
    }
  }

  async function handleSickDay(slug: AthleteSlug) {
    setSickLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildApiBody(slug, { sickDay: true })),
      });
      if (!res.ok) throw new Error('Feil fra server');
      const data = await res.json();
      const color = config.mode === 'preset'
        ? (slug === 'mathias' ? '#16a34a' : '#2563eb')
        : '#7c3aed';
      const presetIds: Record<string, string> = { mathias: 'i303639', karoline: 'i456432' };
      const resolvedAthleteId = config.mode === 'preset'
        ? presetIds[slug]
        : config.athleteId;
      const todayStr = new Date().toISOString().slice(0, 10);
      onSuccess({
        label: `${data.deleted} økt${data.deleted !== 1 ? 'er' : ''} fjernet for i dag`,
        url: `https://intervals.icu/athlete/${resolvedAthleteId}/activities?w=${todayStr}`,
        color,
      });
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ukjent feil');
      setStep('action');
    } finally {
      setSickLoading(false);
    }
  }

  const workout = aiResult ? parseWorkoutFromText(aiResult) : null;
  const displayText = aiResult?.replace(/```json[\s\S]*?```/g, '').trim() ?? null;

  // Breadcrumb parts
  const breadcrumb: string[] = [];
  if (actionLabel) breadcrumb.push(actionLabel);
  if (variantLabel) breadcrumb.push(variantLabel);
  if (athleteSlug) breadcrumb.push(athleteSlug === 'mathias' ? 'Mathias' : 'Karoline');
  if (sportLabel) breadcrumb.push(sportLabel);

  return (
    <div>
      {/* Step: velg handling */}
      {step === 'action' && (
        <div>
          <SectionLabel>Hurtighandling</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {ACTIONS.map((a, i) => (
              <ActionCard
                key={a.id}
                icon={a.icon}
                label={a.label}
                description={a.description}
                onClick={() => pickAction(a.id, a.label)}
                fullWidth={ACTIONS.length % 2 !== 0 && i === ACTIONS.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Step: variant (ekstraøkt) */}
      {step === 'variant' && (
        <div>
          <BackButton onClick={() => setStep('action')} />
          <Breadcrumb parts={breadcrumb} />
          <SectionLabel>Type ekstraøkt</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            {EXTRA_VARIANTS.map((v) => (
              <ActionCard
                key={v.id}
                icon={v.icon}
                label={v.label}
                description={v.description}
                onClick={() => pickVariant(v.id, v.label)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Step: velg atlet */}
      {step === 'athlete' && (
        <div>
          <BackButton onClick={() => setStep(action === 'sick' ? 'action' : 'variant')} />
          <Breadcrumb parts={breadcrumb} />
          <SectionLabel>Hvem trener?</SectionLabel>
          {sickLoading ? (
            <div className="flex items-center gap-3 py-6">
              <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--text)' }} />
              <span className="text-sm" style={{ color: 'var(--text-subtle)' }}>Fjerner økter…</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {ATHLETES.map((a) => (
                <ActionCard
                  key={a.slug}
                  icon={a.slug === 'mathias' ? '🟢' : '🔵'}
                  label={a.label}
                  color={a.color}
                  onClick={() => pickAthlete(a.slug)}
                />
              ))}
            </div>
          )}
          {error && <p className="mt-3 text-sm" style={{ color: '#dc2626' }}>{error}</p>}
        </div>
      )}

      {/* Step: velg sport */}
      {step === 'sport' && (
        <div>
          <BackButton onClick={() => setStep('athlete')} />
          <Breadcrumb parts={breadcrumb} />
          <SectionLabel>Velg sport</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {SPORTS.map((s) => (
              <button
                key={s.id}
                onClick={() => pickSport(s.id, s.label)}
                className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl transition-all"
                style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)' }}
              >
                <span className="text-xl leading-none">{s.icon}</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step: away_setup */}
      {step === 'away_setup' && (
        <div>
          <BackButton onClick={() => setStep('action')} />
          <Breadcrumb parts={[actionLabel!]} />

          {/* Hvem */}
          {config.mode === 'preset' && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>Hvem gjelder det?</SectionLabel>
              <div className="flex gap-2">
                {ATHLETES.map((a) => {
                  const selected = awaySlugs.includes(a.slug);
                  return (
                    <button
                      key={a.slug}
                      onClick={() => setAwaySlugs((prev) =>
                        selected ? prev.filter((s) => s !== a.slug) : [...prev, a.slug]
                      )}
                      className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                      style={{
                        backgroundColor: selected ? `${a.color}18` : 'var(--bg)',
                        border: `1px solid ${selected ? a.color : 'var(--border)'}`,
                        color: selected ? a.color : 'var(--text-subtle)',
                      }}
                    >
                      {a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Periode */}
          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Periode</SectionLabel>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={awayFrom}
                onChange={(e) => setAwayFrom(e.target.value)}
                className="flex-1 rounded-xl text-sm px-3 py-2"
                style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
              <span style={{ color: 'var(--text-subtle)', fontSize: 12 }}>–</span>
              <input
                type="date"
                value={awayTo}
                min={awayFrom}
                onChange={(e) => setAwayTo(e.target.value)}
                className="flex-1 rounded-xl text-sm px-3 py-2"
                style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>
          </div>

          {/* Utstyr */}
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>Tilgjengelig utstyr</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {EQUIPMENT_OPTIONS.map((eq) => {
                const selected = awayEquipment.includes(eq.id);
                return (
                  <button
                    key={eq.id}
                    onClick={() => setAwayEquipment((prev) =>
                      selected ? prev.filter((e) => e !== eq.id) : [...prev, eq.id]
                    )}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all"
                    style={{
                      backgroundColor: selected ? '#f59e0b18' : 'var(--bg)',
                      border: `1px solid ${selected ? '#f59e0b' : 'var(--border)'}`,
                    }}
                  >
                    <span>{eq.icon}</span>
                    <span className="text-sm font-medium" style={{ color: selected ? '#b45309' : 'var(--text-subtle)' }}>
                      {eq.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {awayEquipment.length === 0 && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-subtle)' }}>
                Ingen utstyr valgt — KI foreslår kroppsvekt/gåturer
              </p>
            )}
          </div>

          {error && <p className="text-sm mb-3" style={{ color: '#dc2626' }}>{error}</p>}

          <button
            onClick={fetchAwayPlan}
            disabled={loading || (config.mode === 'preset' && awaySlugs.length === 0)}
            className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
            style={{ backgroundColor: '#f59e0b18', color: '#b45309', border: '1px solid #f59e0b40' }}
          >
            {loading ? 'Analyserer plan…' : 'Tilpass plan'}
          </button>
        </div>
      )}

      {/* Step: away_result */}
      {step === 'away_result' && (
        <div>
          <BackButton onClick={() => setStep('away_setup')} />
          <Breadcrumb parts={[actionLabel!, `${fmtDate(awayFrom)}–${fmtDate(awayTo)}`]} />

          <div className="space-y-4">
            {awayResults.map((ar) => {
              const replaceCount = ar.results.filter((r) => r.action === 'replace').length;
              const unapplied = ar.results.filter((r) => r.action === 'replace' && !awayApplied.has(r.eventId));
              return (
                <div key={ar.athleteSlug}>
                  {awayResults.length > 1 && (
                    <p className="text-xs font-semibold mb-2" style={{ color: ar.athleteColor }}>{ar.athleteName}</p>
                  )}
                  {ar.results.length === 0 && (
                    <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Ingen planlagte økter i perioden.</p>
                  )}
                  <div className="space-y-1.5">
                    {ar.results.map((r) => {
                      const applied = awayApplied.has(r.eventId);
                      return (
                        <div
                          key={r.eventId}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl"
                          style={{
                            backgroundColor: r.action === 'keep' ? `${ar.athleteColor}08` : '#f59e0b08',
                            border: `1px solid ${r.action === 'keep' ? `${ar.athleteColor}20` : '#f59e0b20'}`,
                            opacity: applied ? 0.5 : 1,
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span style={{ fontSize: 10 }}>{r.action === 'keep' ? '✓' : '↺'}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span style={{ fontSize: 10 }}>{SPORT_ICON[r.originalEvent.type] ?? '⚡'}</span>
                                <span className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
                                  {r.originalEvent.name}
                                </span>
                                {r.action === 'replace' && r.newWorkout && (
                                  <>
                                    <span style={{ color: 'var(--text-subtle)', fontSize: 10 }}>→</span>
                                    <span style={{ fontSize: 10 }}>{SPORT_ICON[r.newWorkout.type] ?? '⚡'}</span>
                                    <span className="text-xs font-medium" style={{ color: '#b45309' }}>
                                      {r.newWorkout.name}
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)', fontSize: 9 }}>
                                {fmtDate(r.originalEvent.start_date_local)}
                              </div>
                            </div>
                          </div>
                          {r.action === 'replace' && r.newWorkout && !applied && (
                            <AddToIntervalsButton
                              workout={r.newWorkout}
                              athleteSlug={ar.athleteSlug as AthleteSlug}
                              athleteId={config.mode !== 'preset' ? config.athleteId : undefined}
                              apiKey={config.mode !== 'preset' ? config.apiKey : undefined}
                              color={ar.athleteColor}
                              onAdded={() => setAwayApplied((prev) => new Set([...prev, r.eventId]))}
                            />
                          )}
                          {applied && <span className="text-xs" style={{ color: ar.athleteColor }}>✓ Lagt til</span>}
                        </div>
                      );
                    })}
                  </div>
                  {replaceCount > 0 && unapplied.length > 0 && (
                    <button
                      onClick={applyAllChanges}
                      disabled={awayApplying}
                      className="mt-3 w-full py-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                      style={{ backgroundColor: '#f59e0b18', color: '#b45309', border: '1px solid #f59e0b40' }}
                    >
                      {awayApplying ? 'Gjennomfører…' : `Gjennomfør alle (${unapplied.length} endring${unapplied.length !== 1 ? 'er' : ''})`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button onClick={reset} className="mt-4 text-xs opacity-40 hover:opacity-80" style={{ color: 'var(--text)' }}>
            Avbryt
          </button>
        </div>
      )}

      {/* Step: resultat */}
      {step === 'result' && (
        <div>
          <BackButton onClick={() => { onPreview(null); setStep('sport'); }} />
          <Breadcrumb parts={breadcrumb} />

          {loading && <Spinner color={athleteColor} />}
          {error && <p className="text-sm" style={{ color: '#dc2626' }}>{error}</p>}

          {workout && displayText && !loading && (
            <ResultCard
              workout={workout}
              athleteColor={athleteColor}
              athleteSlug={athleteSlug!}
              displayText={displayText}
              onAdded={(url) => {
                onSuccess({ label: `${workout.name} lagt til`, url, color: athleteColor });
                reset();
              }}
              onReset={reset}
            />
          )}

          {!workout && displayText && !loading && (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{displayText}</p>
              <button onClick={reset} className="text-xs opacity-50 hover:opacity-100" style={{ color: 'var(--text)' }}>
                Start på nytt
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
