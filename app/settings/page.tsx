'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MATHIAS, KAROLINE } from '@/lib/athletes'
import { loadSettings, saveSettings, type AthleteSettings, type PersonalRecord } from '@/lib/storage'

export default function SettingsPage() {
  const [mSettings, setMSettings] = useState<AthleteSettings | null>(null)
  const [kSettings, setKSettings] = useState<AthleteSettings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setMSettings(loadSettings('mathias'))
    setKSettings(loadSettings('karoline'))
  }, [])

  function save() {
    if (mSettings) saveSettings('mathias', mSettings)
    if (kSettings) saveSettings('karoline', kSettings)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function updateRecord(who: 'mathias' | 'karoline', idx: number, field: keyof PersonalRecord, val: string) {
    if (who === 'mathias' && mSettings) {
      const records = [...mSettings.records]
      records[idx] = { ...records[idx], [field]: val }
      setMSettings({ ...mSettings, records })
    } else if (who === 'karoline' && kSettings) {
      const records = [...kSettings.records]
      records[idx] = { ...records[idx], [field]: val }
      setKSettings({ ...kSettings, records })
    }
  }

  if (!mSettings || !kSettings) return <div className="p-8 text-gray-400">Laster...</div>

  return (
    <div className="min-h-screen bg-[#eef2f7]">
      <header className="bg-white border-b border-blue-100 shadow-sm sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-blue-600 transition-colors text-sm">← Tilbake</Link>
          <span className="font-bold text-gray-800 text-lg">Innstillinger</span>
        </div>
      </header>

      <main className="max-w-[900px] mx-auto px-6 py-8 space-y-8">

        {([
          { id: 'mathias', athlete: MATHIAS, settings: mSettings, setSettings: setMSettings },
          { id: 'karoline', athlete: KAROLINE, settings: kSettings, setSettings: setKSettings },
        ] as const).map(({ id, athlete, settings, setSettings }) => (
          <div key={id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="h-1" style={{ backgroundColor: athlete.color }} />
            <div className="p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
                  style={{ backgroundColor: athlete.color }}>
                  {athlete.name[0]}
                </div>
                <h2 className="font-bold text-gray-800 text-lg">{athlete.name}</h2>
              </div>

              {/* Mål */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Mål</label>
                  <input
                    type="text"
                    value={settings.mainGoal}
                    onChange={e => setSettings({ ...settings, mainGoal: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium block mb-1">Måldato</label>
                  <input
                    type="date"
                    value={settings.mainGoalDate}
                    onChange={e => setSettings({ ...settings, mainGoalDate: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-blue-200"
                  />
                </div>
              </div>

              {/* Rekorder */}
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-3">Personlige rekorder</h3>
                <div className="space-y-2">
                  {settings.records.map((rec, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-2">
                      <input value={rec.sport} onChange={e => updateRecord(id, idx, 'sport', e.target.value)}
                        className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-blue-200"
                        placeholder="Sport" />
                      <input value={rec.label} onChange={e => updateRecord(id, idx, 'label', e.target.value)}
                        className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-blue-200"
                        placeholder="Distanse" />
                      <input value={rec.value} onChange={e => updateRecord(id, idx, 'value', e.target.value)}
                        className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-blue-200"
                        placeholder="Tid/verdi" />
                      <input type="date" value={rec.date} onChange={e => updateRecord(id, idx, 'date', e.target.value)}
                        className="bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 text-xs text-gray-600 focus:outline-none focus:border-blue-200" />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setSettings({ ...settings, records: [...settings.records, { sport: '', label: '', value: '', date: '' }] })}
                  className="mt-2 text-xs text-blue-500 hover:text-blue-700 font-medium">
                  + Legg til rekord
                </button>
              </div>
            </div>
          </div>
        ))}

        <div className="flex justify-end">
          <button onClick={save}
            className={`px-6 py-2.5 rounded-xl font-medium text-sm text-white transition-all ${saved ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {saved ? '✓ Lagret' : 'Lagre'}
          </button>
        </div>
      </main>
    </div>
  )
}
