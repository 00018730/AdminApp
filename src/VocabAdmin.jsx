import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const G = '#009472'
const D = '#002b2a'

const LEVELS = [
  'Beginner', 'Elementary', 'Pre-Intermediate',
  'Intermediate', 'Upper-Intermediate', 'IELTS Foundation', 'IELTS Proficiency'
]

// ── ADD / EDIT WORD FORM ──────────────────────────────────────────────────────
function WordForm({ level, lessonOrder, wordCount, onSaved, onCancel, initial }) {
  const [word,        setWord]        = useState(initial?.word        || '')
  const [definition,  setDefinition]  = useState(initial?.definition  || '')
  const [sentence,    setSentence]    = useState(initial?.sentence    || '')
  const [synonymsRaw, setSynonymsRaw] = useState((initial?.synonyms  || []).join(', '))
  const [opposRaw,    setOppRaw]      = useState((initial?.opposites  || []).join(', '))
  const [saving,      setSaving]      = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [error,       setError]       = useState('')

  // 4 quiz image slots: [correct, wrong1, wrong2, wrong3]
  const EXISTING = [initial?.picture_url||null, initial?.picture_url_2||null, initial?.picture_url_3||null, initial?.picture_url_4||null]
  const [quizFiles,    setQuizFiles]    = useState([null, null, null, null])
  const [quizPreviews, setQuizPreviews] = useState(EXISTING)
  const [quizRemoved,  setQuizRemoved]  = useState([false, false, false, false])
  const fileRefs = [useRef(null), useRef(null), useRef(null), useRef(null)]

  const handleFile = (i, file) => {
    if (!file) return
    const files = [...quizFiles];    files[i] = file;    setQuizFiles(files)
    const prev  = [...quizPreviews]; prev[i]  = URL.createObjectURL(file); setQuizPreviews(prev)
    const rem   = [...quizRemoved];  rem[i]   = false;  setQuizRemoved(rem)
  }

  const removeSlot = (i) => {
    const files = [...quizFiles];    files[i] = null;  setQuizFiles(files)
    const prev  = [...quizPreviews]; prev[i]  = null;  setQuizPreviews(prev)
    const rem   = [...quizRemoved];  rem[i]   = true;  setQuizRemoved(rem)
  }

  const uploadQuizImages = async () => {
    const urls = []
    const suffix = ['correct', 'wrong1', 'wrong2', 'wrong3']
    for (let i = 0; i < 4; i++) {
      if (quizRemoved[i] && !quizFiles[i]) { urls.push(null); continue }
      if (!quizFiles[i]) { urls.push(EXISTING[i] || null); continue }
      const ext  = quizFiles[i].name.split('.').pop()
      const path = `${level}/${lessonOrder}/${word.toLowerCase().replace(/\s+/g,'_')}_${suffix[i]}.${ext}`
      const { data: up, error: upErr } = await supabase.storage.from('vocabulary-images').upload(path, quizFiles[i], { contentType: quizFiles[i].type, upsert: true })
      if (upErr) { setError('Image upload failed: ' + upErr.message); return null }
      const { data: { publicUrl } } = supabase.storage.from('vocabulary-images').getPublicUrl(up.path)
      urls.push(publicUrl)
    }
    return urls
  }

  const save = async () => {
    if (!word.trim() || !definition.trim() || !sentence.trim()) { setError('Word, definition and sentence are required.'); return }
    if (!sentence.includes('___')) { setError('Sentence must include ___ as a blank placeholder.'); return }
    const uploadedCount = quizPreviews.filter(Boolean).length
    if (uploadedCount > 0 && uploadedCount < 4) { setError('Please upload all 4 quiz images or none.'); return }
    setError(''); setSaving(true)
    setUploading(quizFiles.some(Boolean))

    const quizUrls = await uploadQuizImages()
    setUploading(false)
    if (!quizUrls) { setSaving(false); return }

    const row = {
      level, lesson_order: lessonOrder,
      word:        word.trim(),
      definition:  definition.trim(),
      sentence:    sentence.trim(),
      synonyms:    synonymsRaw.split(',').map(s => s.trim()).filter(Boolean),
      opposites:   opposRaw.split(',').map(s => s.trim()).filter(Boolean),
      word_order:  initial?.word_order ?? wordCount,
      picture_url:   quizUrls[0],
      picture_url_2: quizUrls[1],
      picture_url_3: quizUrls[2],
      picture_url_4: quizUrls[3],
    }

    let err
    if (initial?.id) { ;({ error: err } = await supabase.from('vocabulary_words').update(row).eq('id', initial.id)) }
    else             { ;({ error: err } = await supabase.from('vocabulary_words').insert(row)) }

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  const labelStyle = { fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px' }
  const inputStyle = { width:'100%', padding:'11px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, fontFamily:"'DM Sans',sans-serif", boxSizing:'border-box', marginBottom:'16px' }

  const SLOT_LABELS = [
    { label:'✓ Correct', color:G,         bg:'#d1fae5' },
    { label:'✗ Wrong 1', color:'#ef4444', bg:'#fee2e2' },
    { label:'✗ Wrong 2', color:'#ef4444', bg:'#fee2e2' },
    { label:'✗ Wrong 3', color:'#ef4444', bg:'#fee2e2' },
  ]

  return (
    <div style={{ background:'white', borderRadius:'20px', padding:'24px', border:'1.5px solid #e4e8e7', marginBottom:'16px' }}>
      <div style={{ fontSize:'16px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'20px' }}>
        {initial ? 'Edit Word' : 'Add New Word'}
      </div>

      <label style={labelStyle}>Word *</label>
      <input value={word} onChange={e => setWord(e.target.value)} placeholder="e.g. ambitious" style={inputStyle} />

      <label style={labelStyle}>Definition *</label>
      <textarea value={definition} onChange={e => setDefinition(e.target.value)} placeholder="e.g. Having a strong desire to succeed." rows={2}
        style={{ ...inputStyle, resize:'vertical', lineHeight:1.5 }} />

      <label style={labelStyle}>Sentence with blank * <span style={{ fontWeight:'400', color:'#94a3b8' }}>(use ___ for the missing word)</span></label>
      <input value={sentence} onChange={e => setSentence(e.target.value)} placeholder="e.g. She is very ___ and wants to become a doctor." style={inputStyle} />

      <label style={labelStyle}>Synonyms <span style={{ fontWeight:'400', color:'#94a3b8' }}>(comma separated)</span></label>
      <input value={synonymsRaw} onChange={e => setSynonymsRaw(e.target.value)} placeholder="e.g. determined, driven, motivated" style={inputStyle} />

      <label style={labelStyle}>Opposites <span style={{ fontWeight:'400', color:'#94a3b8' }}>(comma separated)</span></label>
      <input value={opposRaw} onChange={e => setOppRaw(e.target.value)} placeholder="e.g. lazy, unmotivated" style={inputStyle} />

      {/* ── Quiz Images ── */}
      <div style={{ marginBottom:'16px' }}>
        <label style={labelStyle}>
          Quiz Images <span style={{ fontWeight:'400', color:'#94a3b8', textTransform:'none', fontSize:'11px' }}>optional — upload all 4 or none</span>
        </label>
        <div style={{ background:'#f8fafb', borderRadius:'14px', padding:'14px', border:'1.5px dashed #e4e8e7' }}>
          <div style={{ fontSize:'12px', color:'#94a3b8', marginBottom:'12px' }}>
            Upload the correct image and 3 wrong options. Students will pick the one that matches the word.
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            {SLOT_LABELS.map((slot, i) => (
              <div key={i} style={{ position:'relative' }}>
                {/* Badge */}
                <div style={{ display:'inline-block', fontSize:'10px', fontWeight:'800', padding:'2px 8px', borderRadius:'6px', background:slot.bg, color:slot.color, marginBottom:'6px' }}>
                  {slot.label}
                </div>

                {quizPreviews[i] ? (
                  <div style={{ position:'relative', borderRadius:'12px', overflow:'hidden', border:`2px solid ${i===0?G:'#fca5a5'}`, aspectRatio:'1' }}>
                    <img src={quizPreviews[i]} alt={slot.label} style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                    <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0)', transition:'background 0.2s', display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'6px', gap:'4px' }}>
                      <button onClick={() => fileRefs[i].current?.click()}
                        style={{ padding:'4px 8px', borderRadius:'6px', border:'none', background:'rgba(0,0,0,0.6)', color:'white', fontSize:'10px', fontWeight:'700', cursor:'pointer', width:'100%' }}>
                        Change
                      </button>
                      <button onClick={() => removeSlot(i)}
                        style={{ padding:'4px 8px', borderRadius:'6px', border:'none', background:'rgba(239,68,68,0.8)', color:'white', fontSize:'10px', fontWeight:'700', cursor:'pointer', width:'100%' }}>
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => fileRefs[i].current?.click()}
                    style={{ width:'100%', aspectRatio:'1', borderRadius:'12px', border:`2px dashed ${i===0?`${G}60`:'#e4e8e7'}`, background:'white', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'6px', color:'#94a3b8' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    <span style={{ fontSize:'11px', fontWeight:'600' }}>Upload</span>
                  </button>
                )}
                <input ref={fileRefs[i]} type="file" accept="image/*" style={{ display:'none' }}
                  onChange={e => { if (e.target.files[0]) handleFile(i, e.target.files[0]); e.target.value='' }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {error && <div style={{ padding:'10px 14px', background:'#fef2f2', borderRadius:'10px', color:'#ef4444', fontSize:'13px', fontWeight:'600', marginBottom:'14px' }}>{error}</div>}

      <div style={{ display:'flex', gap:'10px' }}>
        <button onClick={onCancel} style={{ flex:1, padding:'13px', borderRadius:'12px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Cancel</button>
        <button onClick={save} disabled={saving} style={{ flex:2, padding:'13px', borderRadius:'12px', border:'none', background:saving?'#c4cdd6':G, color:'white', fontSize:'14px', fontWeight:'700', cursor:saving?'default':'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
          {uploading?'Uploading images…':saving?'Saving…':initial?'✓ Save Changes':'+ Add Word'}
        </button>
      </div>
    </div>
  )
}

// ── VOCAB ADMIN MAIN ──────────────────────────────────────────────────────────
function VocabAdminMain() {
  const [level,       setLevelState] = useState('Pre-Intermediate')
  const [lessonOrder, setLesson]     = useState(1)
  const [lessons,     setLessons]    = useState([])
  const [words,       setWords]      = useState([])
  const [loading,     setLoading]    = useState(false)
  const [showForm,    setShowForm]   = useState(false)
  const [editWord,    setEditWord]   = useState(null)
  const topRef = useRef(null)

  useEffect(() => { fetchLessons(level) }, [level])
  useEffect(() => { fetchWords() }, [level, lessonOrder])

  const fetchLessons = async (lvl) => {
    const { data } = await supabase.from('level_lessons')
      .select('lesson_order, lesson_name')
      .eq('level', lvl)
      .not('lesson_name', 'in', '("Mid-Term Exam","Final Exam")')
      .order('lesson_order')
    const list = data || []
    setLessons(list)
    if (list.length > 0) setLesson(list[0].lesson_order)
  }

  const setLevel = (lvl) => { setLevelState(lvl) }

  const fetchWords = async () => {
    setLoading(true)
    const { data } = await supabase.from('vocabulary_words').select('*')
      .eq('level', level).eq('lesson_order', lessonOrder)
      .order('word_order').order('created_at')
    setWords(data || [])
    setLoading(false)
  }

  const deleteWord = async (id) => {
    if (!confirm('Delete this word?')) return
    await supabase.from('vocabulary_words').delete().eq('id', id)
    fetchWords()
  }

  const handleEdit = (w) => {
    setEditWord(w)
    setShowForm(false)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleSaved = () => { setShowForm(false); setEditWord(null); fetchWords() }

  const currentLesson = lessons.find(l => l.lesson_order === lessonOrder)

  return (
    <div ref={topRef} style={{ maxWidth:'600px', margin:'0 auto', padding:'24px 20px 60px', fontFamily:"'DM Sans',sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom:'24px' }}>
        <div style={{ fontSize:'24px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D }}>Vocabulary Recap</div>
        <div style={{ fontSize:'13px', color:'#94a3b8', marginTop:'2px' }}>Add words for each lesson</div>
      </div>

      {/* Level + Lesson selectors */}
      <div style={{ background:'white', borderRadius:'16px', padding:'20px', marginBottom:'20px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <div>
            <label style={{ fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px' }}>Level</label>
            <select value={level} onChange={e => setLevel(e.target.value)}
              style={{ width:'100%', padding:'11px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', color:D, fontFamily:"'DM Sans',sans-serif", outline:'none', background:'white' }}>
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px' }}>Lesson</label>
            <select value={lessonOrder} onChange={e => setLesson(Number(e.target.value))}
              style={{ width:'100%', padding:'11px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', color:D, fontFamily:"'DM Sans',sans-serif", outline:'none', background:'white' }}>
              {lessons.map(l => <option key={l.lesson_order} value={l.lesson_order}>{l.lesson_name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginTop:'12px', fontSize:'13px', color:'#94a3b8' }}>
          {level} · {currentLesson?.lesson_name || `Lesson ${lessonOrder}`} · <strong style={{ color:G }}>{words.length} word{words.length !== 1 ? 's' : ''}</strong>
        </div>
      </div>

      {/* Add word form */}
      {(showForm || editWord) && (
        <WordForm
          level={level} lessonOrder={lessonOrder} wordCount={words.length}
          initial={editWord}
          onSaved={handleSaved}
          onCancel={() => { setShowForm(false); setEditWord(null) }}
        />
      )}

      {/* Add word button */}
      {!showForm && !editWord && (
        <button onClick={() => setShowForm(true)} style={{
          width:'100%', padding:'15px', borderRadius:'14px', border:`2px dashed ${G}`,
          background:`${G}08`, color:G, fontSize:'15px', fontWeight:'700',
          cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif", marginBottom:'20px',
          display:'flex', alignItems:'center', justifyContent:'center', gap:'8px',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Word
        </button>
      )}

      {/* Word list */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'40px', color:'#94a3b8' }}>Loading...</div>
      ) : words.length === 0 && !showForm ? (
        <div style={{ textAlign:'center', padding:'40px 24px', background:'white', borderRadius:'16px' }}>
          <div style={{ fontSize:'36px', marginBottom:'10px' }}>📚</div>
          <div style={{ fontSize:'15px', fontWeight:'700', color:'#111', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>No words yet</div>
          <div style={{ fontSize:'13px', color:'#94a3b8', marginTop:'4px' }}>Click "Add Word" to start building this lesson's vocabulary.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {words.map((w, i) => (
            <div key={w.id} style={{ background:'white', borderRadius:'16px', padding:'16px 18px', boxShadow:'0 2px 8px rgba(0,0,0,0.05)', border:'1px solid #f0f2f1' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:'12px' }}>
                {w.picture_url && (
                  <img src={w.picture_url} alt={w.word} style={{ width:'56px', height:'56px', objectFit:'cover', borderRadius:'10px', flexShrink:0 }} />
                )}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                    <span style={{ fontSize:'16px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{w.word}</span>
                    <span style={{ fontSize:'11px', color:'#94a3b8', fontWeight:'600' }}>#{i+1}</span>
                  </div>
                  <div style={{ fontSize:'13px', color:'#64748b', marginBottom:'4px', lineHeight:1.4 }}>{w.definition}</div>
                  <div style={{ fontSize:'12px', color:'#94a3b8', fontStyle:'italic' }}>"{w.sentence}"</div>
                  {(w.synonyms?.length > 0 || w.opposites?.length > 0) && (
                    <div style={{ display:'flex', gap:'6px', marginTop:'8px', flexWrap:'wrap' }}>
                      {w.synonyms?.map(s => <span key={s} style={{ fontSize:'11px', padding:'2px 8px', borderRadius:'10px', background:`${G}12`, color:G, fontWeight:'600' }}>{s}</span>)}
                      {w.opposites?.map(o => <span key={o} style={{ fontSize:'11px', padding:'2px 8px', borderRadius:'10px', background:'#fef2f2', color:'#ef4444', fontWeight:'600' }}>≠ {o}</span>)}
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                  <button onClick={() => handleEdit(w)} style={{ padding:'7px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>Edit</button>
                  <button onClick={() => deleteWord(w.id)} style={{ padding:'7px 12px', borderRadius:'8px', border:'1.5px solid #fca5a5', background:'#fef2f2', color:'#ef4444', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ROOT EXPORT ───────────────────────────────────────────────────────────────
// Auth is handled by AdminApp (App.jsx) — VocabAdmin renders directly when
// the education role is active, no internal login needed.
export default function VocabAdmin() {
  return <VocabAdminMain />
}