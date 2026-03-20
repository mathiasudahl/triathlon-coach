'use client';

import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { addDays, format, isToday, isBefore, startOfDay } from 'date-fns';
import { nb } from 'date-fns/locale';
import type { Activity, WorkoutEvent, WeatherData, WeatherForecast } from '@/lib/types';

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
    chips.push({
      icon: sportIcon(e.type), name: shortName(e.name), meta: meta.join(' · '), done: false,
      eventId: e.id, athleteSlug,
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

const TOOLTIP_WIDTH = 240;

interface SavePayload { name: string; date: string; durationMin: number | null; tss: number | null; }

// anchorY = top edge of chip (pixels from top of document) — popup renders above chip
function TooltipPortal({ detail, eventDate, color, anchorX, anchorY, canEdit, onMouseEnter, onMouseLeave, onDelete, onSave, deleting }: {
  detail: ChipDetail; eventDate: string; color: string; anchorX: number; anchorY: number;
  canEdit: boolean;
  onMouseEnter: () => void; onMouseLeave: () => void;
  onDelete: () => void; onSave: (p: SavePayload) => void; deleting: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(detail.name);
  const [editDate, setEditDate] = useState(eventDate);
  const [editDur, setEditDur] = useState(detail.duration ? String(Math.round(detail.duration / 60)) : '');
  const [editTss, setEditTss] = useState(detail.tss ? String(detail.tss) : '');
  const [saving, setSaving] = useState(false);

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

  const left = Math.max(8, Math.min(anchorX - TOOLTIP_WIDTH / 2, window.innerWidth - TOOLTIP_WIDTH - 8));

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
    });
    setSaving(false);
    setEditing(false);
  }

  return createPortal(
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'absolute',
        top: anchorY - 4,
        transform: 'translateY(-100%)',
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
          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              style={{ flexShrink: 0, fontSize: 10, color: color, opacity: 0.7, background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
            >
              Rediger
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

      {/* Edit form */}
      {editing ? (
        <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <div style={{ color: 'var(--text-subtle)', fontSize: 9, marginBottom: 2 }}>Navn</div>
            <input style={inputStyle} value={editName} onChange={e => setEditName(e.target.value)} />
          </div>
          <div>
            <div style={{ color: 'var(--text-subtle)', fontSize: 9, marginBottom: 2 }}>Dato</div>
            <input style={inputStyle} type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <div>
              <div style={{ color: 'var(--text-subtle)', fontSize: 9, marginBottom: 2 }}>Varighet (min)</div>
              <input style={inputStyle} type="number" min="1" value={editDur} onChange={e => setEditDur(e.target.value)} />
            </div>
            <div>
              <div style={{ color: 'var(--text-subtle)', fontSize: 9, marginBottom: 2 }}>TSS</div>
              <input style={inputStyle} type="number" min="0" value={editTss} onChange={e => setEditTss(e.target.value)} />
            </div>
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
      ) : (
        <>
          {/* Stats */}
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

          {/* Description */}
          {detail.description && (
            <div style={{ borderTop: `1px solid ${color}15`, padding: '8px 12px' }}>
              <div style={{ color: 'var(--text-subtle)', fontSize: 9, marginBottom: 3 }}>Øktstruktur</div>
              <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: 'var(--text)', fontSize: 9, lineHeight: 1.5, margin: 0 }}>
                {detail.description}
              </pre>
            </div>
          )}

          {/* Actions */}
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
        </>
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
          <span style={{ fontSize: 10, flexShrink: 0, lineHeight: 1.4 }}>{chip.icon}</span>
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

// ─── Calendar ─────────────────────────────────────────────────────────────────

export function Calendar({ mathiasActivities, mathiasEvents, karolineActivities, karolineEvents, preview, forecast, onRefresh }: CalendarProps) {
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
            forecast={forecast} showWeatherRow onRefresh={onRefresh} />
        </div>
      </div>
    </div>
  );
}
