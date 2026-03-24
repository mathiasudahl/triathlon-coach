'use client';

import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { addDays, format, isToday, isBefore, startOfDay } from 'date-fns';
import { nb } from 'date-fns/locale';
import type { Activity, WorkoutEvent, WeatherData, WeatherForecast } from '@/lib/types';
import { getOfflineWorkout, type OfflineWorkout } from '@/lib/offline-program';

// ─── Sport metadata ───────────────────────────────────────────────────────────

const SPORT_ICON: Record<string, string> = {
  Run: '🏃', Ride: '🚴', Swim: '🏊', WeightTraining: '🏋️',
  NordicSki: '⛷️', Rowing: '🚣', VirtualRide: '🚴', VirtualRun: '🏃',
  Walk: '🚶', Hike: '🥾',
};
const SPORT_LABEL: Record<string, string> = {
  Run: 'Løp', Ride: 'Sykkel', Swim: 'Svøm', WeightTraining: 'Styrke',
  NordicSki: 'Ski', Rowing: 'Roing', VirtualRide: 'Virtuell sykkel',
  VirtualRun: 'Virtuell løp', Walk: 'Gåtur', Hike: 'Fjelltur',
};
function sportIcon(t: string) { return SPORT_ICON[t] ?? '⚡'; }
function sportLabel(t: string) { return SPORT_LABEL[t] ?? t; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}t ${m > 0 ? `${m}m` : ''}`.trim() : `${m}m`;
}
function formatDist(m: number) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
function shortName(n: string | undefined) {
  if (!n) return '—';
  return n.replace(/^(Zwift|Garmin|Wahoo|Polar)\s*[-–]\s*/i, '').trim();
}
function buildDays() {
  const now = new Date(), day = now.getDay();
  const monday = startOfDay(addDays(now, day === 0 ? -6 : 1 - day));
  return Array.from({ length: 14 }, (_, i) => addDays(monday, i));
}
const DAY_SHORT: Record<number, string> = { 0: 'man', 1: 'tir', 2: 'ons', 3: 'tor', 4: 'fre', 5: 'lør', 6: 'søn' };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CalendarProps {
  mathiasActivities: Activity[];
  mathiasEvents: WorkoutEvent[];
  karolineActivities: Activity[];
  karolineEvents: WorkoutEvent[];
  preview?: { workout: WorkoutEvent; athleteSlug: 'mathias' | 'karoline' } | null;
  weather?: WeatherData | null;
  forecast?: WeatherForecast;
  onRefresh: () => void;
  onAddOfflineWorkout: (athleteSlug: 'mathias' | 'karoline', workout: OfflineWorkout, date: string, replace: boolean) => Promise<void>;
}

interface ChipDetail {
  name: string; type: string; done: boolean; preview?: boolean;
  duration?: number; distance?: number; tss?: number;
  hr?: number; watts?: number; elevation?: number; intensity?: number;
  description?: string;
  indoor?: boolean;
}

interface WorkoutChip {
  icon: string; name: string; meta: string; done: boolean; preview?: boolean;
  eventId?: number;
  athleteSlug?: 'mathias' | 'karoline';
  offlineLogo?: boolean;
  detail: ChipDetail;
}

// ─── Drag state (module-level to avoid prop drilling) ─────────────────────────

interface DragState {
  eventId: number;
  athleteSlug: 'mathias' | 'karoline';
  originalDate: string;
}
let activeDrag: DragState | null = null;

// ─── Chip builder ─────────────────────────────────────────────────────────────

function getChips(
  date: Date, activities: Activity[], events: WorkoutEvent[],
  athleteSlug: 'mathias' | 'karoline', previewEvent?: WorkoutEvent | null
): WorkoutChip[] {
  const dateStr = format(date, 'yyyy-MM-dd');
  const dayActs = activities.filter((a) => a.start_date_local.slice(0, 10) === dateStr);
  const dayEvts = events.filter((e) => e.start_date_local.slice(0, 10) === dateStr);
  const chips: WorkoutChip[] = [];

  for (const a of dayActs) {
    const isIndoor = a.indoor_workout ?? a.trainer ?? null;
    const meta: string[] = [];
    if (a.moving_time) meta.push(formatDuration(a.moving_time));
    if (a.distance > 0) meta.push(formatDist(a.distance));
    if (a.icu_training_load) meta.push(`${Math.round(a.icu_training_load)} TSS`);
    if (isIndoor === true) meta.push('inne');
    else if (isIndoor === false) meta.push('ute');
    chips.push({
      icon: sportIcon(a.type), name: shortName(a.name), meta: meta.join(' · '), done: true,
      detail: {
        name: shortName(a.name), type: a.type, done: true,
        duration: a.moving_time, distance: a.distance > 0 ? a.distance : undefined,
        tss: a.icu_training_load ? Math.round(a.icu_training_load) : undefined,
        hr: a.average_heartrate ? Math.round(a.average_heartrate) : undefined,
        watts: a.average_watts ? Math.round(a.average_watts) : undefined,
        elevation: a.total_elevation_gain ? Math.round(a.total_elevation_gain) : undefined,
        intensity: a.icu_intensity,
        indoor: isIndoor === null ? undefined : isIndoor,
      },
    });
  }

  for (const e of dayEvts) {
    if (dayActs.some((a) => a.type === e.type)) continue;
    const isIndoor = e.indoor_workout ?? null;
    const meta: string[] = [];
    if (e.moving_time) meta.push(formatDuration(e.moving_time));
    if (e.icu_training_load) meta.push(`${Math.round(e.icu_training_load)} TSS`);
    if (isIndoor === true) meta.push('inne');
    else if (isIndoor === false) meta.push('ute');
    const isOffline = !!e.description?.startsWith('Strava: https://www.strava.com');
    chips.push({
      icon: sportIcon(e.type), name: shortName(e.name), meta: meta.join(' · '), done: false,
      eventId: e.id, athleteSlug,
      offlineLogo: isOffline,
      detail: {
        name: shortName(e.name), type: e.type, done: false,
        duration: e.moving_time, tss: e.icu_training_load ? Math.round(e.icu_training_load) : undefined,
        description: e.description,
        indoor: isIndoor === null ? undefined : isIndoor,
      },
    });
  }

  if (previewEvent && previewEvent.start_date_local.slice(0, 10) === dateStr) {
    const meta: string[] = [];
    if (previewEvent.moving_time) meta.push(formatDuration(previewEvent.moving_time));
    if (previewEvent.icu_training_load) meta.push(`${Math.round(previewEvent.icu_training_load)} TSS`);
    chips.push({
      icon: sportIcon(previewEvent.type), name: shortName(previewEvent.name),
      meta: meta.join(' · '), done: false, preview: true,
      detail: {
        name: shortName(previewEvent.name), type: previewEvent.type, done: false, preview: true,
        duration: previewEvent.moving_time,
        tss: previewEvent.icu_training_load ? Math.round(previewEvent.icu_training_load) : undefined,
        description: previewEvent.description,
      },
    });
  }

  return chips;
}

// ─── Tooltip portal ───────────────────────────────────────────────────────────

const TOOLTIP_WIDTH = 268;

interface SavePayload { name: string; date: string; durationMin: number | null; tss: number | null; description: string | null; }

function hasIntervals(description: string | undefined): boolean {
  if (!description) return false;
  return /\d+x/i.test(description);
}

// anchorY = top edge of chip (pixels from top of document) — popup renders above chip
function TooltipPortal({ detail, eventDate, eventId, athleteSlug, color, anchorX, anchorY, canEdit, onMouseEnter, onMouseLeave, onDelete, onSave, deleting }: {
  detail: ChipDetail; eventDate: string; eventId?: number; athleteSlug?: string;
  color: string; anchorX: number; anchorY: number;
  canEdit: boolean;
  onMouseEnter: () => void; onMouseLeave: () => void;
  onDelete: () => void; onSave: (p: SavePayload) => void; deleting: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(detail.name);
  const [editDate, setEditDate] = useState(eventDate);
  const [editDur, setEditDur] = useState(detail.duration ? String(Math.round(detail.duration / 60)) : '');
  const [editTss, setEditTss] = useState(detail.tss ? String(detail.tss) : '');
  const [editDesc, setEditDesc] = useState(detail.description ?? '');
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const withIntervals = hasIntervals(detail.description);

  const rows: { label: string; value: string }[] = [];
  if (detail.duration) rows.push({ label: 'Varighet', value: formatDuration(detail.duration) });
  if (detail.distance) rows.push({ label: 'Distanse', value: formatDist(detail.distance) });
  if (detail.tss) rows.push({ label: 'TSS', value: String(detail.tss) });
  if (detail.hr) rows.push({ label: 'Puls (snitt)', value: `${detail.hr} bpm` });
  if (detail.watts) rows.push({ label: 'Watt (snitt)', value: `${detail.watts} W` });
  if (detail.elevation) rows.push({ label: 'Høydemeter', value: `${detail.elevation} m` });
  if (detail.intensity) {
    const pct = detail.intensity > 2 ? Math.round(detail.intensity) : Math.round(detail.intensity * 100);
    rows.push({ label: 'Intensitet', value: `${pct}%` });
  }
  if (detail.indoor !== undefined) rows.push({ label: 'Lokasjon', value: detail.indoor ? 'Inne' : 'Ute' });

  // Clamp left so popup stays within viewport; prefer centered on chip
  const left = Math.max(8, Math.min(anchorX - TOOLTIP_WIDTH / 2, window.innerWidth - TOOLTIP_WIDTH - 8));
  // Render below chip if too close to top of viewport
  const spaceAbove = anchorY - window.scrollY;
  const renderBelow = spaceAbove < 260;

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '3px 6px', borderRadius: 5, fontSize: 11,
    backgroundColor: 'var(--bg)', border: '1px solid var(--border)',
    color: 'var(--text)', outline: 'none',
  };

  async function handleSave() {
    setSaving(true);
    await onSave({
      name: editName,
      date: editDate,
      durationMin: editDur ? Number(editDur) : null,
      tss: editTss ? Number(editTss) : null,
      description: editDesc || null,
    });
    setSaving(false);
    setEditing(false);
  }

  async function handleQuickAction(action: 'add-intervals' | 'more-intervals' | 'longer-blocks' | 'extend') {
    setAiLoading(true);
    setAiError(null);

    const config = typeof window !== 'undefined' ? (() => { try { return JSON.parse(localStorage.getItem('user-config') ?? '{}'); } catch { return {}; } })() : {};
    const isPreset = config.mode === 'preset';

    const sport = detail.type;
    const desc = detail.description ?? `- ${editDur || 60}m rolig`;
    const suffix = `\n\nSport: ${sport}\nNåværende øktbeskrivelse:\n${desc}\n\nBruk workout-builder-syntaks tilpasset sporten og utøverens intensitetssoner. Returner BARE den oppdaterte workout-builder-teksten, ingen forklaring, ingen markdown.`;

    const actionPrompts: Record<string, string> = {
      'add-intervals': `Analyser ukesplanen og dagsformen ovenfor. Legg til én intervallblokk i økten som passer treningsbelastningen denne uka (f.eks. ikke for hard om TSB er lav). Velg antall repetisjoner, varighet og intensitet basert på sport og uke. Behold eksisterende oppvarming og nedkjøling.${suffix}`,
      'more-intervals': `Analyser ukesplanen og dagsformen ovenfor. Legg til én ekstra repetisjonsrunde i intervallblokkene om belastningen denne uka tillater det. Juster intensitet om nødvendig.${suffix}`,
      'longer-blocks': `Analyser ukesplanen og dagsformen ovenfor. Øk varigheten på hvert intervall med ca. 20% om den totale ukesbelastningen tillater det. Rund til nærmeste hele minutt eller 30 sek.${suffix}`,
      'extend': `Analyser ukesplanen og dagsformen ovenfor. Forleng økten med 15–20 minutter rolig arbeid (tilpasset sport og intensitetssoner) om belastningen denne uka tillater det. Behold eksisterende struktur.${suffix}`,
    };

    const body = isPreset
      ? { athleteSlug: athleteSlug ?? 'mathias', action: 'edit_workout', sport: detail.type }
      : { athleteId: config.athleteId, apiKey: config.apiKey, anthropicKey: config.anthropicKey, athleteName: config.name, action: 'edit_workout', sport: detail.type };

    try {
      const res = await fetch('/api/quickactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, customPrompt: actionPrompts[action] }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text: string = data.text ?? '';
      // Strip any accidental markdown fences
      const clean = text.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
      setEditDesc(clean);
      setEditing(true);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Feil');
    } finally {
      setAiLoading(false);
    }
  }

  return createPortal(
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'absolute',
        top: renderBelow ? anchorY + CELL_HEIGHT + 4 : anchorY - 4,
        transform: renderBelow ? undefined : 'translateY(-100%)',
        left,
        width: TOOLTIP_WIDTH,
        zIndex: 9999,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'var(--surface)',
        border: `1px solid ${color}30`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.18), 0 0 0 1px ${color}15`,
        fontSize: 11,
      }}
    >
      {/* Header */}
      <div style={{ backgroundColor: `${color}12`, borderBottom: `1px solid ${color}20`, padding: '8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span>{sportIcon(detail.type)}</span>
            <span style={{ fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail.name}</span>
          </div>
          {canEdit && (
            <button
              onClick={() => setEditing((v) => !v)}
              style={{ flexShrink: 0, fontSize: 10, color, opacity: 0.7, background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
            >
              {editing ? 'Lukk' : 'Rediger'}
            </button>
          )}
        </div>
        <div style={{ marginTop: 3, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ backgroundColor: `${color}20`, color, fontSize: 9, padding: '1px 6px', borderRadius: 999, fontWeight: 500 }}>
            {sportLabel(detail.type)}
          </span>
          {detail.preview && <span style={{ color, fontSize: 9 }}>✦ Forslag</span>}
          {detail.done && <span style={{ color, fontSize: 9 }}>✓ Gjennomført</span>}
          {!detail.done && !detail.preview && <span style={{ color: 'var(--text-subtle)', fontSize: 9 }}>Planlagt</span>}
        </div>
      </div>

      {/* Edit form — inline, no layout shift */}
      {editing && (
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6, borderBottom: `1px solid ${color}15` }}>
          <div>
            <div style={{ color: 'var(--text-subtle)', fontSize: 9, marginBottom: 2 }}>Navn</div>
            <input style={inputStyle} value={editName} onChange={e => setEditName(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.8fr', gap: 6, alignItems: 'end' }}>
            <div>
              <div style={{ color: 'var(--text-subtle)', fontSize: 9, marginBottom: 2 }}>Dato</div>
              <input style={inputStyle} type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
            </div>
            <div>
              <div style={{ color: 'var(--text-subtle)', fontSize: 9, marginBottom: 2 }}>Varighet (min)</div>
              <input style={inputStyle} type="number" min="1" value={editDur} onChange={e => setEditDur(e.target.value)} />
            </div>
            <div>
              <div style={{ color: 'var(--text-subtle)', fontSize: 9, marginBottom: 2 }}>TSS</div>
              <input style={inputStyle} type="number" min="0" value={editTss} onChange={e => setEditTss(e.target.value)} />
            </div>
          </div>
          <div>
            <div style={{ color: 'var(--text-subtle)', fontSize: 9, marginBottom: 2 }}>Øktstruktur</div>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 80, fontFamily: 'monospace', lineHeight: 1.5 }}
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              placeholder="Workout-builder-syntaks…"
            />
          </div>

          {/* KI hurtighandlinger */}
          <div>
            <div style={{ color: 'var(--text-subtle)', fontSize: 9, marginBottom: 4 }}>KI-justeringer</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {withIntervals ? (
                <>
                  <button onClick={() => handleQuickAction('more-intervals')} disabled={aiLoading}
                    style={{ fontSize: 9, padding: '3px 8px', borderRadius: 5, cursor: aiLoading ? 'not-allowed' : 'pointer', backgroundColor: `${color}12`, color, border: `1px solid ${color}25`, opacity: aiLoading ? 0.5 : 1 }}>
                    + Én runde til
                  </button>
                  <button onClick={() => handleQuickAction('longer-blocks')} disabled={aiLoading}
                    style={{ fontSize: 9, padding: '3px 8px', borderRadius: 5, cursor: aiLoading ? 'not-allowed' : 'pointer', backgroundColor: `${color}12`, color, border: `1px solid ${color}25`, opacity: aiLoading ? 0.5 : 1 }}>
                    Lengre intervaller
                  </button>
                  <button onClick={() => handleQuickAction('add-intervals')} disabled={aiLoading}
                    style={{ fontSize: 9, padding: '3px 8px', borderRadius: 5, cursor: aiLoading ? 'not-allowed' : 'pointer', backgroundColor: `${color}12`, color, border: `1px solid ${color}25`, opacity: aiLoading ? 0.5 : 1 }}>
                    + Ny intervallblokk
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => handleQuickAction('extend')} disabled={aiLoading}
                    style={{ fontSize: 9, padding: '3px 8px', borderRadius: 5, cursor: aiLoading ? 'not-allowed' : 'pointer', backgroundColor: `${color}12`, color, border: `1px solid ${color}25`, opacity: aiLoading ? 0.5 : 1 }}>
                    Forleng økten
                  </button>
                  <button onClick={() => handleQuickAction('add-intervals')} disabled={aiLoading}
                    style={{ fontSize: 9, padding: '3px 8px', borderRadius: 5, cursor: aiLoading ? 'not-allowed' : 'pointer', backgroundColor: `${color}12`, color, border: `1px solid ${color}25`, opacity: aiLoading ? 0.5 : 1 }}>
                    + Legg til intervaller
                  </button>
                </>
              )}
            </div>
            {aiLoading && <div style={{ fontSize: 9, color: 'var(--text-subtle)', marginTop: 4 }}>KI justerer…</div>}
            {aiError && <div style={{ fontSize: 9, color: '#dc2626', marginTop: 4 }}>{aiError}</div>}
          </div>

          <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 500,
                backgroundColor: `${color}18`, color, border: `1px solid ${color}30`,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? 'Lagrer…' : 'Lagre'}
            </button>
            <button
              onClick={() => setEditing(false)}
              style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 11,
                backgroundColor: 'var(--bg)', color: 'var(--text-subtle)',
                border: '1px solid var(--border)', cursor: 'pointer',
              }}
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Stats — always visible */}
      {rows.length > 0 && (
        <div style={{ padding: '8px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
          {rows.map((r) => (
            <div key={r.label}>
              <div style={{ color: 'var(--text-subtle)', fontSize: 9 }}>{r.label}</div>
              <div style={{ color: 'var(--text)', fontSize: 11, fontWeight: 600 }}>{r.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Description — always visible when not editing */}
      {!editing && detail.description && (
        <div style={{ borderTop: `1px solid ${color}15`, padding: '8px 12px' }}>
          <div style={{ color: 'var(--text-subtle)', fontSize: 9, marginBottom: 3 }}>Øktstruktur</div>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: 'var(--text)', fontSize: 9, lineHeight: 1.5, margin: 0 }}>
            {detail.description}
          </pre>
        </div>
      )}

      {/* Slett */}
      {canEdit && (
        <div style={{ borderTop: `1px solid ${color}15`, padding: '8px 12px', display: 'flex', gap: 6 }}>
          <button
            onClick={onDelete}
            disabled={deleting}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, fontWeight: 500,
              backgroundColor: '#dc262610', color: '#dc2626',
              border: '1px solid #dc262625', cursor: deleting ? 'not-allowed' : 'pointer',
              opacity: deleting ? 0.6 : 1,
            }}
          >
            {deleting ? 'Sletter…' : 'Slett økt'}
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

const CELL_HEIGHT = 52;

function Chip({ chip, color, date, onDelete, onRefresh }: {
  chip: WorkoutChip; color: string; date: string;
  onDelete: (eventId: number, athleteSlug: 'mathias' | 'karoline') => void;
  onRefresh: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canEdit = !chip.done && !chip.preview && chip.eventId !== undefined;

  const scheduleHide = useCallback(() => {
    hideTimer.current = setTimeout(() => {
      setOpen(false);
      setTooltipPos(null);
    }, 120);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
  }, []);

  function handleChipMouseEnter() {
    cancelHide();
    setOpen(true);
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    // anchorY = top of chip so popup appears just above it
    setTooltipPos({ x: r.left + r.width / 2, y: r.top + window.scrollY });
  }

  async function handleDelete() {
    if (!chip.eventId || !chip.athleteSlug) return;
    setDeleting(true);
    try {
      await fetch('/api/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteSlug: chip.athleteSlug, eventId: chip.eventId }),
      });
      onDelete(chip.eventId, chip.athleteSlug);
      onRefresh();
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave(p: SavePayload) {
    if (!chip.eventId || !chip.athleteSlug) return;
    const update: Record<string, unknown> = { name: p.name };
    if (p.date) update.start_date_local = `${p.date}T09:00:00`;
    if (p.durationMin !== null) update.moving_time = p.durationMin * 60;
    if (p.tss !== null) update.icu_training_load = p.tss;
    if (p.description !== null) update.description = p.description;
    await fetch('/api/events', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ athleteSlug: chip.athleteSlug, eventId: chip.eventId, event: update }),
    });
    setOpen(false);
    setTooltipPos(null);
    onRefresh();
  }

  function handleDragStart(e: React.DragEvent) {
    if (!chip.eventId || !chip.athleteSlug) return;
    activeDrag = { eventId: chip.eventId, athleteSlug: chip.athleteSlug, originalDate: '' };
    e.dataTransfer.effectAllowed = 'move';
    setOpen(false);
    setTooltipPos(null);
    setTimeout(() => { if (ref.current) ref.current.style.opacity = '0.4'; }, 0);
  }

  function handleDragEnd() {
    if (ref.current) ref.current.style.opacity = '1';
    activeDrag = null;
  }

  return (
    <div
      ref={ref}
      style={{ height: CELL_HEIGHT, position: 'relative' }}
      draggable={canEdit}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={handleChipMouseEnter}
      onMouseLeave={scheduleHide}
    >
      {/* Chip body */}
      <div style={{
        borderRadius: 6, paddingLeft: 6, paddingRight: 6, paddingTop: 4, paddingBottom: 4,
        height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start',
        cursor: canEdit ? 'grab' : 'default',
        backgroundColor: chip.preview ? 'transparent' : chip.done ? `${color}18` : `${color}0d`,
        borderLeft: `2px ${chip.preview ? 'dashed' : 'solid'} ${chip.done ? color : color + '55'}`,
        opacity: chip.preview ? 0.75 : 1,
        outline: chip.preview ? `1px dashed ${color}35` : undefined,
        transition: 'filter 0.1s',
        filter: open && canEdit ? 'brightness(1.05)' : undefined,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 2, minWidth: 0 }}>
          {chip.offlineLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/offline-logo.png" alt="" style={{ width: 13, marginTop: 1, flexShrink: 0, opacity: 0.5, filter: 'sepia(1) saturate(0.5) hue-rotate(75deg) brightness(0.4)' }} />
          ) : (
            <span style={{ fontSize: 10, flexShrink: 0, lineHeight: 1.4 }}>{chip.icon}</span>
          )}
          <span style={{
            fontSize: 10, lineHeight: 1.3, fontWeight: 500,
            color: chip.done ? color : chip.preview ? color : 'var(--text)',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {chip.preview ? `✦ ${chip.name}` : chip.name}
          </span>
        </div>
        {chip.meta && (
          <div style={{ color: 'var(--text-subtle)', fontSize: 9, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {chip.meta}
          </div>
        )}
        {/* Drag hint */}
        {canEdit && open && (
          <div style={{ position: 'absolute', top: 3, right: 3, fontSize: 8, color: `${color}80`, lineHeight: 1, pointerEvents: 'none', userSelect: 'none' }}>
            ⠿
          </div>
        )}
      </div>

      {/* Popup */}
      {open && tooltipPos && (
        <TooltipPortal
          detail={chip.detail}
          eventDate={date}
          color={color}
          anchorX={tooltipPos.x}
          anchorY={tooltipPos.y}
          canEdit={canEdit}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          onDelete={handleDelete}
          onSave={handleSave}
          deleting={deleting}
        />
      )}
    </div>
  );
}

// ─── Day column ───────────────────────────────────────────────────────────────

const SLOTS = 3;

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

function DayCol({ date, chips, color, isWeekStart, weather, showWeather, onRefresh }: {
  date: Date; chips: WorkoutChip[]; color: string; isWeekStart: boolean;
  weather?: WeatherData | null; showWeather?: boolean; onRefresh: () => void;
}) {
  const today = isToday(date);
  const past = isBefore(date, startOfDay(new Date())) && !today;
  const dayOfWeek = (date.getDay() + 6) % 7;
  const [dragOver, setDragOver] = useState(false);
  const [moving, setMoving] = useState(false);
  const slots = Array.from({ length: Math.max(SLOTS, chips.length) });

  function handleDragOver(e: React.DragEvent) {
    if (!activeDrag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (!activeDrag) return;
    const targetDate = format(date, "yyyy-MM-dd") + 'T09:00:00';
    setMoving(true);
    try {
      await fetch('/api/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athleteSlug: activeDrag.athleteSlug,
          eventId: activeDrag.eventId,
          event: { start_date_local: targetDate },
        }),
      });
      onRefresh();
    } finally {
      setMoving(false);
      activeDrag = null;
    }
  }

  function handleDelete(eventId: number, slug: 'mathias' | 'karoline') {
    // Optimistic: refresh is called by Chip after API
    void eventId; void slug;
  }

  return (
    <div
      className="flex flex-col"
      style={{
        borderLeft: isWeekStart ? '2px solid var(--border)' : '1px solid var(--border)',
        backgroundColor: dragOver ? `${color}10` : today ? `${color}06` : 'transparent',
        outline: dragOver ? `2px dashed ${color}60` : undefined,
        outlineOffset: -2,
        transition: 'background-color 0.1s',
      }}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header — fixed height so both athlete rows are identical */}
      <div
        className="px-2 py-1.5 text-center border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)', backgroundColor: today ? `${color}10` : 'transparent', height: 52 }}
      >
        <div style={{ color: today ? color : 'var(--text-subtle)', fontSize: 10, fontWeight: 500 }}>
          {DAY_SHORT[dayOfWeek]}
        </div>
        <div style={{ color: today ? color : 'var(--text-subtle)', fontSize: 11, fontWeight: today ? 700 : 500 }}>
          {format(date, 'd', { locale: nb })}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-subtle)', marginTop: 1, lineHeight: 1.2, height: 13 }}>
          {showWeather && weather && weather.temperature != null ? `${symbolToEmoji(weather.symbol)}${weather.temperature}°` : ''}
        </div>
      </div>

      {/* Slots */}
      <div className="flex flex-col gap-1 p-1.5 flex-1" style={{ opacity: moving ? 0.5 : 1, minHeight: SLOTS * (CELL_HEIGHT + 4) }}>
        {slots.map((_, i) => {
          const chip = chips[i];
          if (!chip) return (
            <div key={i} style={{ height: CELL_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {i === 0 && past && <span style={{ color: 'var(--border)', fontSize: 10 }}>—</span>}
            </div>
          );
          return (
            <Chip key={chip.eventId ?? `${chip.name}-${i}`} chip={chip} color={color} date={format(date, 'yyyy-MM-dd')} onDelete={handleDelete} onRefresh={onRefresh} />
          );
        })}
        {/* Drop hint when dragging over empty area */}
        {dragOver && (
          <div style={{
            height: CELL_HEIGHT, borderRadius: 6, border: `2px dashed ${color}50`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 9, color: `${color}80` }}>Slipp her</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Athlete row ──────────────────────────────────────────────────────────────

function AthleteRow({ name, color, days, activities, events, previewEvent, borderBottom, forecast, showWeatherRow, onRefresh, athleteSlug }: {
  name: string; color: string; days: Date[];
  activities: Activity[]; events: WorkoutEvent[];
  previewEvent?: WorkoutEvent | null; borderBottom?: boolean;
  forecast?: WeatherForecast;
  showWeatherRow?: boolean;
  onRefresh: () => void; athleteSlug: 'mathias' | 'karoline';
}) {
  return (
    <div className="flex" style={{ borderBottom: borderBottom ? '1px solid var(--border)' : undefined }}>
      <div style={{
        color, fontSize: 11, writingMode: 'vertical-rl', transform: 'rotate(180deg)',
        width: 28, flexShrink: 0, fontWeight: 600,
        borderRight: '1px solid var(--border)', padding: '8px 4px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {name}
      </div>
      <div className="grid flex-1" style={{ gridTemplateColumns: 'repeat(14, minmax(72px, 1fr))' }}>
        {days.map((date, i) => {
          const dow = (date.getDay() + 6) % 7;
          const dateStr = format(date, 'yyyy-MM-dd');
          const dayWeather = forecast?.[dateStr] ?? null;
          const past = isBefore(date, startOfDay(new Date())) && !isToday(date);
          return (
            <DayCol
              key={i}
              date={date}
              chips={getChips(date, activities, events, athleteSlug, previewEvent)}
              color={color}
              isWeekStart={dow === 0 && i > 0}
              weather={dayWeather}
              showWeather={showWeatherRow && !past}
              onRefresh={onRefresh}
            />
          );
        })}
      </div>
    </div>
  );
}

// ─── Offline row ──────────────────────────────────────────────────────────────

const OFFLINE_COLOR = '#2d3a2e';

function OfflineCell({ date, onAdd }: {
  date: Date;
  onAdd: (slug: 'mathias' | 'karoline', workout: OfflineWorkout, date: string, replace: boolean) => Promise<void>;
}) {
  const workout = getOfflineWorkout(date);
  const [hovered, setHovered] = useState(false);
  const [step, setStep] = useState<null | 'add' | 'replace'>(null);
  const [loading, setLoading] = useState(false);

  const today = isToday(date);
  const past = isBefore(date, startOfDay(new Date())) && !today;
  const dateStr = format(date, 'yyyy-MM-dd');
  const dayOfWeek = (date.getDay() + 6) % 7;
  const isWeekStart = dayOfWeek === 0;

  async function handlePick(slug: 'mathias' | 'karoline') {
    if (!workout || !step) return;
    setLoading(true);
    try {
      await onAdd(slug, workout, dateStr, step === 'replace');
    } finally {
      setLoading(false);
      setStep(null);
    }
  }

  // Past or no workout: cross-hatch cell
  if (past || !workout) {
    return (
      <div style={{
        borderLeft: isWeekStart ? '2px solid var(--border)' : '1px solid var(--border)',
        minHeight: 56,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: 'transparent',
      }}>
        {/* Subtle diagonal grid lines */}
        <svg
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.13 }}
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke={OFFLINE_COLOR} strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#hatch)" />
        </svg>
      </div>
    );
  }

  // Shared hatch pattern id — unique per cell to avoid SVG id collisions
  const hatchId = `hatch-action-${dateStr}`;

  const hatchUrl = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='5' height='5'%3E%3Cdefs%3E%3Cpattern id='h' width='5' height='5' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'%3E%3Cline x1='0' y1='0' x2='0' y2='5' stroke='%232d3a2e' stroke-width='0.8' stroke-opacity='0.22'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='5' height='5' fill='url(%23h)'/%3E%3C/svg%3E")`;

  return (
    <div
      style={{
        borderLeft: isWeekStart ? '2px solid var(--border)' : '1px solid var(--border)',
        minHeight: 56,
        position: 'relative',
        cursor: 'default',
        backgroundColor: hovered ? `${OFFLINE_COLOR}16` : `${OFFLINE_COLOR}0a`,
        transition: 'background-color 0.12s',
        display: 'flex',
        flexDirection: 'column',
        padding: '6px 6px 5px',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setStep(null); }}
      onKeyDown={(e) => e.key === 'Escape' && setStep(null)}
    >
      {/* Left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
        backgroundColor: OFFLINE_COLOR, opacity: today ? 1 : 0.45,
      }} />

      {/* Top: logo, then name on new line */}
      <div style={{ display: 'flex', flexDirection: 'column', paddingLeft: 4, flex: '0 0 auto', gap: 3 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/offline-logo.png"
          alt=""
          style={{ width: 22, flexShrink: 0, opacity: 0.5, filter: 'sepia(1) saturate(0.5) hue-rotate(75deg) brightness(0.4)' }}
        />
        <div style={{
          fontSize: 10, fontWeight: 600, color: OFFLINE_COLOR,
          lineHeight: 1.25,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {workout.name}
        </div>
      </div>

      {/* Strava link — always visible */}
      {workout.stravaUrl && (
        <a
          href={workout.stravaUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{
            fontSize: 8, color: `${OFFLINE_COLOR}50`, textDecoration: 'none',
            paddingLeft: 4, letterSpacing: '0.02em', flex: '0 0 auto', marginTop: 2,
          }}
        >
          strava ↗
        </a>
      )}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Hover actions — fill remaining height */}
      {hovered && !step && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: '0 0 auto', marginTop: 4 }}>
          {(['add', 'replace'] as const).map((action) => (
            <button
              key={action}
              onClick={() => setStep(action)}
              style={{
                width: '100%', fontSize: 9, padding: '4px 0', borderRadius: 0, cursor: 'pointer',
                backgroundImage: hatchUrl,
                backgroundColor: 'transparent',
                color: OFFLINE_COLOR, border: 'none', fontWeight: 600,
              }}
            >
              {action === 'add' ? '+ Legg til' : '⇄ Erstatt'}
            </button>
          ))}
        </div>
      )}

      {/* Person picker — two big round buttons filling full width, no label */}
      {step && (
        <div style={{ display: 'flex', gap: 4, flex: '0 0 auto', marginTop: 4 }}>
          {(['mathias', 'karoline'] as const).map((slug) => {
            const c = slug === 'mathias' ? '#16a34a' : '#2563eb';
            const hatchUrlAthlete = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='5' height='5'%3E%3Cdefs%3E%3Cpattern id='h' width='5' height='5' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'%3E%3Cline x1='0' y1='0' x2='0' y2='5' stroke='${encodeURIComponent(c)}' stroke-width='0.9' stroke-opacity='0.3'/%3E%3C/pattern%3E%3C/defs%3E%3Crect width='5' height='5' fill='url(%23h)'/%3E%3C/svg%3E")`;
            return (
              <button
                key={slug}
                disabled={loading}
                onClick={() => handlePick(slug)}
                title={slug.charAt(0).toUpperCase() + slug.slice(1)}
                style={{
                  flex: 1, aspectRatio: '1', borderRadius: '50%', fontSize: 9, fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  backgroundImage: hatchUrlAthlete,
                  backgroundColor: 'transparent',
                  color: c, border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {slug === 'mathias' ? 'M' : 'K'}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OfflineRow({ days, onAdd }: {
  days: Date[];
  onAdd: (slug: 'mathias' | 'karoline', workout: OfflineWorkout, date: string, replace: boolean) => Promise<void>;
}) {
  return (
    <div className="flex">
      {/* Label column */}
      <div style={{
        width: 28, flexShrink: 0,
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 4px',
      }}>
        {/* Logo — top */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/offline-logo.png"
          alt="Offline"
          style={{ width: 16, opacity: 0.5, filter: 'sepia(1) saturate(0.5) hue-rotate(75deg) brightness(0.4)', marginBottom: 6 }}
        />
        {/* Rotated text — bottom */}
        <div style={{
          color: OFFLINE_COLOR, fontSize: 9, writingMode: 'vertical-rl', transform: 'rotate(180deg)',
          fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.6,
        }}>
          Offline
        </div>
      </div>
      <div className="grid flex-1" style={{ gridTemplateColumns: 'repeat(14, minmax(72px, 1fr))' }}>
        {days.map((date, i) => (
          <OfflineCell key={i} date={date} onAdd={onAdd} />
        ))}
      </div>
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export function Calendar({ mathiasActivities, mathiasEvents, karolineActivities, karolineEvents, preview, forecast, onRefresh, onAddOfflineWorkout }: CalendarProps) {
  const days = buildDays();
  const mathiasPreview = preview?.athleteSlug === 'mathias' ? preview.workout : null;
  const karolinePreview = preview?.athleteSlug === 'karoline' ? preview.workout : null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="px-4 py-2 text-xs font-medium border-b" style={{ color: 'var(--text-subtle)', borderColor: 'var(--border)' }}>
        {format(days[0], 'MMMM', { locale: nb })} – {format(days[13], 'MMMM yyyy', { locale: nb })}
      </div>
      <div className="overflow-x-auto">
        <div style={{ minWidth: 1050 }}>
          <AthleteRow name="Mathias" athleteSlug="mathias" color="#16a34a" days={days}
            activities={mathiasActivities} events={mathiasEvents} previewEvent={mathiasPreview}
            borderBottom forecast={forecast} showWeatherRow onRefresh={onRefresh} />
          <AthleteRow name="Karoline" athleteSlug="karoline" color="#2563eb" days={days}
            activities={karolineActivities} events={karolineEvents} previewEvent={karolinePreview}
            borderBottom forecast={forecast} showWeatherRow onRefresh={onRefresh} />
          <OfflineRow days={days} onAdd={onAddOfflineWorkout} />
        </div>
      </div>
    </div>
  );
}
