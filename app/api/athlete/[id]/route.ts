import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.INTERVALS_BASE_URL || 'https://intervals.icu/api/v1'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const url = new URL(req.url)
  const apiKey = url.searchParams.get('key') || ''
  const oldest = url.searchParams.get('oldest') || ''
  const newest = url.searchParams.get('newest') || ''

  const auth = Buffer.from(`API_KEY:${apiKey}`).toString('base64')
  const fetchUrl = `${BASE_URL}/athlete/${id}/activities?oldest=${oldest}&newest=${newest}`

  const res = await fetch(fetchUrl, {
    headers: { Authorization: `Basic ${auth}` },
    next: { revalidate: 300 },
  })

  if (!res.ok) return NextResponse.json({ error: res.status }, { status: res.status })
  return NextResponse.json(await res.json())
}
