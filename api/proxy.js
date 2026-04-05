function isAllowedUrl(u) {
  try {
    const parsed = new URL(u)
    if (parsed.protocol !== 'https:') return false
    return (
      parsed.hostname === 'apis.data.go.kr' ||
      parsed.hostname === 'weather.googleapis.com'
    )
  } catch {
    return false
  }
}

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  try {
    const raw = String(req.query?.url ?? '')
    if (!raw) {
      return res.status(400).json({ error: 'missing_url' })
    }

    let target
    try {
      target = new URL(raw)
    } catch {
      return res.status(400).json({ error: 'invalid_url' })
    }

    if (!isAllowedUrl(target.toString())) {
      return res.status(400).json({ error: 'url_not_allowed' })
    }

    // apis.data.go.kr → KMA 서비스키 주입
    if (target.hostname === 'apis.data.go.kr') {
      const kmaKey = String(process.env.KMA_API_KEY || '')
        .trim()
        .replace(/\r/g, '')
        .replace(/\n/g, '')
      if (!target.searchParams.get('serviceKey') && kmaKey) {
        target.searchParams.set('serviceKey', kmaKey)
      }
    }

    // weather.googleapis.com → Google Weather API 키 주입
    if (target.hostname === 'weather.googleapis.com') {
      const googleKey = String(process.env.GOOGLE_WEATHER_KEY || '')
        .trim()
        .replace(/\r/g, '')
        .replace(/\n/g, '')
      if (!target.searchParams.get('key') && googleKey) {
        target.searchParams.set('key', googleKey)
      }
    }

    const upstream = await fetch(target.toString(), {
      method: 'GET',
      headers: { accept: req.headers.accept || '*/*' },
    })

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    res.setHeader('content-type', contentType)
    res.setHeader('cache-control', 's-maxage=300, stale-while-revalidate=300')

    const body = await upstream.arrayBuffer()
    res.status(upstream.status).send(Buffer.from(body))
  } catch (e) {
    res.status(500).json({ error: e?.message || 'proxy_error' })
  }
}
