function isAllowedDataGoKrUrl(u) {
  try {
    const parsed = new URL(u)
    return parsed.protocol === 'https:' && parsed.hostname === 'apis.data.go.kr'
  } catch {
    return false
  }
}

async function sha256Hex(input) {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default async function handler(req, res) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('allow', 'GET')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  try {
    if (String(req.query?.debug ?? '') === '1') {
      const kma = process.env.KMA_API_KEY || ''
      const tailCodes =
        kma.length > 0
          ? [...kma.slice(Math.max(0, kma.length - 8))].map((ch) => ch.charCodeAt(0))
          : []
      return res.status(200).json({
        hasKmaKey: Boolean(kma),
        kmaKeyLen: kma.length,
        kmaKeySha256: await sha256Hex(kma),
        kmaTailCodes: tailCodes,
      })
    }

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

    if (!target.searchParams.get('serviceKey') && process.env.KMA_API_KEY) {
      target.searchParams.set('serviceKey', process.env.KMA_API_KEY)
    }

    const upstream = await fetch(target.toString(), {
      method: 'GET',
      headers: { accept: req.headers.accept || '*/*' },
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
