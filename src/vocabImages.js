// vocabImages.js — auto-fetch quiz images for a vocabulary word.
//
// Flow (one word):
//   1. Ask Claude for 3 distractor words in the SAME visual category (browser,
//      same direct-access pattern as aiTranslate in VocabAdmin).
//   2. For the target word + 3 distractors, fetch a photo from Pexels via the
//      /api/vocab-image serverless function (server downloads the bytes).
//   3. Return 4 { file, source } objects — the caller drops them into the
//      existing image slots, and the existing Save path uploads them.

export async function aiDistractorWords(word) {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!key) throw new Error('VITE_ANTHROPIC_API_KEY not set')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 80,
      system: 'You choose distractor words for a picture vocabulary quiz. Given a target word, return exactly 3 OTHER concrete, easily-photographed nouns in the SAME visual category (the same kind of thing) as the target — e.g. for "apple" → other fruit like "banana", "orange", "grapes". Each must be clearly different from the target and from each other so their photos are distinguishable, and must NOT be a synonym of the target. Reply with ONLY a JSON array of 3 lowercase strings, no markdown.',
      messages: [{ role: 'user', content: `Target word: "${word}"` }],
    }),
  })
  if (!res.ok) throw new Error('AI distractor request failed: ' + res.status)
  const data = await res.json()
  const text = data.content[0].text.replace(/```json|```/g, '').trim()
  const arr = JSON.parse(text)
  if (!Array.isArray(arr) || arr.length < 3) throw new Error('AI did not return 3 distractor words')
  return arr.slice(0, 3).map(s => String(s).trim()).filter(Boolean)
}

async function fetchVocabImage(query) {
  const res = await fetch('/api/vocab-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.error || `image fetch failed for "${query}"`)
  }
  return res.json() // { base64, contentType, ... }
}

function base64ToBlob(b64, contentType) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: contentType || 'image/jpeg' })
}

// Returns [{ file, source }] of length 4: index 0 = correct, 1..3 = distractors.
// onProgress(query, index) is called before each image fetch (optional).
export async function autoFetchImagesForWord(word, onProgress) {
  const distractors = await aiDistractorWords(word)
  const queries = [word, ...distractors].slice(0, 4)
  const out = []
  for (let i = 0; i < 4; i++) {
    if (onProgress) onProgress(queries[i], i)
    const img = await fetchVocabImage(queries[i])
    const blob = base64ToBlob(img.base64, img.contentType)
    const ext = ((img.contentType || 'image/jpeg').split('/')[1] || 'jpg').replace('jpeg', 'jpg')
    const safe = String(queries[i]).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'img'
    const file = new File([blob], `${safe}_${i}.${ext}`, { type: img.contentType || 'image/jpeg' })
    out.push({ file, source: queries[i] })
  }
  return out
}