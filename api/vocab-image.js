// /api/vocab-image.js  —  Vercel serverless function
//
// Searches Pexels for a query word, downloads the top photo server-side (avoids
// browser CORS issues, keeps the Pexels key off the client), and returns the
// image bytes as base64 for the browser to upload into Supabase storage.
//
// Requires a Vercel environment variable: PEXELS_API_KEY
// (Get a free key at https://www.pexels.com/api/ — no VITE_ prefix; server-side.)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
  const query = (body.query || '').toString().trim()
  if (!query) return res.status(400).json({ error: 'query is required' })

  const key = process.env.PEXELS_API_KEY
  if (!key) return res.status(500).json({ error: 'PEXELS_API_KEY not set on the server' })

  try {
    const searchUrl = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=5&orientation=square`
    const sr = await fetch(searchUrl, { headers: { Authorization: key } })
    if (!sr.ok) return res.status(502).json({ error: `Pexels search failed (${sr.status})` })
    const data = await sr.json()
    const photo = data.photos && data.photos[0]
    if (!photo) return res.status(404).json({ error: `No image found for "${query}"` })

    // medium (~350px) is plenty for a quiz tile and keeps the payload small
    const imgUrl = photo.src.medium || photo.src.large || photo.src.original
    const ir = await fetch(imgUrl)
    if (!ir.ok) return res.status(502).json({ error: 'Image download failed' })
    const buf = Buffer.from(await ir.arrayBuffer())
    const contentType = ir.headers.get('content-type') || 'image/jpeg'

    return res.status(200).json({
      base64: buf.toString('base64'),
      contentType,
      query,
      photographer: photo.photographer || null,
      pexels_url: photo.url || null,
    })
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Unexpected error' })
  }
}