// api/generate-vocab.js
// Place this file at the ROOT of your admin app project (same level as src/, package.json)
// It becomes available at /api/generate-vocab on Vercel automatically.

export default async function handler(req, res) {
  // CORS headers (allow your admin app origin)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' })

  const { words } = req.body
  if (!words || !words.length)  return res.status(400).json({ error: 'No words provided' })

  const apiKey = process.env.ANTHROPIC_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_KEY environment variable not set' })

  const prompt = `You are helping an English language school create vocabulary exercises.
For each word below, provide:
1. A short definition (1 sentence, suitable for B1–B2 level English learners)
2. A natural example sentence where the word is replaced by ___ (keep it clear and contextual)

Words: ${words.join(', ')}

Return ONLY a valid JSON array, no extra text or markdown:
[{"word":"...","definition":"...","sentence":"The ___ was..."}]`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()

    if (data.error) return res.status(500).json({ error: data.error.message })

    const text  = data.content?.[0]?.text?.trim() || '[]'
    const clean = text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)

    res.status(200).json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}