'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { Calendar } from '@/components/Calendar';
import { DayModule } from '@/components/DayModule';
import { WorkoutWizard, type SuccessBanner, type WorkoutPreview } from '@/components/WorkoutWizard';
import type { Activity, WorkoutEvent, WeatherData, WeatherForecast } from '@/lib/types';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function daysFromNowStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function fetchAthleteData(slug: 'mathias' | 'karoline') {
  const oldest = daysAgoStr(7);
  const newest = todayStr();
  const eventsNewest = daysFromNowStr(14);

  const [activitiesRes, eventsRes] = await Promise.allSettled([
    fetch(`/api/intervals?athlete=${slug}&type=activities&oldest=${oldest}&newest=${newest}&limit=50`, { cache: 'no-store' }).then((r) => r.json()),
    fetch(`/api/intervals?athlete=${slug}&type=events&oldest=${newest}&newest=${eventsNewest}`, { cache: 'no-store' }).then((r) => r.json()),
  ]);

  return {
    activities: (activitiesRes.status === 'fulfilled' ? activitiesRes.value : []) as Activity[],
    events: (eventsRes.status === 'fulfilled' ? eventsRes.value : []) as WorkoutEvent[],
  };
}

// ─── Success banner ───────────────────────────────────────────────────────────

function SuccessBannerView({ banner, onClose }: { banner: SuccessBanner; onClose: () => void }) {
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm"
      style={{ backgroundColor: `${banner.color}15`, border: `1px solid ${banner.color}30` }}
    >
      <span style={{ color: banner.color }}>✓ {banner.label}</span>
      <div className="flex items-center gap-3">
        <a
          href={banner.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 whitespace-nowrap"
          style={{ color: banner.color }}
        >
          Åpne i Intervals →
        </a>
        <button
          onClick={onClose}
          className="opacity-50 hover:opacity-100 transition-opacity"
          style={{ color: banner.color }}
          aria-label="Lukk"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── Calendar skeleton ────────────────────────────────────────────────────────

function CalendarSkeleton() {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', height: '180px' }}
    >
      <div className="h-full animate-pulse" style={{ backgroundColor: 'var(--bg)' }} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [mathiasActivities, setMathiasActivities] = useState<Activity[]>([]);
  const [mathiasEvents, setMathiasEvents] = useState<WorkoutEvent[]>([]);
  const [karolineActivities, setKarolineActivities] = useState<Activity[]>([]);
  const [karolineEvents, setKarolineEvents] = useState<WorkoutEvent[]>([]);
  const [calLoading, setCalLoading] = useState(true);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherForecast>({});
  const [success, setSuccess] = useState<SuccessBanner | null>(null);
  const [preview, setPreview] = useState<WorkoutPreview | null>(null);

  const refresh = useCallback(async () => {
    setCalLoading(true);
    const [m, k] = await Promise.all([
      fetchAthleteData('mathias'),
      fetchAthleteData('karoline'),
    ]);
    setMathiasActivities(m.activities);
    setMathiasEvents(m.events);
    setKarolineActivities(k.activities);
    setKarolineEvents(k.events);
    setCalLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    fetch('/api/weather').then((r) => r.json()).then((d) => {
      if (!d.error) {
        setWeather(d.today ?? null);
        setForecast(d.forecast ?? {});
      }
    }).catch(() => {});
  }, [refresh]);

  function handleSuccess(banner: SuccessBanner) {
    setSuccess(banner);
    setPreview(null);
    refresh();
  }

  return (
    <div className="space-y-4">
      {/* Day module */}
      <Suspense fallback={null}>
        <DayModule
          mathiasActivities={mathiasActivities}
          mathiasEvents={mathiasEvents}
          karolineActivities={karolineActivities}
          karolineEvents={karolineEvents}
          weather={weather}
          onRefresh={refresh}
        />
      </Suspense>

      {/* Calendar */}
      {calLoading ? (
        <CalendarSkeleton />
      ) : (
        <Calendar
          mathiasActivities={mathiasActivities}
          mathiasEvents={mathiasEvents}
          karolineActivities={karolineActivities}
          karolineEvents={karolineEvents}
          preview={preview}
          weather={weather}
          forecast={forecast}
          onRefresh={refresh}
        />
      )}

      {/* Success banner — mellom kalender og wizard */}
      {success && (
        <SuccessBannerView banner={success} onClose={() => setSuccess(null)} />
      )}

      {/* Wizard */}
      <div
        className="rounded-2xl px-6 py-6"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="max-w-xl">
          <WorkoutWizard onSuccess={handleSuccess} onPreview={setPreview} />
        </div>
      </div>
    </div>
  );
}
