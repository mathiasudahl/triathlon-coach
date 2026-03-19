'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

type Point = {
  id: string
  ctl: number
  atl: number
  form: number
}

type Props = {
  data: Point[]
  color: string
}

export default function FitnessChart({ data, color }: Props) {
  const formatted = data.map(d => ({
    date: d.id,
    label: new Date(d.id).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }),
    CTL: Math.round(d.ctl),
    ATL: Math.round(d.atl),
    Form: Math.round(d.form),
  }))

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={formatted} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
          labelStyle={{ color: '#374151', fontWeight: 600 }}
        />
        <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="CTL" stroke={color} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="ATL" stroke="#f97316" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        <Line type="monotone" dataKey="Form" stroke="#6b7280" strokeWidth={1.5} dot={false} strokeDasharray="2 2" />
      </LineChart>
    </ResponsiveContainer>
  )
}
