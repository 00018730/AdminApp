import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { autoFetchImagesForWord } from './vocabImages'

const G  = '#009472'
const D  = '#002b2a'
const BATCH = 8

const lbl = { fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px' }
const inp = { width:'100%', padding:'11px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, fontFamily:"'DM Sans',sans-serif", boxSizing:'border-box' }

const POS_OPTIONS = ['noun','verb','adjective','adverb','phrase','preposition','conjunction','pronoun', 'question word', 'phrasal verb', 'compound noun', 'compound adjective', 'adjective + preposition', 'verb + preposition', 'noun + preposition', 'collocation', 'idiomatic expression']
const POS_COLORS  = {
  verb:       { bg:'#dbeafe', color:'#1d4ed8' },
  noun:       { bg:'#dcfce7', color:'#15803d' },
  adjective:  { bg:'#fef9c3', color:'#854d0e' },
  adverb:     { bg:'#ede9fe', color:'#6d28d9' },
  phrase:     { bg:'#ffedd5', color:'#c2410c' },
  preposition:{ bg:'#fce7f3', color:'#be185d' },
  conjunction:{ bg:'#f0fdf4', color:'#166534' },
  pronoun:    { bg:'#f0f9ff', color:'#0369a1' },
  'question word':            { bg: '#fee2e2', color: '#b91c1c' }, // red
'phrasal verb':              { bg: '#ccfbf1', color: '#0f766e' }, // teal
'compound noun':             { bg: '#e0e7ff', color: '#4338ca' }, // indigo
'compound adjective':        { bg: '#f5f5f4', color: '#57534e' }, // stone
'adjective + preposition':   { bg: '#ecfccb', color: '#4d7c0f' }, // lime
'verb + preposition':        { bg: '#cffafe', color: '#0e7490' }, // cyan
'noun + preposition':        { bg: '#fae8ff', color: '#a21caf' }, // fuchsia
collocation:                 { bg: '#fef3c7', color: '#b45309' }, // amber
'idiomatic expression':      { bg: '#ffe4e6', color: '#be123c' }, // rose
}

function PosBadge({ pos }) {
  if (!pos) return null
  const c = POS_COLORS[pos.toLowerCase()] || { bg:'#f0f2f1', color:'#64748b' }
  return (
    <span style={{ fontSize:'10px', fontWeight:'700', padding:'2px 7px', borderRadius:'6px', background:c.bg, color:c.color, marginLeft:'6px' }}>
      {pos}
    </span>
  )
}

function parseWords(raw) {
  return raw
    .split(/[\n,]+/)
    .map(w => w.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .filter((w, i, arr) => arr.indexOf(w) === i)
}

async function generateBatch(words) {
  const res = await fetch('/api/generate-vocab', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ words }),
  })
  if (!res.ok) {
    const err = await res.json().catch(()=>({}))
    throw new Error(err.error || 'API request failed')
  }
  return res.json()
}

// ── AI HELPERS ────────────────────────────────────────────────────────────────
async function aiTranslate(word) {
  // Use Anthropic API — OpenAI chat/completions blocks CORS from browser
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY not set')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 80,
      system: 'You are a translator. Reply ONLY with a JSON object, no markdown, no explanation.',
      messages: [{
        role: 'user',
        content: `Translate the English word "${word}" into Uzbek and Russian. Reply ONLY with JSON: {"uz":"...","ru":"..."}`
      }],
    })
  })
  if (!res.ok) throw new Error('Translation failed: ' + res.status)
  const data = await res.json()
  const text = data.content[0].text.replace(/```json|```/g,'').trim()
  return JSON.parse(text)
}

async function aiGenerateSentence(word, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'x-api-key':apiKey, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 80,
      system: 'Generate one short natural example sentence (max 12 words) for an English vocabulary word. Reply with ONLY the sentence.',
      messages: [{ role:'user', content:`Word: "${word}"` }]
    })
  })
  if (!res.ok) throw new Error('Generation failed')
  const data = await res.json()
  return data.content[0].text.trim().replace(/^["']|["']$/g,'')
}

async function aiGenerateScramble(word, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'x-api-key':apiKey, 'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 80,
      system: 'Generate one very simple short sentence (5-8 words, A1/A2 level English, suitable for absolute beginners) that uses the given word. Reply with ONLY the sentence, no punctuation except a period at the end.',
      messages: [{ role:'user', content:`Word: "${word}"` }]
    })
  })
  if (!res.ok) throw new Error('Generation failed')
  const data = await res.json()
  return data.content[0].text.trim().replace(/^["']|["']$/g,'')
}

// ── IMAGE SLOT ────────────────────────────────────────────────────────────────
const SLOT_META = [
  { label:'✓ Correct', color:G,         bg:'#d1fae5' },
  { label:'✗ Wrong 1', color:'#ef4444', bg:'#fee2e2' },
  { label:'✗ Wrong 2', color:'#ef4444', bg:'#fee2e2' },
  { label:'✗ Wrong 3', color:'#ef4444', bg:'#fee2e2' },
]

function ImageSlot({ meta, preview, onFile, onRemove }) {
  const ref = useRef(null)
  return (
    <div>
      <div style={{ fontSize:'10px', fontWeight:'800', padding:'2px 7px', borderRadius:'6px', background:meta.bg, color:meta.color, display:'inline-block', marginBottom:'5px' }}>{meta.label}</div>
      {preview
        ? <div style={{ position:'relative', borderRadius:'10px', overflow:'hidden', border:`2px solid ${meta.color === G ? G : '#fca5a5'}`, aspectRatio:'1' }}>
            <img src={preview} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
            <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', justifyContent:'flex-end', gap:'3px', padding:'4px' }}>
              <button onClick={() => ref.current?.click()} style={{ padding:'3px', borderRadius:'5px', border:'none', background:'rgba(0,0,0,0.55)', color:'white', fontSize:'9px', fontWeight:'700', cursor:'pointer' }}>Change</button>
              <button onClick={onRemove} style={{ padding:'3px', borderRadius:'5px', border:'none', background:'rgba(239,68,68,0.75)', color:'white', fontSize:'9px', fontWeight:'700', cursor:'pointer' }}>Remove</button>
            </div>
          </div>
        : <button onClick={() => ref.current?.click()} style={{ width:'100%', aspectRatio:'1', borderRadius:'10px', border:`2px dashed ${meta.color === G ? `${G}60` : '#e4e8e7'}`, background:'white', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'4px', color:'#94a3b8' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            <span style={{ fontSize:'10px', fontWeight:'600' }}>Upload</span>
          </button>
      }
      <input ref={ref} type="file" accept="image/*" style={{ display:'none' }} onChange={e => { if(e.target.files[0]) onFile(e.target.files[0]); e.target.value='' }} />
    </div>
  )
}

// ── EDIT WORD MODAL ────────────────────────────────────────────────────────────
function EditWordModal({ word, level, lessonOrder, onClose, onSaved }) {
  const isBeginner   = level === 'Beginner'
  const isElementary = level === 'Elementary'
  const showTrans    = isBeginner || isElementary
  const showDef      = !isBeginner

  const [form, setForm] = useState({
    word:              word.word || '',
    part_of_speech:    word.part_of_speech || '',
    definition:        word.definition || '',
    example_sentence:  word.example_sentence || '',
    sentence:          word.sentence || '',
    translation_uz:    word.translation_uz || '',
    translation_ru:    word.translation_ru || '',
    scramble_sentence: word.scramble_sentence || '',
  })

  const [genLoading,       setGenLoading]       = useState(false)
  const [transLoading,     setTransLoading]      = useState(false)
  const [scrambleLoading,  setScrambleLoading]   = useState(false)
  const [imgFiles,         setImgFiles]          = useState([null,null,null,null])
  const [imgPrevs,         setImgPrevs]          = useState([word.picture_url||null, word.picture_url_2||null, word.picture_url_3||null, word.picture_url_4||null])
  const [imgRemoved,       setImgRemoved]        = useState([false,false,false,false])
  const [autoLoading,      setAutoLoading]        = useState(false)
  const [autoMsg,          setAutoMsg]            = useState('')
  const [slotSource,       setSlotSource]         = useState([null,null,null,null])
  const [saving,           setSaving]            = useState(false)
  const [error,            setError]             = useState('')

  const ORIG = [word.picture_url||null, word.picture_url_2||null, word.picture_url_3||null, word.picture_url_4||null]

  const handleFile = (i, file) => {
    const f=[...imgFiles];f[i]=file;setImgFiles(f)
    const p=[...imgPrevs];p[i]=URL.createObjectURL(file);setImgPrevs(p)
    const r=[...imgRemoved];r[i]=false;setImgRemoved(r)
  }
  const removeSlot = (i) => {
    const f=[...imgFiles];f[i]=null;setImgFiles(f)
    const p=[...imgPrevs];p[i]=null;setImgPrevs(p)
    const r=[...imgRemoved];r[i]=true;setImgRemoved(r)
    const s=[...slotSource];s[i]=null;setSlotSource(s)
  }

  // Auto-fetch: AI suggests 3 same-category distractor words, then we pull a
  // photo for the word + each distractor from Pexels and drop them into the 4
  // slots. The admin can still Change/Remove any slot before saving; Save then
  // uploads them to the vocabulary-images bucket like a normal upload.
  const handleAutoFetch = async () => {
    if (!form.word.trim()) { setError('Enter the word first'); return }
    setAutoLoading(true); setError(''); setAutoMsg('Asking AI for similar words…')
    try {
      const results = await autoFetchImagesForWord(form.word.trim(), (q, i) => setAutoMsg(`Fetching image ${i+1}/4: “${q}”…`))
      const f=[...imgFiles], p=[...imgPrevs], r=[...imgRemoved], s=[...slotSource]
      results.forEach((res, i) => { f[i]=res.file; p[i]=URL.createObjectURL(res.file); r[i]=false; s[i]=res.source })
      setImgFiles(f); setImgPrevs(p); setImgRemoved(r); setSlotSource(s)
    } catch (e) { setError('Auto-fetch failed: ' + e.message) }
    setAutoLoading(false); setAutoMsg('')
  }

  const uploadImages = async () => {
    const urls=[]
    const suffix=['correct','wrong1','wrong2','wrong3']
    for(let i=0;i<4;i++){
      if(imgRemoved[i]&&!imgFiles[i]){urls.push(null);continue}
      if(!imgFiles[i]){urls.push(ORIG[i]);continue}
      const ext=imgFiles[i].name.split('.').pop().toLowerCase()
      const safeName=form.word.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')
      const path=`${level}/${lessonOrder}/${safeName}_${suffix[i]}.${ext}`
      const{data:up,error:upErr}=await supabase.storage.from('vocabulary-images').upload(path,imgFiles[i],{contentType:imgFiles[i].type,upsert:true})
      if(upErr){setError('Image upload failed: '+upErr.message);return null}
      const{data:{publicUrl}}=supabase.storage.from('vocabulary-images').getPublicUrl(up.path)
      urls.push(publicUrl)
    }
    return urls
  }

  const save = async () => {
    if (!form.word.trim()) { setError('Word is required.'); return }
    if (showDef && !form.definition.trim()) { setError('Definition is required.'); return }
    if (!isBeginner && form.sentence && !form.sentence.includes('___')) { setError('Sentence must contain ___ as the blank.'); return }
    const imgCount = imgPrevs.filter(Boolean).length
    if (imgCount > 0 && imgCount < 4) { setError('Upload all 4 images or none.'); return }
    setSaving(true); setError('')
    const urls = await uploadImages()
    if (!urls) { setSaving(false); return }

    const row = {
      word:              form.word.trim(),
      part_of_speech:    form.part_of_speech || null,
      definition:        form.definition.trim() || null,
      example_sentence:  form.example_sentence.trim() || null,
      sentence:          form.sentence.trim() || null,
      translation_uz:    form.translation_uz.trim() || null,
      translation_ru:    form.translation_ru.trim() || null,
      scramble_sentence: form.scramble_sentence.trim() || null,
      picture_url:       urls[0],
      picture_url_2:     urls[1],
      picture_url_3:     urls[2],
      picture_url_4:     urls[3],
    }

    let err
    if (word.id) { ;({ error:err } = await supabase.from('vocabulary_words').update(row).eq('id', word.id)) }
    else         { ;({ error:err } = await supabase.from('vocabulary_words').insert({ ...row, level, lesson_order:lessonOrder, word_order:word.word_order ?? 0 })) }
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  const handleGenExample = async () => {
    if (!form.word.trim()) { setError('Enter the word first'); return }
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) { setError('VITE_ANTHROPIC_API_KEY not set'); return }
    setGenLoading(true); setError('')
    try {
      const sentence = await aiGenerateSentence(form.word, apiKey)
      setForm(f => ({ ...f, example_sentence: sentence }))
    } catch (e) { setError('Generation failed: ' + e.message) }
    setGenLoading(false)
  }

  const handleTranslate = async () => {
    if (!form.word.trim()) { setError('Enter the word first'); return }
    setTransLoading(true); setError('')
    try {
      const { uz, ru } = await aiTranslate(form.word)
      setForm(f => ({ ...f, translation_uz: uz || f.translation_uz, translation_ru: ru || f.translation_ru }))
    } catch (e) { setError('Translation failed: ' + e.message) }
    setTransLoading(false)
  }

  const handleGenerateScramble = async () => {
    if (!form.word.trim()) { setError('Enter the word first'); return }
    const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
    if (!apiKey) { setError('VITE_ANTHROPIC_API_KEY not set'); return }
    setScrambleLoading(true); setError('')
    try {
      const sentence = await aiGenerateScramble(form.word, apiKey)
      setForm(f => ({ ...f, scramble_sentence: sentence }))
    } catch (e) { setError('Generation failed: ' + e.message) }
    setScrambleLoading(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'16px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'white', borderRadius:'20px', padding:'24px', width:'100%', maxWidth:'500px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <span style={{ fontSize:'16px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{word.id ? 'Edit Word' : 'Add Word'}</span>
          <button onClick={onClose} style={{ width:'30px', height:'30px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'15px' }}>✕</button>
        </div>

        {/* Word */}
        <label style={lbl}>Word</label>
        <input value={form.word} onChange={e=>setForm(f=>({...f,word:e.target.value}))} style={{ ...inp, marginBottom:'14px' }} />

        {/* Part of speech */}
        <label style={lbl}>Part of Speech</label>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'14px' }}>
          {POS_OPTIONS.map(pos => {
            const active = form.part_of_speech === pos
            const c = POS_COLORS[pos] || { bg:'#f0f2f1', color:'#64748b' }
            return (
              <button key={pos} type="button" onClick={() => setForm(f => ({ ...f, part_of_speech: active ? '' : pos }))}
                style={{ padding:'5px 12px', borderRadius:'8px', border:`1.5px solid ${active ? c.color : '#e4e8e7'}`, background:active ? c.bg : 'white', color:active ? c.color : '#64748b', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
                {pos}
              </button>
            )
          })}
        </div>

        {/* Translation — Beginner and Elementary */}
        {showTrans && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
              <label style={{ ...lbl, marginBottom:0 }}>Translation</label>
              <button type="button" onClick={handleTranslate} disabled={transLoading}
                style={{ padding:'5px 12px', borderRadius:'8px', border:'none', background:transLoading?'#94a3b8':G, color:'white', fontSize:'12px', fontWeight:'700', cursor:transLoading?'default':'pointer' }}>
                {transLoading ? 'Translating…' : '🌐 Generate with AI'}
              </button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'14px' }}>
              <div>
                <div style={{ fontSize:'10px', fontWeight:'700', color:'#92400e', marginBottom:'4px' }}>🇺🇿 Uzbek</div>
                <input value={form.translation_uz} onChange={e=>setForm(f=>({...f,translation_uz:e.target.value}))}
                  placeholder="Uzbek translation…" style={{ ...inp, borderColor:'#fde68a' }} />
              </div>
              <div>
                <div style={{ fontSize:'10px', fontWeight:'700', color:'#166534', marginBottom:'4px' }}>🇷🇺 Russian</div>
                <input value={form.translation_ru} onChange={e=>setForm(f=>({...f,translation_ru:e.target.value}))}
                  placeholder="Russian translation…" style={{ ...inp, borderColor:'#86efac' }} />
              </div>
            </div>
          </>
        )}

        {/* Definition — Elementary and above */}
        {showDef && (
          <>
            <label style={lbl}>Definition</label>
            <textarea value={form.definition} onChange={e=>setForm(f=>({...f,definition:e.target.value}))} rows={2}
              style={{ ...inp, resize:'vertical', lineHeight:1.5, marginBottom:'14px' }} />
          </>
        )}

        {/* Example sentence — not Beginner */}
        {!isBeginner && (
          <>
            <label style={lbl}>Example Sentence <span style={{ fontWeight:'400', textTransform:'none', color:'#94a3b8' }}>(shown on definition card)</span></label>
            <input value={form.example_sentence} onChange={e=>setForm(f=>({...f,example_sentence:e.target.value}))}
              placeholder="e.g. The firefighter was very brave."
              style={{ ...inp, marginBottom:'6px' }} />
            <button type="button" onClick={handleGenExample} disabled={genLoading}
              style={{ marginBottom:'14px', padding:'8px 16px', borderRadius:'8px', border:'none', background:genLoading?'#94a3b8':G, color:'white', fontSize:'13px', fontWeight:'700', cursor:genLoading?'default':'pointer' }}>
              {genLoading ? 'Generating…' : '✨ Generate with AI'}
            </button>
          </>
        )}

        {/* Sentence with blank — not Beginner */}
        {!isBeginner && (
          <>
            <label style={lbl}>Sentence <span style={{ fontWeight:'400', textTransform:'none', color:'#94a3b8' }}>(use ___ for the blank)</span></label>
            <input value={form.sentence} onChange={e=>setForm(f=>({...f,sentence:e.target.value}))} style={{ ...inp, marginBottom:'20px' }} />
          </>
        )}

        {/* Scramble sentence — Beginner only */}
        {isBeginner && (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
              <label style={{ ...lbl, marginBottom:0 }}>Scrambled Sentence <span style={{ fontWeight:'400', textTransform:'none', color:'#94a3b8' }}>(student unscrambles)</span></label>
              <button type="button" onClick={handleGenerateScramble} disabled={scrambleLoading}
                style={{ padding:'5px 12px', borderRadius:'8px', border:'none', background:scrambleLoading?'#94a3b8':G, color:'white', fontSize:'12px', fontWeight:'700', cursor:scrambleLoading?'default':'pointer' }}>
                {scrambleLoading ? 'Generating…' : '✨ Generate'}
              </button>
            </div>
            <input value={form.scramble_sentence} onChange={e=>setForm(f=>({...f,scramble_sentence:e.target.value}))}
              placeholder="e.g. I play football every day."
              style={{ ...inp, marginBottom:'4px' }} />
            <div style={{ fontSize:'11px', color:'#94a3b8', marginBottom:'20px' }}>Write the correct sentence — the app will scramble the words for the student.</div>
          </>
        )}

        {/* Quiz images */}
        <div style={{ marginBottom:'16px' }}>
          <label style={lbl}>Quiz Images <span style={{ fontWeight:'400', textTransform:'none', color:'#94a3b8' }}>— all 4 or none</span></label>
          <div style={{ background:'#f8fafb', borderRadius:'12px', padding:'12px', border:'1.5px dashed #e4e8e7' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
              <div style={{ fontSize:'12px', color:'#94a3b8' }}>1 correct image + 3 wrong options for the picture quiz</div>
              <button type="button" onClick={handleAutoFetch} disabled={autoLoading}
                style={{ padding:'6px 12px', borderRadius:'8px', border:'none', background:autoLoading?'#94a3b8':G, color:'white', fontSize:'12px', fontWeight:'700', cursor:autoLoading?'default':'pointer', flexShrink:0, whiteSpace:'nowrap' }}>
                {autoLoading ? 'Fetching…' : '✨ Auto-fetch'}
              </button>
            </div>
            {autoMsg && <div style={{ fontSize:'12px', color:G, fontWeight:'600', marginBottom:'10px' }}>{autoMsg}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
              {SLOT_META.map((m,i) => (
                <div key={i}>
                  <ImageSlot meta={m} preview={imgPrevs[i]} onFile={f=>handleFile(i,f)} onRemove={()=>removeSlot(i)} />
                  {slotSource[i] && <div style={{ fontSize:'10px', color:'#94a3b8', marginTop:'3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textAlign:'center' }}>“{slotSource[i]}”</div>}
                </div>
              ))}
            </div>
            <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'10px', lineHeight:1.5 }}>
              Auto-fetch uses AI to pick 3 similar words, then pulls a photo for each from Pexels. Review them, then Change or Remove any before saving.
            </div>
          </div>
        </div>

        {error && <div style={{ background:'#fef2f2', borderRadius:'8px', padding:'10px', color:'#ef4444', fontSize:'13px', fontWeight:'600', marginBottom:'12px' }}>{error}</div>}

        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'12px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex:2, padding:'12px', borderRadius:'12px', border:'none', background:saving?'#c4cdd6':G, color:'white', fontSize:'14px', fontWeight:'700', cursor:saving?'default':'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {saving?'Saving…':'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── IMPORT MODAL ──────────────────────────────────────────────────────────────
function ImportModal({ level, lessonOrder, existingCount, onClose, onSaved }) {
  const [step,      setStep]      = useState('paste')
  const [raw,       setRaw]       = useState('')
  const [parsed,    setParsed]    = useState([])
  const [generated, setGenerated] = useState([])
  const [progress,  setProgress]  = useState({ done:0, total:0, current:'' })
  const [error,     setError]     = useState('')
  const [editIdx,   setEditIdx]   = useState(null)
  const [saving,    setSaving]    = useState(false)

  const isBeginner   = level === 'Beginner'
  const isElementary = level === 'Elementary'

  const confirm = () => {
    const words = parseWords(raw)
    if (!words.length) { setError('No words detected.'); return }
    setParsed(words); setError(''); setStep('confirm')
  }

  const generate = async () => {
    setStep('generating')
    setProgress({ done:0, total:parsed.length, current:parsed[0] })
    const results = []
    try {
      for (let i = 0; i < parsed.length; i += BATCH) {
        const batch = parsed.slice(i, i + BATCH)
        setProgress({ done:i, total:parsed.length, current:batch[0] })
        const batchResults = await generateBatch(batch)
        for (const w of batch) {
          const found = batchResults.find(r => r.word?.toLowerCase() === w.toLowerCase())
          results.push({
            word:              w,
            part_of_speech:    '',
            definition:        found?.definition || '',
            sentence:          found?.sentence || `She is very ___.`,
            translation_uz:    '',
            translation_ru:    '',
            scramble_sentence: '',
          })
        }
      }
      setGenerated(results)
      setStep('review')
    } catch (err) {
      setError(err.message)
      setStep('confirm')
    }
  }

  const saveAll = async () => {
    setSaving(true)
    const rows = generated.map((g, i) => ({
      level,
      lesson_order:      lessonOrder,
      word:              g.word,
      part_of_speech:    g.part_of_speech || null,
      definition:        g.definition || null,
      sentence:          g.sentence || null,
      translation_uz:    g.translation_uz || null,
      translation_ru:    g.translation_ru || null,
      scramble_sentence: g.scramble_sentence || null,
      word_order:        existingCount + i + 1,
    }))
    const { error: err } = await supabase.from('vocabulary_words').insert(rows)
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  const updateGenerated = (idx, field, value) => {
    const g = [...generated]; g[idx] = { ...g[idx], [field]: value }; setGenerated(g)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:150, padding:'16px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e=>e.target===e.currentTarget&&step!=='generating'&&onClose()}>
      <div style={{ background:'white', borderRadius:'24px', width:'100%', maxWidth:'560px', maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 60px rgba(0,0,0,0.25)' }}>

        <div style={{ padding:'22px 24px 16px', borderBottom:'1px solid #f0f2f1', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:'18px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                {step==='paste'?'Paste Word List':step==='confirm'?'Confirm Words':step==='generating'?'AI Generating…':'Review & Save'}
              </div>
              <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'3px' }}>
                {step==='paste'&&'Paste words separated by commas or line breaks'}
                {step==='confirm'&&`${parsed.length} word${parsed.length!==1?'s':''} detected`}
                {step==='generating'&&`${progress.done} / ${progress.total} words processed`}
                {step==='review'&&`${generated.length} words ready — edit any before saving`}
              </div>
            </div>
            {step !== 'generating' && (
              <button onClick={onClose} style={{ width:'32px', height:'32px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'16px', flexShrink:0 }}>✕</button>
            )}
          </div>
          <div style={{ display:'flex', gap:'6px', marginTop:'14px' }}>
            {['paste','confirm','generating','review'].map((s,i) => (
              <div key={s} style={{ flex:1, height:'3px', borderRadius:'3px', background:['paste','confirm','generating','review'].indexOf(step)>=i?G:'#e4e8e7', transition:'background 0.3s' }} />
            ))}
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'20px 24px' }}>

          {step==='paste' && (
            <>
              <textarea value={raw} onChange={e=>{setRaw(e.target.value);setError('')}}
                placeholder={"apple\nbeautiful\ndescription\n\nor: apple, beautiful, description"}
                rows={12}
                style={{ width:'100%', padding:'14px', borderRadius:'12px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', resize:'vertical', fontFamily:"'DM Sans',sans-serif", lineHeight:1.6, boxSizing:'border-box', color:D }} />
              {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginTop:'8px' }}>{error}</div>}
            </>
          )}

          {step==='confirm' && (
            <div>
              <div style={{ background:'#f8fafb', borderRadius:'12px', padding:'14px', maxHeight:'340px', overflowY:'auto', marginBottom:'4px' }}>
                {parsed.map((w,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'7px 0', borderBottom:i<parsed.length-1?'1px solid #f0f2f1':'none' }}>
                    <span style={{ fontSize:'12px', fontWeight:'700', color:'#94a3b8', minWidth:'28px' }}>{i+1}.</span>
                    <span style={{ fontSize:'15px', fontWeight:'600', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{w}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:'12px', display:'flex', gap:'8px', alignItems:'center' }}>
                <button onClick={()=>setStep('paste')} style={{ padding:'8px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>← Edit list</button>
                <div style={{ flex:1, fontSize:'12px', color:'#94a3b8' }}>AI will generate content for all {parsed.length} words.</div>
              </div>
              {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginTop:'8px' }}>{error}</div>}
            </div>
          )}

          {step==='generating' && (
            <div style={{ textAlign:'center', padding:'40px 20px' }}>
              <div style={{ fontSize:'48px', marginBottom:'16px' }}>🤖</div>
              <div style={{ fontSize:'17px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif", marginBottom:'6px' }}>AI is generating…</div>
              <div style={{ fontSize:'14px', color:'#94a3b8', marginBottom:'24px' }}>{progress.current && `Currently: "${progress.current}"`}</div>
              <div style={{ background:'#f0f2f1', borderRadius:'8px', overflow:'hidden', height:'8px', maxWidth:'300px', margin:'0 auto 12px' }}>
                <div style={{ height:'100%', background:G, borderRadius:'8px', width:`${progress.total?(progress.done/progress.total)*100:0}%`, transition:'width 0.4s' }} />
              </div>
              <div style={{ fontSize:'13px', color:'#94a3b8', fontWeight:'600' }}>{progress.done} / {progress.total} words</div>
            </div>
          )}

          {step==='review' && (
            <div>
              {generated.map((g, i) => (
                <div key={i} style={{ background:'#f8fafb', borderRadius:'12px', padding:'12px 14px', marginBottom:'8px', display:'flex', alignItems:'flex-start', gap:'12px' }}>
                  <span style={{ fontSize:'12px', fontWeight:'700', color:'#94a3b8', minWidth:'24px', paddingTop:'2px' }}>{i+1}.</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'3px' }}>
                      <div style={{ fontSize:'15px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{g.word}</div>
                      {g.part_of_speech && <PosBadge pos={g.part_of_speech} />}
                    </div>
                    {g.definition && <div style={{ fontSize:'12px', color:'#64748b', marginBottom:'2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{g.definition}</div>}
                    {(g.translation_uz || g.translation_ru) && (
                      <div style={{ fontSize:'11px', color:'#94a3b8' }}>
                        {g.translation_uz && `🇺🇿 ${g.translation_uz}`}
                        {g.translation_uz && g.translation_ru && ' · '}
                        {g.translation_ru && `🇷🇺 ${g.translation_ru}`}
                      </div>
                    )}
                  </div>
                  <button onClick={()=>setEditIdx(i)}
                    style={{ padding:'5px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'12px', fontWeight:'600', cursor:'pointer', flexShrink:0 }}>
                    Edit
                  </button>
                </div>
              ))}

              {editIdx !== null && (
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'16px' }}>
                  <div style={{ background:'white', borderRadius:'20px', padding:'24px', width:'100%', maxWidth:'440px', maxHeight:'85vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'16px' }}>
                      <span style={{ fontSize:'16px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Edit: {generated[editIdx].word}</span>
                      <button onClick={()=>setEditIdx(null)} style={{ width:'28px', height:'28px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'14px' }}>✕</button>
                    </div>

                    {/* Part of speech */}
                    <label style={lbl}>Part of Speech</label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'14px' }}>
                      {POS_OPTIONS.map(pos => {
                        const active = generated[editIdx].part_of_speech === pos
                        const c = POS_COLORS[pos] || { bg:'#f0f2f1', color:'#64748b' }
                        return (
                          <button key={pos} type="button" onClick={() => updateGenerated(editIdx, 'part_of_speech', active ? '' : pos)}
                            style={{ padding:'4px 10px', borderRadius:'8px', border:`1.5px solid ${active?c.color:'#e4e8e7'}`, background:active?c.bg:'white', color:active?c.color:'#64748b', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
                            {pos}
                          </button>
                        )
                      })}
                    </div>

                    {/* Translation */}
                    {(isBeginner || isElementary) && (
                      <>
                        <label style={lbl}>Translation</label>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'14px' }}>
                          <div>
                            <div style={{ fontSize:'10px', fontWeight:'700', color:'#92400e', marginBottom:'4px' }}>🇺🇿 Uzbek</div>
                            <input value={generated[editIdx].translation_uz} onChange={e=>updateGenerated(editIdx,'translation_uz',e.target.value)}
                              placeholder="Uzbek…" style={{ ...inp, borderColor:'#fde68a' }} />
                          </div>
                          <div>
                            <div style={{ fontSize:'10px', fontWeight:'700', color:'#166534', marginBottom:'4px' }}>🇷🇺 Russian</div>
                            <input value={generated[editIdx].translation_ru} onChange={e=>updateGenerated(editIdx,'translation_ru',e.target.value)}
                              placeholder="Russian…" style={{ ...inp, borderColor:'#86efac' }} />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Definition */}
                    {!isBeginner && (
                      <>
                        <label style={lbl}>Definition</label>
                        <textarea value={generated[editIdx].definition} onChange={e=>updateGenerated(editIdx,'definition',e.target.value)}
                          rows={2} style={{ ...inp, resize:'vertical', lineHeight:1.5, marginBottom:'12px' }} />
                      </>
                    )}

                    {/* Sentence */}
                    {!isBeginner && (
                      <>
                        <label style={lbl}>Sentence <span style={{ fontWeight:'400', textTransform:'none', color:'#94a3b8' }}>(use ___)</span></label>
                        <input value={generated[editIdx].sentence} onChange={e=>updateGenerated(editIdx,'sentence',e.target.value)}
                          style={{ ...inp, marginBottom:'12px' }} />
                      </>
                    )}

                    {/* Scramble sentence */}
                    {isBeginner && (
                      <>
                        <label style={lbl}>Scrambled Sentence</label>
                        <input value={generated[editIdx].scramble_sentence} onChange={e=>updateGenerated(editIdx,'scramble_sentence',e.target.value)}
                          placeholder="e.g. I play football every day."
                          style={{ ...inp, marginBottom:'12px' }} />
                      </>
                    )}

                    <button onClick={()=>setEditIdx(null)} style={{ width:'100%', padding:'12px', borderRadius:'12px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Done</button>
                  </div>
                </div>
              )}

              {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginTop:'8px' }}>{error}</div>}
            </div>
          )}
        </div>

        {step !== 'generating' && (
          <div style={{ padding:'16px 24px 20px', borderTop:'1px solid #f0f2f1', flexShrink:0 }}>
            {step==='paste'   && <button onClick={confirm} style={{ width:'100%', padding:'14px', borderRadius:'14px', border:'none', background:raw.trim()?G:'#e4e8e7', color:'white', fontSize:'15px', fontWeight:'700', cursor:raw.trim()?'pointer':'default', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Preview Word List →</button>}
            {step==='confirm' && <button onClick={generate} style={{ width:'100%', padding:'14px', borderRadius:'14px', border:'none', background:G, color:'white', fontSize:'15px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>✨ Generate with AI →</button>}
            {step==='review'  && (
              <div style={{ display:'flex', gap:'10px' }}>
                <button onClick={()=>setStep('paste')} style={{ flex:1, padding:'13px', borderRadius:'12px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Start over</button>
                <button onClick={saveAll} disabled={saving} style={{ flex:2, padding:'13px', borderRadius:'12px', border:'none', background:saving?'#c4cdd6':G, color:'white', fontSize:'14px', fontWeight:'700', cursor:saving?'default':'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                  {saving?'Saving…':`✓ Save All ${generated.length} Words`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── MAIN VOCAB ADMIN ───────────────────────────────────────────────────────────
export default function VocabAdmin() {
  const [levels,         setLevels]         = useState([])
  const [selectedLevel,  setSelectedLevel]  = useState('')
  const [lessons,        setLessons]        = useState([])
  const [wordCounts,     setWordCounts]     = useState({})
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [words,          setWords]          = useState([])
  const [loading,        setLoading]        = useState(false)
  const [showImport,     setShowImport]     = useState(false)
  const [editWord,       setEditWord]       = useState(null)

  useEffect(() => {
    supabase.from('level_lessons').select('level').order('level').then(({ data }) => {
      const unique = [...new Set((data||[]).map(r=>r.level))]
      setLevels(unique)
      if (unique[0]) setSelectedLevel(unique[0])
    })
  }, [])

  useEffect(() => {
    if (!selectedLevel) return
    setSelectedLesson(null); setWords([]); setWordCounts({})
    let cancelled = false
    ;(async () => {
      // Lessons for this level
      const { data: ls } = await supabase.from('level_lessons').select('*').eq('level',selectedLevel)
        .not('lesson_name','ilike','%Mid-Term%').not('lesson_name','ilike','%Final%')
        .order('lesson_order')
      if (!cancelled) setLessons(ls||[])

      // Per-lesson word counts.
      // IMPORTANT: Supabase caps every request at 1000 rows, so a single
      // .select() only ever returns the first 1000 words of the level — which is
      // why Total Words stuck at 1000 and any lesson whose words fell past that
      // boundary showed "Empty". Page through every row (1000 at a time, ordered
      // by a unique column so pages never skip or repeat) and tally in memory.
      const PAGE = 1000
      const counts = {}
      let from = 0
      while (true) {
        const { data, error } = await supabase.from('vocabulary_words')
          .select('lesson_order')
          .eq('level', selectedLevel)
          .order('id', { ascending: true })
          .range(from, from + PAGE - 1)
        if (error || !data) break
        for (const w of data) counts[w.lesson_order] = (counts[w.lesson_order] || 0) + 1
        if (data.length < PAGE) break
        from += PAGE
      }
      if (!cancelled) setWordCounts(counts)
    })()
    return () => { cancelled = true }
  }, [selectedLevel])

  useEffect(() => { if (selectedLesson) fetchWords() }, [selectedLesson])

  const fetchWords = async () => {
    setLoading(true)
    const { data } = await supabase.from('vocabulary_words').select('*')
      .eq('level',selectedLevel).eq('lesson_order',selectedLesson.lesson_order)
      .order('word_order')
    setWords(data||[])
    setWordCounts(prev=>({...prev,[selectedLesson.lesson_order]:(data||[]).length}))
    setLoading(false)
  }

  const deleteWord = async (id) => {
    if (!confirm('Delete this word?')) return
    await supabase.from('vocabulary_words').delete().eq('id',id)
    fetchWords()
  }

  const totalWords     = Object.values(wordCounts).reduce((a,b)=>a+b,0)
  const coveredLessons = Object.values(wordCounts).filter(c=>c>0).length

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        .level-tab:hover{opacity:.85}
        .lesson-card:hover{border-color:${G}!important;box-shadow:0 4px 16px rgba(0,148,114,.13)!important;}
        .word-row:hover{background:#f8fafb!important;}
        .lesson-card,.word-row{transition:all .15s;}
      `}</style>

      {/* Stats */}
      {selectedLevel && (
        <div style={{ display:'flex', gap:'12px', marginBottom:'24px', flexWrap:'wrap' }}>
          {[
            { label:'Total Words',     value:totalWords,                       icon:'📚', color:G },
            { label:'Lessons Covered', value:`${coveredLessons}/${lessons.length}`, icon:'✅', color:'#6366f1' },
            { label:'Level',           value:selectedLevel,                    icon:'🎓', color:'#f59e0b' },
          ].map(s => (
            <div key={s.label} style={{ flex:1, minWidth:'140px', background:'white', borderRadius:'14px', padding:'14px 18px', border:'1px solid #f0f2f1', boxShadow:'0 1px 6px rgba(0,0,0,0.05)', display:'flex', alignItems:'center', gap:'12px' }}>
              <span style={{ fontSize:'22px' }}>{s.icon}</span>
              <div>
                <div style={{ fontSize:'18px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1 }}>{s.value}</div>
                <div style={{ fontSize:'11px', color:'#94a3b8', fontWeight:'600', marginTop:'3px' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Level tabs */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'24px', overflowX:'auto', paddingBottom:'4px' }}>
        {levels.map(l => {
          const active = l === selectedLevel
          return (
            <button key={l} className="level-tab" onClick={()=>setSelectedLevel(l)}
              style={{ padding:'8px 18px', borderRadius:'999px', border:`2px solid ${active?G:'#e4e8e7'}`, background:active?G:'white', color:active?'white':D, fontSize:'13px', fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap', fontFamily:"'Plus Jakarta Sans',sans-serif", flexShrink:0, transition:'all .15s', boxShadow:active?`0 3px 12px ${G}35`:'none' }}>
              {l}
            </button>
          )
        })}
      </div>

      {/* Lesson grid */}
      {!selectedLesson && lessons.length > 0 && (
        <div>
          <div style={{ fontSize:'12px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:'12px' }}>Select a lesson</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:'10px' }}>
            {lessons.map(l => {
              const count = wordCounts[l.lesson_order] || 0
              const done  = count > 0
              return (
                <div key={l.lesson_order} className="lesson-card" onClick={()=>setSelectedLesson(l)}
                  style={{ background:'white', borderRadius:'14px', padding:'16px', border:`2px solid ${done?`${G}30`:'#f0f2f1'}`, cursor:'pointer', boxShadow:'0 1px 6px rgba(0,0,0,0.05)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                    <span style={{ fontSize:'11px', fontWeight:'700', color:done?G:'#94a3b8', background:done?`${G}12`:'#f0f2f1', padding:'3px 8px', borderRadius:'6px' }}>
                      {done?`${count} words`:'Empty'}
                    </span>
                    <span style={{ fontSize:'16px' }}>{done?'📗':'📄'}</span>
                  </div>
                  <div style={{ fontSize:'11px', color:'#94a3b8', fontWeight:'600', marginBottom:'3px' }}>Lesson {l.lesson_order}</div>
                  <div style={{ fontSize:'13px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1.3 }}>{l.lesson_name}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Selected lesson word list */}
      {selectedLesson && (
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
            <button onClick={()=>{setSelectedLesson(null);setWords([])}}
              style={{ width:'34px', height:'34px', borderRadius:'10px', border:'1.5px solid #e4e8e7', background:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#64748b', flexShrink:0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:'11px', color:'#94a3b8', fontWeight:'700', textTransform:'uppercase', letterSpacing:'.05em' }}>{selectedLevel} · Lesson {selectedLesson.lesson_order}</div>
              <div style={{ fontSize:'18px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1.2 }}>{selectedLesson.lesson_name}</div>
            </div>
            <button onClick={()=>setShowImport(true)}
              style={{ padding:'10px 20px', borderRadius:'10px', border:'none', background:G, color:'white', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif", display:'flex', alignItems:'center', gap:'7px', boxShadow:`0 3px 14px ${G}45`, flexShrink:0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Import Words
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:'60px', color:'#94a3b8' }}>Loading words…</div>
          ) : words.length === 0 ? (
            <div style={{ textAlign:'center', padding:'70px 24px', background:'white', borderRadius:'16px', border:'2px dashed #e4e8e7' }}>
              <div style={{ fontSize:'40px', marginBottom:'12px' }}>📝</div>
              <div style={{ fontSize:'16px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>No words yet</div>
              <div style={{ fontSize:'13px', color:'#94a3b8', marginTop:'6px', marginBottom:'20px' }}>Import words and let AI generate definitions and translations.</div>
              <button onClick={()=>setShowImport(true)} style={{ padding:'11px 24px', borderRadius:'12px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                + Import Words
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {words.map((w, i) => {
                const hasImages = w.picture_url && w.picture_url_2 && w.picture_url_3 && w.picture_url_4
                return (
                  <div key={w.id} className="word-row"
                    style={{ background:'white', borderRadius:'12px', padding:'12px 16px', display:'flex', alignItems:'center', gap:'12px', border:'1px solid #f0f2f1' }}>
                    <span style={{ fontSize:'11px', fontWeight:'700', color:'#cbd5e1', minWidth:'22px', textAlign:'right' }}>{i+1}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'4px', marginBottom:'2px' }}>
                        <div style={{ fontSize:'14px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{w.word}</div>
                        {w.part_of_speech && <PosBadge pos={w.part_of_speech} />}
                      </div>
                      <div style={{ fontSize:'12px', color:'#64748b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {w.definition || (w.translation_uz ? `🇺🇿 ${w.translation_uz}` : '')}
                      </div>
                    </div>
                    {hasImages
                      ? <div style={{ display:'flex', gap:'3px', alignItems:'center', flexShrink:0 }}>
                          {[w.picture_url,w.picture_url_2,w.picture_url_3,w.picture_url_4].map((u,j) => (
                            <img key={j} src={u} alt="" style={{ width:'24px', height:'24px', borderRadius:'5px', objectFit:'cover', border:`1px solid ${j===0?G:'#e4e8e7'}` }} />
                          ))}
                        </div>
                      : <span style={{ fontSize:'10px', fontWeight:'600', padding:'3px 8px', borderRadius:'6px', background:'#fff7ed', color:'#f59e0b', flexShrink:0 }}>No images</span>
                    }
                    <button onClick={()=>setEditWord(w)} style={{ padding:'6px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'12px', fontWeight:'600', cursor:'pointer', flexShrink:0 }}>Edit</button>
                    <button onClick={()=>deleteWord(w.id)} style={{ width:'28px', height:'28px', borderRadius:'8px', border:'1.5px solid #fca5a5', background:'white', color:'#ef4444', fontSize:'14px', fontWeight:'700', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {showImport && (
        <ImportModal level={selectedLevel} lessonOrder={selectedLesson.lesson_order} existingCount={words.length}
          onClose={()=>setShowImport(false)} onSaved={()=>{setShowImport(false);fetchWords()}} />
      )}
      {editWord && (
        <EditWordModal word={editWord} level={selectedLevel} lessonOrder={selectedLesson?.lesson_order}
          onClose={()=>setEditWord(null)} onSaved={()=>{setEditWord(null);fetchWords()}} />
      )}
    </div>
  )
}