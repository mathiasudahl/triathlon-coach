'use client'

import { useState, useRef, useEffect } from 'react'

type Message = {
  role: 'user' | 'assistant'
  content: string
}

type Props = {
  athleteId: string
  athleteName: string
  color: string
}

export default function AiChat({ athleteId, athleteName, color }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const newMessages: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, athleteId }),
      })
      const data = await res.json()
      const block = data.content
      const text = block?.type === 'text' ? block.text : block?.type === 'tool_use' ? `[tool_use: ${block.name}]` : block?.text
      if (text) {
        setMessages(m => [...m, { role: 'assistant', content: text }])
      } else if (data.error) {
        setMessages(m => [...m, { role: 'assistant', content: `Feil: ${data.error}` }])
      }
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Noe gikk galt. Prøv igjen.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
        <span className="font-semibold text-gray-800 text-sm">AI-coach — {athleteName}</span>
        <span className="ml-auto text-xs text-gray-300">Claude Opus</span>
      </div>

      {/* Meldinger */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[500px]">
        {messages.length === 0 && (
          <div className="text-sm text-gray-400 text-center pt-8">
            <div className="text-3xl mb-2">🎯</div>
            <div>Spør om trening, form, planjusteringer eller hva som helst.</div>
            <div className="mt-1 text-xs text-gray-300">F.eks: «Jeg reiser torsdag–lørdag, hva gjør vi med ukesplanen?»</div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === 'user'
                ? 'text-white rounded-br-sm'
                : 'bg-gray-50 text-gray-800 rounded-bl-sm border border-gray-100'
            }`} style={m.role === 'user' ? { backgroundColor: color } : {}}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-50 border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-300 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-50 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          placeholder="Skriv til coachen..."
          className="flex-1 bg-gray-50 rounded-xl px-4 py-2.5 text-sm text-gray-800 placeholder-gray-300 border border-gray-100 focus:outline-none focus:border-blue-200 focus:bg-white transition-all"
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-40"
          style={{ backgroundColor: color }}>
          Send
        </button>
      </div>
    </div>
  )
}
