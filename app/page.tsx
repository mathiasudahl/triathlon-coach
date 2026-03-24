'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar } from '@/components/Calendar';
import { DayModule } from '@/components/DayModule';
import { WorkoutWizard, type SuccessBanner, type WorkoutPreview } from '@/components/WorkoutWizard';
import type { Activity, WorkoutEvent, WeatherData, WeatherForecast, UserConfig } from '@/lib/types';
import type { OfflineWorkout } from '@/lib/offline-program';

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

async function fetchAthleteDataPreset(slug: 'mathias' | 'karoline') {
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

async function fetchAthleteDataCustom(config: UserConfig) {
  const oldest = daysAgoStr(7);
  const newest = todayStr();
  const eventsNewest = daysFromNowStr(14);

  const [activitiesRes, eventsRes] = await Promise.allSettled([
    fetch(`/api/intervals?athleteId=${encodeURIComponent(config.athleteId)}&apiKey=${encodeURIComponent(config.apiKey)}&type=activities&oldest=${oldest}&newest=${newest}&limit=50`, { cache: 'no-store' }).then((r) => r.json()),
    fetch(`/api/intervals?athleteId=${encodeURIComponent(config.athleteId)}&apiKey=${encodeURIComponent(config.apiKey)}&type=events&oldest=${newest}&newest=${eventsNewest}`, { cache: 'no-store' }).then((r) => r.json()),
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
  const router = useRouter();
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [ready, setReady] = useState(false);

  const [mathiasActivities, setMathiasActivities] = useState<Activity[]>([]);
  const [mathiasEvents, setMathiasEvents] = useState<WorkoutEvent[]>([]);
  const [karolineActivities, setKarolineActivities] = useState<Activity[]>([]);
  const [karolineEvents, setKarolineEvents] = useState<WorkoutEvent[]>([]);
  const [customActivities, setCustomActivities] = useState<Activity[]>([]);
  const [customEvents, setCustomEvents] = useState<WorkoutEvent[]>([]);
  const [calLoading, setCalLoading] = useState(true);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherForecast>({});
  const [success, setSuccess] = useState<SuccessBanner | null>(null);
  const [preview, setPreview] = useState<WorkoutPreview | null>(null);

  // Read config from localStorage
  useEffect(() => {
    const raw = localStorage.getItem('user-config');
    if (!raw) {
      router.push('/login');
      return;
    }
    try {
      setConfig(JSON.parse(raw));
    } catch {
      router.push('/login');
      return;
    }
    setReady(true);
  }, [router]);

  const refresh = useCallback(async () => {
    if (!config) return;
    setCalLoading(true);
    if (config.mode === 'preset') {
      const [m, k] = await Promise.all([
        fetchAthleteDataPreset('mathias'),
        fetchAthleteDataPreset('karoline'),
      ]);
      setMathiasActivities(m.activities);
      setMathiasEvents(m.events);
      setKarolineActivities(k.activities);
      setKarolineEvents(k.events);
    } else {
      const data = await fetchAthleteDataCustom(config);
      setCustomActivities(data.activities);
      setCustomEvents(data.events);
    }
    setCalLoading(false);
  }, [config]);

  useEffect(() => {
    if (!ready || !config) return;
    refresh();
    fetch('/api/weather').then((r) => r.json()).then((d) => {
      if (!d.error) {
        setWeather(d.today ?? null);
        setForecast(d.forecast ?? {});
      }
    }).catch(() => {});
  }, [ready, config, refresh]);

  async function handleAddOfflineWorkout(
    slug: 'mathias' | 'karoline',
    workout: OfflineWorkout,
    date: string,
    replace: boolean,
  ) {
    if (!config) return;
    const events = slug === 'mathias' ? mathiasEvents : karolineEvents;

    if (replace) {
      const ride = events.find(
        (e) => e.start_date_local.slice(0, 10) === date && e.type === 'Ride',
      );
      if (ride?.id) {
        await fetch('/api/events', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ athleteSlug: slug, eventId: ride.id }),
        });
      }
    }
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        athleteSlug: slug,
        event: {
          name: workout.name,
          start_date_local: `${date}T17:00:00`,
          type: 'Ride',
          category: 'WORKOUT',
          ...(workout.stravaUrl ? { description: `Strava: ${workout.stravaUrl}` } : {}),
        },
      }),
    });
    refresh();
  }

  function handleSuccess(banner: SuccessBanner) {
    setSuccess(banner);
    setPreview(null);
    refresh();
  }

  if (!ready || !config) return null;

  const isPreset = config.mode === 'preset';

  return (
    <div className="space-y-4">
      {/* Day module */}
      <Suspense fallback={null}>
        <DayModule
          config={config}
          mathiasActivities={mathiasActivities}
          mathiasEvents={mathiasEvents}
          karolineActivities={karolineActivities}
          karolineEvents={karolineEvents}
          customActivities={customActivities}
          customEvents={customEvents}
          weather={weather}
          onRefresh={refresh}
        />
      </Suspense>

      {/* Calendar */}
      {calLoading ? (
        <CalendarSkeleton />
      ) : isPreset ? (
        <Calendar
          mathiasActivities={mathiasActivities}
          mathiasEvents={mathiasEvents}
          karolineActivities={karolineActivities}
          karolineEvents={karolineEvents}
          preview={preview}
          weather={weather}
          forecast={forecast}
          onRefresh={refresh}
          onAddOfflineWorkout={handleAddOfflineWorkout}
        />
      ) : (
        <Calendar
          mathiasActivities={customActivities}
          mathiasEvents={customEvents}
          karolineActivities={[]}
          karolineEvents={[]}
          preview={preview}
          weather={weather}
          forecast={forecast}
          onRefresh={refresh}
          onAddOfflineWorkout={handleAddOfflineWorkout}
        />
      )}

      {/* Success banner */}
      {success && (
        <SuccessBannerView banner={success} onClose={() => setSuccess(null)} />
      )}

      {/* Wizard */}
      <div
        className="rounded-2xl px-6 py-6"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
      >
          <WorkoutWizard config={config} onSuccess={handleSuccess} onPreview={setPreview} />
      </div>
    </div>
  );
}
