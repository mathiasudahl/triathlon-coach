'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Activity, WorkoutEvent, DailyAnalysis, WeatherData } from '@/lib/types';

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
function getStoredActivityIds(slug: string): number[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(activityIdsKey(slug)) ?? '[]'); }
  catch { return []; }
}
function saveActivityIds(slug: string, ids: number[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(activityIdsKey(slug), JSON.stringify(ids));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SPORT_ICON: Record<string, string> = {
  Run: '🏃', Ride: '🚴', Swim: '🏊', WeightTraining: '🏋️',
  NordicSki: '⛷️', Rowing: '🚣', VirtualRide: '🚴', VirtualRun: '🏃',
};
function sportIcon(t: string) { return SPORT_ICON[t] ?? '⚡'; }

function weatherIcon(code: number): string {
  if (code <= 1) return '☀️';
  if (code <= 3) return '☁️';
  if (code <= 48) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '❄️';
  if (code <= 82) return '🌦️';
  if (code <= 86) return '🌨️';
  return '⛈️';
}

function fmtDur(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}t${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DayModuleProps {
  mathiasActivities: Activity[];
  mathiasEvents: WorkoutEvent[];
  karolineActivities: Activity[];
  karolineEvents: WorkoutEvent[];
  onRefresh: () => void;
}

// ─── Per-athlete panel ────────────────────────────────────────────────────────

interface AthletePanelProps {
  slug: 'mathias' | 'karoline';
  name: string;
  color: string;
  activities: Activity[];
  events: WorkoutEvent[];
  weather: WeatherData | null;
  onRefresh: () => void;
}

function AthletePanel({ slug, name, color, activities, events, weather, onRefresh }: AthletePanelProps) {
  const [analysis, setAnalysis] = useState<DailyAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [adaptLoading, setAdaptLoading] = useState(false);
  const [adaptResult, setAdaptResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);

  const today = todayStr();
  const yesterday = yesterdayStr();

  const todayEvents = events.filter((e) => e.start_date_local.slice(0, 10) === today);
  const yesterdayActs = activities.filter((a) => a.start_date_local.slice(0, 10) === yesterday);

  const runAnalysis = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/daily-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteSlug: slug, forceRefresh: force }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DailyAnalysis = await res.json();
      data.generatedAt = new Date().toISOString();
      saveCache(data);
      saveActivityIds(slug, activities.map((a) => a.id));
      setAnalysis(data);
      setExpanded(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [slug, activities]);

  useEffect(() => {
    const cached = loadCached(slug);
    if (cached) {
      setAnalysis(cached);
      const storedIds = getStoredActivityIds(slug);
      const hasNew = activities.some((a) => !storedIds.includes(a.id));
      if (hasNew) runAnalysis(false);
      return;
    }
    if (!isAfter06()) return;
    if (activities.length === 0) return;
    runAnalysis(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePush(mode: 'week' | 'month') {
    setPushLoading(true);
    setPushResult(null);
    try {
      const res = await fetch('/api/push-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteSlug: slug, mode }),
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

  async function handleAdaptWeek() {
    if (!analysis?.adaptSuggestion) return;
    setAdaptLoading(true);
    setAdaptResult(null);
    try {
      const res = await fetch('/api/quickactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteSlug: slug, action: 'adapt_week', sport: analysis.adaptSuggestion }),
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
          <span className="font-semibold text-sm" style={{ color }}>{name}</span>
          {analysis?.weekType && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${color}15`, color: `${color}cc` }}
            >
              {analysis.weekType}
            </span>
          )}
        </div>
        {weather && (
          <span className="text-xs opacity-60 tabular-nums">
            {weatherIcon(weather.weathercode)} {weather.temperature}°C · {weather.windspeed} m/s
          </span>
        )}
      </div>

      {/* Body — grows to fill equal height in flex row */}
      <div className="flex flex-col flex-1 px-3 py-3 gap-2 text-xs">

        {/* I GÅR */}
        <div>
          <span className="uppercase tracking-wider opacity-40" style={{ fontSize: 9 }}>I går</span>
          {yesterdayActs.length > 0 ? (
            <ul className="mt-0.5 space-y-0.5">
              {yesterdayActs.map((a, i) => (
                <li key={i} className="flex items-center gap-1 opacity-65">
                  <span className="flex-shrink-0">{sportIcon(a.type)}</span>
                  <span className="truncate">{a.name}</span>
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
        <div>
          <span className="uppercase tracking-wider opacity-40" style={{ fontSize: 9 }}>I dag</span>
          {todayEvents.length > 0 ? (
            <ul className="mt-0.5 space-y-0.5">
              {todayEvents.map((e, i) => (
                <li key={i} className="flex items-center gap-1">
                  <span className="flex-shrink-0">{sportIcon(e.type)}</span>
                  <span className="truncate font-medium">{e.name}</span>
                  {e.moving_time && (
                    <span className="opacity-50 flex-shrink-0">· {fmtDur(e.moving_time)}</span>
                  )}
                  {e.icu_training_load != null && (
                    <span className="opacity-50 flex-shrink-0">· {Math.round(e.icu_training_load)} TSS</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-0.5 opacity-40">Hviledag</p>
          )}
        </div>

        {/* AI analyse — collapsible */}
        {(analysis || loading) && (
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-left opacity-60 hover:opacity-90 transition-opacity"
              style={{ fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase' }}
            >
              <span style={{ color }}>▸</span>
              {loading ? 'Analyserer...' : `KI-analyse ${expanded ? '▴' : '▾'}`}
            </button>

            {expanded && !loading && analysis && (
              <div className="space-y-1.5">
                {/* Kosthold */}
                <p className="opacity-75 leading-snug">
                  🍽️ {analysis.nutritionAdvice}
                </p>

                {/* Sammendrag */}
                <p className="opacity-65 leading-snug">
                  {analysis.summary}
                </p>

                {/* Vær-merknad */}
                {analysis.weatherNote && (
                  <p className="opacity-65 leading-snug">
                    🌧️ {analysis.weatherNote}
                  </p>
                )}

                {/* Tilpass uken */}
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
              <div className="animate-pulse opacity-40 leading-snug">Henter analyse...</div>
            )}
          </div>
        )}

        {error && (
          <p className="text-red-500 opacity-80">{error}</p>
        )}

        {/* Spacer — pushes button to bottom */}
        <div className="flex-1" />

        {/* Bunn: analyser-knapp + push-knapper for Mathias */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => runAnalysis(true)}
            disabled={loading}
            className="opacity-30 hover:opacity-70 transition-opacity disabled:opacity-20"
            style={{ fontSize: 9, color: 'var(--text-subtle)', letterSpacing: '0.04em' }}
          >
            {loading ? '↻ analyserer...' : '↻ analyser på nytt'}
          </button>
          {slug === 'mathias' && (
            <>
              <button
                onClick={() => handlePush('week')}
                disabled={pushLoading}
                className="opacity-30 hover:opacity-70 transition-opacity disabled:opacity-20"
                style={{ fontSize: 9, color: 'var(--text-subtle)', letterSpacing: '0.04em' }}
              >
                {pushLoading ? '↑ pusher...' : '↑ push neste uke'}
              </button>
              <button
                onClick={() => handlePush('month')}
                disabled={pushLoading}
                className="opacity-30 hover:opacity-70 transition-opacity disabled:opacity-20"
                style={{ fontSize: 9, color: 'var(--text-subtle)', letterSpacing: '0.04em' }}
              >
                ↑ push neste måned
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
  mathiasActivities, mathiasEvents, karolineActivities, karolineEvents, onRefresh,
}: DayModuleProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetch('/api/weather')
      .then((r) => r.json())
      .then((d) => { if (!d.error) setWeather(d); })
      .catch(() => {});
  }, []);

  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <p className="text-xs uppercase tracking-wider opacity-30 mb-2.5" style={{ fontSize: 9 }}>Dagens oversikt</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <AthletePanel slug="mathias" name="Mathias" color="#16a34a"
          activities={mathiasActivities} events={mathiasEvents} weather={weather} onRefresh={onRefresh} />
        <AthletePanel slug="karoline" name="Karoline" color="#2563eb"
          activities={karolineActivities} events={karolineEvents} weather={weather} onRefresh={onRefresh} />
      </div>
    </div>
  );
}
