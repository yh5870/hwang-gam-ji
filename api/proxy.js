function isAllowedDataGoKrUrl(u) {
  try {
    const parsed = new URL(u)
    return parsed.protocol === 'https:' && parsed.hostname === 'apis.data.go.kr'
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

    if (!isAllowedDataGoKrUrl(target.toString())) {
      return res.status(400).json({ error: 'url_not_allowed' })
    }

    const kmaKey = String(process.env.KMA_API_KEY || '')
      .trim()
      .replace(/\r/g, '')
      .replace(/\n/g, '')

    if (!target.searchParams.get('serviceKey') && kmaKey) {
      target.searchParams.set('serviceKey', kmaKey)
    }

    const upstream = await fetch(target.toString(), {
      method: 'GET',
      headers: { accept: req.headers.accept || '*/*' },
    })

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    res.setHeader('content-type', contentType)
    // ASOS URL은 매시간 endHh가 바뀌어 자동 갱신됨.
    // stale-while-revalidate를 짧게 유지해야 NODATA 캐시가 오래 서빙되지 않음.
    res.setHeader('cache-control', 's-maxage=300, stale-while-revalidate=300')

    const body = await upstream.arrayBuffer()
    res.status(upstream.status).send(Buffer.from(body))
  } catch (e) {
    res.status(500).json({ error: e?.message || 'proxy_error' })
  }
}
