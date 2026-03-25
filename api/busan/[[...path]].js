export default async function handler(req, res) {
  try {
    const { path = [] } = req.query || {}
    const segs = Array.isArray(path) ? path : [path]
    const subPath = segs.filter(Boolean).join('/')
    const upstreamBase = `https://apis.data.go.kr/${subPath}`

    const url = new URL(upstreamBase)
    for (const [k, v] of Object.entries(req.query || {})) {
      if (k === 'path') continue
      if (v == null) continue
      if (Array.isArray(v)) v.forEach((vv) => url.searchParams.append(k, vv))
      else url.searchParams.set(k, String(v))
    }

    // Prefer server-side key when available (keeps key out of client bundles).
    if (!url.searchParams.get('serviceKey') && process.env.KMA_API_KEY) {
      url.searchParams.set('serviceKey', process.env.KMA_API_KEY)
    }

    const upstream = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'accept': req.headers.accept || '*/*' },
    })

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    res.setHeader('content-type', contentType)
    res.setHeader('cache-control', 's-maxage=300, stale-while-revalidate=600')

    const body = await upstream.arrayBuffer()
    res.status(upstream.status).send(Buffer.from(body))
  } catch (e) {
    res.status(500).json({ error: e?.message || 'proxy_error' })
  }
}
