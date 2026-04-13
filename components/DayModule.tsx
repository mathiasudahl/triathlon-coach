'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Activity, WorkoutEvent, DailyAnalysis, WeatherData, UserConfig } from '@/lib/types';
import { AddToIntervalsButton } from '@/components/ai/AddToIntervalsButton';
import { getAllEFTrends, type EFTrend } from '@/lib/efficiency';

// ─── Cache helpers ────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayStr() {
  const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10);
}
function cacheKey(slug: string, date: string) {
  return `daily-analysis:${slug}:${date}`;
}
function activityIdsKey(slug: string) {
  return `activity-ids:${slug}`;
}
function isAfter06() {
  return new Date().getHours() >= 6;
}
function isCacheValid(a: DailyAnalysis): boolean {
  const today = todayStr();
  if (a.date !== today) return false;
  if (!isAfter06()) return false;
  const generated = new Date(a.generatedAt);
  const at06 = new Date(); at06.setHours(6, 0, 0, 0);
  return generated >= at06;
}
function loadCached(slug: string): DailyAnalysis | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey(slug, todayStr()));
    if (!raw) return null;
    const parsed: DailyAnalysis = JSON.parse(raw);
    return isCacheValid(parsed) ? parsed : null;
  } catch { return null; }
}
function saveCache(a: DailyAnalysis) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(cacheKey(a.athleteSlug, a.date), JSON.stringify(a));
}
function getStoredActivityIds(slug: string): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(activityIdsKey(slug)) ?? '[]'); }
  catch { return []; }
}
function saveActivityIds(slug: string, ids: string[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(activityIdsKey(slug), JSON.stringify(ids));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SPORT_ICON: Record<string, string> = {
  Run: '🏃', Ride: '🚴', Swim: '🏊', WeightTraining: '🏋️',
  NordicSki: '⛷️', Rowing: '🚣', VirtualRide: '🚴', VirtualRun: '🏃',
};
function sportIcon(t: string) { return SPORT_ICON[t] ?? '⚡'; }

const SYMBOL_EMOJI: [string, string][] = [
  ['clearsky', '☀️'], ['fair', '🌤️'], ['partlycloudy', '⛅'], ['cloudy', '☁️'],
  ['fog', '🌫️'], ['heavyrain', '🌧️'], ['heavyrainshowers', '🌧️'],
  ['lightrain', '🌦️'], ['lightrainshowers', '🌦️'], ['rain', '🌧️'], ['rainshowers', '🌧️'],
  ['lightsleet', '🌨️'], ['sleet', '🌨️'], ['lightsnow', '❄️'], ['snow', '❄️'], ['snowshowers', '❄️'],
  ['thunder', '⛈️'],
];
function symbolToEmoji(symbol: string): string {
  for (const [prefix, emoji] of SYMBOL_EMOJI) {
    if (symbol.startsWith(prefix)) return emoji;
  }
  return '🌡️';
}

function fmtDur(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}t${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

// ─── EF Module ────────────────────────────────────────────────────────────────

function fmtWeek(isoDate: string): string {
  const months = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'];
  const [, m, d] = isoDate.split('-').map(Number);
  return `${d}. ${months[m - 1]}`;
}

function fmtDateRange(isoRange: string): string {
  // "2026-02-09–2026-02-23" — if same start and end (1-week block), show just one date
  const [from, to] = isoRange.split('–');
  if (!from || !to) return isoRange;
  if (from === to) return `uke ${fmtWeek(from)}`;
  const months = ['jan','feb','mar','apr','mai','jun','jul','aug','sep','okt','nov','des'];
  const [, fm, fd] = from.split('-').map(Number);
  const [, tm, td] = to.split('-').map(Number);
  if (fm === tm) return `${fd}.–${td}. ${months[fm - 1]}`;
  return `${fd}. ${months[fm - 1]}–${td}. ${months[tm - 1]}`;
}

function EFTrendRow({ trend, color }: { trend: EFTrend; color: string }) {
  const up = trend.changePercent >= 0;
  const pct = Math.abs(trend.changePercent).toFixed(1);
  const sportLabel = trend.sport === 'Ride' ? 'Sykkel' : trend.sport === 'Run' ? 'Løp' : 'Svøm';
  const arrow = up ? '↑' : '↓';
  const changeColor = up ? color : '#ef4444';
  const recentFmt = fmtDateRange(trend.recentLabel);
  const priorFmt = fmtDateRange(trend.priorLabel);
  const validityIcon = trend.validity === 'god' ? '✓' : trend.validity === 'usikker' ? '~' : '⚠';

  return (
    <div>
      <div className="flex items-baseline justify-between gap-1">
        <span className="uppercase tracking-wider opacity-40 truncate" style={{ fontSize: 9 }}>
          {sportLabel}: {trend.groupLabel}
        </span>
        <span className="font-semibold flex-shrink-0" style={{ color: changeColor, fontSize: 13 }}>
          {arrow} {up ? '+' : '−'}{pct}%
        </span>
      </div>
      <p className="opacity-45 mt-0.5" style={{ fontSize: 9 }}>
        EF {trend.baselineEF.toFixed(2)} → {trend.currentWeekEF.toFixed(2)} · {priorFmt} → {recentFmt}
      </p>
      <p className="opacity-30 mt-0.5" style={{ fontSize: 9 }}>
        {validityIcon} {trend.validityNote}
      </p>
    </div>
  );
}

function EFModule({ activities, color }: { activities: Activity[]; color: string }) {
  const [expanded, setExpanded] = useState(false);
  const trends = getAllEFTrends(activities);
  if (trends.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-baseline justify-between gap-1 w-full text-left hover:opacity-80 transition-opacity"
      >
        <span className="uppercase tracking-wider opacity-40" style={{ fontSize: 9 }}>
          Prestasjon <span style={{ fontSize: 12 }}>{expanded ? '▾' : '▸'}</span>
        </span>
        <span className="opacity-40" style={{ fontSize: 9 }}>
          {trends.map((t, i) => {
            const up = t.changePercent >= 0;
            const sport = t.sport === 'Ride' ? 'Sykkel' : t.sport === 'Run' ? 'Løp' : 'Svøm';
            return (
              <span key={t.sport}>
                {i > 0 && ' · '}
                {up ? '↑' : '↓'} {sport} {up ? '+' : '−'}{Math.abs(t.changePercent).toFixed(1)}%
              </span>
            );
          })}
        </span>
      </button>
      {expanded && (
        <div className="mt-1.5 space-y-2">
          {trends.map((trend) => (
            <EFTrendRow key={trend.sport} trend={trend} color={color} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DayModuleProps {
  config: UserConfig;
  mathiasActivities: Activity[];
  mathiasEvents: WorkoutEvent[];
  karolineActivities: Activity[];
  karolineEvents: WorkoutEvent[];
  customActivities: Activity[];
  customEvents: WorkoutEvent[];
  weather: WeatherData | null;
  onRefresh: () => void;
}

interface AthleteInfo {
  slug: string;
  name: string;
  color: string;
  hasProgram: boolean;
  hasAI: boolean;
  anthropicKey?: string;
  athleteId?: string;
  apiKey?: string;
}

// ─── AI Push forslag ──────────────────────────────────────────────────────────

interface AiPushPanelProps {
  athlete: AthleteInfo;
  periodLabel: string;
  workouts: WorkoutEvent[];
  onClose: () => void;
  onAdded: () => void;
}

function AiPushPanel({ athlete, periodLabel, workouts, onClose, onAdded }: AiPushPanelProps) {
  const sportLabels: Record<string, string> = {
    Run: 'Løp', Ride: 'Sykkel', Swim: 'Svøm',
    WeightTraining: 'Styrke', NordicSki: 'Ski', Rowing: 'Roing',
  };

  return (
    <div
      className="mt-2 rounded-xl overflow-hidden"
      style={{ border: `1px solid ${athlete.color}25`, backgroundColor: `${athlete.color}06` }}
    >
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: `1px solid ${athlete.color}15` }}
      >
        <span className="text-xs font-medium" style={{ color: athlete.color }}>
          Forslag: {periodLabel}
        </span>
        <button onClick={onClose} className="text-xs opacity-40 hover:opacity-70" style={{ color: 'var(--text)' }}>✕</button>
      </div>
      <div className="px-3 py-2 space-y-2">
        {workouts.map((w, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span style={{ fontSize: 12 }}>{sportIcon(w.type)}</span>
              <div className="min-w-0">
                <span className="text-xs font-medium truncate block" style={{ color: 'var(--text)' }}>{w.name}</span>
                <span className="text-xs opacity-50" style={{ fontSize: 10 }}>
                  {w.start_date_local.slice(0, 10)} · {sportLabels[w.type] ?? w.type}
                  {w.moving_time ? ` · ${fmtDur(w.moving_time)}` : ''}
                </span>
              </div>
            </div>
            <AddToIntervalsButton
              workout={w}
              athleteSlug={athlete.slug as 'mathias' | 'karoline'}
              athleteId={athlete.athleteId}
              apiKey={athlete.apiKey}
              color={athlete.color}
              onAdded={onAdded}
            />
          </div>
        ))}
      </div>
    </div>
  );
}


// ─── Per-athlete panel ────────────────────────────────────────────────────────

interface AthletePanelProps {
  athlete: AthleteInfo;
  activities: Activity[];
  events: WorkoutEvent[];
  weather: WeatherData | null;
  onRefresh: () => void;
}

function AthletePanel({ athlete, activities, events, weather, onRefresh }: AthletePanelProps) {
  const [analysis, setAnalysis] = useState<DailyAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [adaptLoading, setAdaptLoading] = useState(false);
  const [adaptResult, setAdaptResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);
  const [aiPushWorkouts, setAiPushWorkouts] = useState<WorkoutEvent[] | null>(null);
  const [aiPushLabel, setAiPushLabel] = useState('');
  const [todaySummaryExpanded, setTodaySummaryExpanded] = useState(false);

  const today = todayStr();
  const yesterday = yesterdayStr();

  const todayEvents = events.filter((e) => e.start_date_local.slice(0, 10) === today);
  const todayActivities = activities.filter((a) => a.start_date_local.slice(0, 10) === today);
  const yesterdayActs = activities.filter((a) => a.start_date_local.slice(0, 10) === yesterday);
  const nextEvent = events.find((e) => e.start_date_local.slice(0, 10) > today) ?? null;

  function buildApiBody(extra: Record<string, unknown> = {}) {
    if (athlete.slug === 'mathias' || athlete.slug === 'karoline') {
      return { athleteSlug: athlete.slug, ...extra };
    }
    return {
      athleteId: athlete.athleteId,
      apiKey: athlete.apiKey,
      anthropicKey: athlete.anthropicKey,
      athleteName: athlete.name,
      ...extra,
    };
  }

  const runAnalysis = useCallback(async (force = false) => {
    if (!athlete.hasAI) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/daily-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildApiBody({ forceRefresh: force })),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DailyAnalysis = await res.json();
      data.generatedAt = new Date().toISOString();
      saveCache(data);
      saveActivityIds(athlete.slug, activities.map((a) => a.id));
      setAnalysis(data);
      setExpanded(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athlete.slug, athlete.hasAI, activities]);

  useEffect(() => {
    if (!athlete.hasAI) return;
    const cached = loadCached(athlete.slug);
    if (cached) setAnalysis(cached);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePush(mode: 'current_week' | 'week' | 'month') {
    setPushLoading(true);
    setPushResult(null);
    try {
      const res = await fetch('/api/push-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildApiBody({ mode })),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      const { added, skipped, weekLabels } = data as { added: number; skipped: number; weekLabels: string[] };
      const label = weekLabels?.join(', ') ?? '';
      if (added === 0) {
        setPushResult(`Ingen nye økter — ${skipped} allerede planlagt (${label})`);
      } else {
        setPushResult(`${added} økt${added !== 1 ? 'er' : ''} lagt til for ${label}${skipped > 0 ? ` (${skipped} hoppet over)` : ''}`);
        onRefresh();
      }
    } catch (e) {
      setPushResult(`Feil: ${String(e)}`);
    } finally {
      setPushLoading(false);
    }
  }

  async function handleAiPush(mode: 'week' | 'month' | 'current_week') {
    if (!athlete.hasAI) return;
    setPushLoading(true);
    setPushResult(null);
    setAiPushWorkouts(null);
    try {
      const res = await fetch('/api/ai-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildApiBody({ mode })),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setAiPushWorkouts(data.workouts ?? []);
      setAiPushLabel(data.periodLabel ?? '');
    } catch (e) {
      setPushResult(`Feil: ${String(e)}`);
    } finally {
      setPushLoading(false);
    }
  }

  async function handleAdaptWeek() {
    if (!analysis?.adaptSuggestion) return;
    setAdaptLoading(true);
    setAdaptResult(null);
    try {
      const res = await fetch('/api/quickactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildApiBody({ action: 'adapt_week', sport: analysis.adaptSuggestion })),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAdaptResult(data.text ?? '');
      onRefresh();
    } catch (e) {
      setAdaptResult(`Feil: ${String(e)}`);
    } finally {
      setAdaptLoading(false);
    }
  }

  const { color } = athlete;

  return (
    <div
      className="flex-1 flex flex-col rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${color}25`, backgroundColor: 'var(--surface)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ backgroundColor: `${color}12`, borderBottom: `1px solid ${color}18` }}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm" style={{ color }}>{athlete.name}</span>
        </div>
        {weather && (
          <span className="text-xs opacity-60 tabular-nums">
            {symbolToEmoji(weather.symbol)} {weather.temperature != null ? `${weather.temperature}°C` : '—'} · {weather.windspeed != null ? `${weather.windspeed} m/s` : '—'}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 px-3 py-3 gap-2 text-xs">

        {/* I GÅR */}
        <div style={{ minHeight: 48 }}>
          <span className="uppercase tracking-wider opacity-40" style={{ fontSize: 9 }}>I går</span>
          {yesterdayActs.length > 0 ? (
            <ul className="mt-0.5 space-y-0.5">
              {yesterdayActs.map((a, i) => (
                <li key={i} className="flex items-center gap-1 opacity-65">
                  <span className="flex-shrink-0">{sportIcon(a.type)}</span>
                  <span className="truncate font-medium" style={{ color }}>✓ {a.name}</span>
                  <span className="opacity-60 flex-shrink-0">· {fmtDur(a.moving_time)}</span>
                  {a.icu_training_load != null && (
                    <span className="opacity-60 flex-shrink-0">· {Math.round(a.icu_training_load)} TSS</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-0.5 opacity-40">Hviledag</p>
          )}
        </div>

        {/* I DAG */}
        <div style={{ minHeight: 48 }}>
          <span className="uppercase tracking-wider opacity-40" style={{ fontSize: 9 }}>I dag</span>
          <ul className="mt-0.5 space-y-1">
            {todayActivities.map((a, i) => (
              <li key={i}>
                <div className="flex items-center gap-1">
                  <span className="flex-shrink-0">{sportIcon(a.type)}</span>
                  <span className="truncate font-medium" style={{ color }}>✓ {a.name}</span>
                  <span className="opacity-50 flex-shrink-0">· {fmtDur(a.moving_time)}</span>
                  {a.icu_training_load != null && (
                    <span className="opacity-50 flex-shrink-0">· {Math.round(a.icu_training_load)} TSS</span>
                  )}
                  {athlete.hasAI && (analysis?.activitySummary || loading) && (
                    <button
                      onClick={() => setTodaySummaryExpanded((v) => !v)}
                      className="flex-shrink-0 opacity-40 hover:opacity-80 transition-opacity ml-1"
                      style={{ color }}
                    >
                      {todaySummaryExpanded ? '▴' : '▾'}
                    </button>
                  )}
                </div>
                {todaySummaryExpanded && (
                  <div className="mt-1 pl-4 space-y-1">
                    {loading && <p className="opacity-40 animate-pulse">Henter oppsummering...</p>}
                    {analysis?.activitySummary && !loading && (
                      <>
                        <p className="opacity-75 leading-snug">{analysis.activitySummary}</p>
                        {analysis.nutritionAdvice && (
                          <p className="opacity-60 leading-snug">🍽️ {analysis.nutritionAdvice}</p>
                        )}
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
            {todayEvents.filter((e) => !todayActivities.some((a) => a.type === e.type)).map((e, i) => (
              <li key={`ev-${i}`} className="flex items-center gap-1 opacity-60">
                <span className="flex-shrink-0">{sportIcon(e.type)}</span>
                <span className="truncate">{e.name}</span>
                {e.moving_time && (
                  <span className="opacity-60 flex-shrink-0">· {fmtDur(e.moving_time)}</span>
                )}
                {e.icu_training_load != null && (
                  <span className="opacity-60 flex-shrink-0">· {Math.round(e.icu_training_load)} TSS</span>
                )}
              </li>
            ))}
            {todayActivities.length === 0 && todayEvents.length === 0 && (
              <li className="opacity-40">Hviledag</li>
            )}
          </ul>
        </div>

        {/* NESTE ØKT */}
        <div style={{ minHeight: 36 }}>
          {nextEvent && (<>
            <span className="uppercase tracking-wider opacity-40" style={{ fontSize: 9 }}>Neste økt</span>
            <div className="mt-0.5 flex items-center gap-1 opacity-55">
              <span className="flex-shrink-0">{sportIcon(nextEvent.type)}</span>
              <span className="truncate">{nextEvent.name}</span>
              {nextEvent.moving_time && (
                <span className="opacity-60 flex-shrink-0">· {fmtDur(nextEvent.moving_time)}</span>
              )}
              {nextEvent.icu_training_load != null && (
                <span className="opacity-60 flex-shrink-0">· {Math.round(nextEvent.icu_training_load)} TSS</span>
              )}
              <span className="opacity-50 flex-shrink-0">· {fmtWeek(nextEvent.start_date_local.slice(0, 10))}</span>
            </div>
          </>)}
        </div>

        {/* Prestasjonsmodul — Efficiency Factor */}
        <EFModule activities={activities} color={color} />

        {/* Mangler AI-nøkkel */}
        {!athlete.hasAI && (
          <p className="opacity-50 leading-snug" style={{ fontSize: 10 }}>
            KI-funksjoner er deaktivert — legg til Anthropic-nøkkel i innstillinger.
          </p>
        )}

        {/* AI analyse */}
        {athlete.hasAI && (
          <div>
            <button
              onClick={() => {
                if (!expanded && !analysis) runAnalysis(false);
                setExpanded((v) => !v);
              }}
              className="flex items-baseline justify-between gap-1 w-full text-left hover:opacity-80 transition-opacity"
            >
              <span className="uppercase tracking-wider opacity-40" style={{ fontSize: 9 }}>
                Formstatus <span style={{ fontSize: 12 }}>{expanded ? '▾' : '▸'}</span>
              </span>
              {analysis?.weekType && (
                <span className="opacity-40 truncate" style={{ fontSize: 9 }}>
                  {analysis.weekTypeSource === 'ai' ? `Anbefalt: ${analysis.weekType}` : analysis.weekType}
                </span>
              )}
              {loading && !analysis && (
                <span className="opacity-30 animate-pulse" style={{ fontSize: 9 }}>analyserer...</span>
              )}
            </button>

            {expanded && !loading && analysis && (
              <div className="mt-1.5 space-y-1.5">
                <p className="opacity-65 leading-snug">{analysis.summary}</p>
                {analysis.weatherNote && (
                  <p className="opacity-65 leading-snug">🌧️ {analysis.weatherNote}</p>
                )}
                {analysis.adaptWeek && analysis.adaptSuggestion && (
                  <div
                    className="rounded-lg px-2.5 py-2 space-y-1.5"
                    style={{ backgroundColor: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.18)' }}
                  >
                    <p className="font-medium" style={{ color: '#b45309' }}>⚠️ {analysis.adaptSuggestion}</p>
                    {!adaptResult && (
                      <button
                        onClick={handleAdaptWeek}
                        disabled={adaptLoading}
                        className="text-xs px-2.5 py-1 rounded-md font-medium disabled:opacity-50"
                        style={{ backgroundColor: 'rgba(234,179,8,0.12)', color: '#b45309', border: '1px solid rgba(234,179,8,0.22)' }}
                      >
                        {adaptLoading ? 'Tilpasser...' : 'Tilpass uken'}
                      </button>
                    )}
                    {adaptResult && (
                      <p className="opacity-70 leading-snug">{adaptResult}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {loading && expanded && (
              <div className="mt-1.5 animate-pulse opacity-40 leading-snug">Henter analyse...</div>
            )}
          </div>
        )}

        {/* AI push-forslag (for brukere uten program) */}
        {aiPushWorkouts && (
          <AiPushPanel
            athlete={athlete}
            periodLabel={aiPushLabel}
            workouts={aiPushWorkouts}
            onClose={() => setAiPushWorkouts(null)}
            onAdded={onRefresh}
          />
        )}

        {error && (
          <p className="text-red-500 opacity-80">{error}</p>
        )}

        <div className="flex-1" />

        {/* Bunn: knapper */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Program-push (Mathias-stil) */}
          {athlete.hasProgram && (
            <>
              <button
                onClick={() => handlePush('current_week')}
                disabled={pushLoading}
                className="opacity-30 hover:opacity-70 transition-opacity disabled:opacity-20"
                style={{ fontSize: 9, color: 'var(--text-subtle)', letterSpacing: '0.04em' }}
              >
                {pushLoading ? '↑ pusher...' : '↑ Denne uken'}
              </button>
              <button
                onClick={() => handlePush('week')}
                disabled={pushLoading}
                className="opacity-30 hover:opacity-70 transition-opacity disabled:opacity-20"
                style={{ fontSize: 9, color: 'var(--text-subtle)', letterSpacing: '0.04em' }}
              >
                ↑ Neste uke
              </button>
              <button
                onClick={() => handlePush('month')}
                disabled={pushLoading}
                className="opacity-30 hover:opacity-70 transition-opacity disabled:opacity-20"
                style={{ fontSize: 9, color: 'var(--text-subtle)', letterSpacing: '0.04em' }}
              >
                ↑ Denne måneden
              </button>
            </>
          )}

          {/* KI-push (Karoline/andre uten program) */}
          {!athlete.hasProgram && athlete.hasAI && (
            <>
              <button
                onClick={() => handleAiPush('current_week')}
                disabled={pushLoading}
                className="opacity-30 hover:opacity-70 transition-opacity disabled:opacity-20"
                style={{ fontSize: 9, color: 'var(--text-subtle)', letterSpacing: '0.04em' }}
              >
                {pushLoading ? '↑ genererer...' : '↑ Generer plan: denne uken'}
              </button>
              <button
                onClick={() => handleAiPush('week')}
                disabled={pushLoading}
                className="opacity-30 hover:opacity-70 transition-opacity disabled:opacity-20"
                style={{ fontSize: 9, color: 'var(--text-subtle)', letterSpacing: '0.04em' }}
              >
                ↑ Generer plan: neste uke
              </button>
              <button
                onClick={() => handleAiPush('month')}
                disabled={pushLoading}
                className="opacity-30 hover:opacity-70 transition-opacity disabled:opacity-20"
                style={{ fontSize: 9, color: 'var(--text-subtle)', letterSpacing: '0.04em' }}
              >
                ↑ Generer plan: måned
              </button>
            </>
          )}
        </div>

        {pushResult && (
          <p className="opacity-60 leading-snug" style={{ fontSize: 10 }}>{pushResult}</p>
        )}
      </div>
    </div>
  );
}

// ─── DayModule ─────────────────────────────────────────────────────────────────

export function DayModule({
  config,
  mathiasActivities, mathiasEvents,
  karolineActivities, karolineEvents,
  customActivities, customEvents,
  weather, onRefresh,
}: DayModuleProps) {
  const isPreset = config.mode === 'preset';
  const hasAI = isPreset ? true : !!config.anthropicKey;

  const athletes: Array<{ info: AthleteInfo; activities: Activity[]; events: WorkoutEvent[] }> = isPreset
    ? [
        {
          info: { slug: 'mathias', name: 'Mathias', color: '#16a34a', hasProgram: true, hasAI: true },
          activities: mathiasActivities,
          events: mathiasEvents,
        },
        {
          info: { slug: 'karoline', name: 'Karoline', color: '#2563eb', hasProgram: false, hasAI: true },
          activities: karolineActivities,
          events: karolineEvents,
        },
      ]
    : [
        {
          info: {
            slug: config.athleteId,
            name: config.name,
            color: '#7c3aed',
            hasProgram: false,
            hasAI,
            anthropicKey: config.anthropicKey,
            athleteId: config.athleteId,
            apiKey: config.apiKey,
          },
          activities: customActivities,
          events: customEvents,
        },
      ];

  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <p className="text-xs uppercase tracking-wider opacity-30 mb-2.5" style={{ fontSize: 9 }}>Dagens oversikt</p>
      <div className="flex flex-col sm:flex-row gap-3">
        {athletes.map(({ info, activities, events }) => (
          <AthletePanel
            key={info.slug}
            athlete={info}
            activities={activities}
            events={events}
            weather={weather}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </div>
  );
}
