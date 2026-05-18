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
  const [pictureFile, setPictureFile] = useState(null)
  const [picturePreview, setPreview]  = useState(initial?.picture_url || null)
  const [uploading,   setUploading]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const fileRef = useRef(null)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPictureFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const uploadImage = async () => {
    if (!pictureFile) return initial?.picture_url || null
    const ext  = pictureFile.name.split('.').pop()
    const path = `${level}/${lessonOrder}/${word.toLowerCase().replace(/\s+/g,'_')}_${Date.now()}.${ext}`
    const { data: up, error: upErr } = await supabase.storage
      .from('vocabulary-images')
      .upload(path, pictureFile, { contentType: pictureFile.type, upsert: true })
    if (upErr) { setError('Image upload failed: ' + upErr.message); return null }
    const { data: { publicUrl } } = supabase.storage.from('vocabulary-images').getPublicUrl(up.path)
    return publicUrl
  }

  const save = async () => {
    if (!word.trim() || !definition.trim() || !sentence.trim()) { setError('Word, definition and sentence are required.'); return }
    if (!sentence.includes('___')) { setError('Sentence must include ___ as a blank placeholder.'); return }
    setError('')
    setSaving(true)
    setUploading(!!pictureFile)

    const pictureUrl = await uploadImage()
    setUploading(false)

    const row = {
      level, lesson_order: lessonOrder,
      word: word.trim(),
      picture_url: pictureUrl,
      definition:  definition.trim(),
      sentence:    sentence.trim(),
      synonyms:    synonymsRaw.split(',').map(s => s.trim()).filter(Boolean),
      opposites:   opposRaw.split(',').map(s => s.trim()).filter(Boolean),
      word_order:  initial?.word_order ?? wordCount,
    }

    let err
    if (initial?.id) {
      ;({ error: err } = await supabase.from('vocabulary_words').update(row).eq('id', initial.id))
    } else {
      ;({ error: err } = await supabase.from('vocabulary_words').insert(row))
    }

    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  const labelStyle = { fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px' }
  const inputStyle = { width:'100%', padding:'11px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, fontFamily:"'DM Sans',sans-serif", boxSizing:'border-box', marginBottom:'16px' }

  return (
    <div style={{ background:'white', borderRadius:'20px', padding:'24px', border:'1.5px solid #e4e8e7', marginBottom:'16px' }}>
      <div style={{ fontSize:'16px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'20px' }}>
        {initial ? 'Edit Word' : 'Add New Word'}
      </div>

      <label style={labelStyle}>Word *</label>
      <input value={word} onChange={e => setWord(e.target.value)} placeholder="e.g. ambitious" style={inputStyle} />

      <label style={labelStyle}>Definition *</label>
      <textarea value={definition} onChange={e => setDefinition(e.target.value)} placeholder="e.g. Having a strong desire to succeed or achieve something." rows={2}
        style={{ ...inputStyle, resize:'vertical', lineHeight:1.5 }} />

      <label style={labelStyle}>Sentence with blank * <span style={{ fontWeight:'400', color:'#94a3b8' }}>(use ___ for the missing word)</span></label>
      <input value={sentence} onChange={e => setSentence(e.target.value)} placeholder="e.g. She is very ___ and wants to become a doctor." style={inputStyle} />

      <label style={labelStyle}>Synonyms <span style={{ fontWeight:'400', color:'#94a3b8' }}>(comma separated)</span></label>
      <input value={synonymsRaw} onChange={e => setSynonymsRaw(e.target.value)} placeholder="e.g. determined, driven, motivated" style={inputStyle} />

      <label style={labelStyle}>Opposites <span style={{ fontWeight:'400', color:'#94a3b8' }}>(comma separated)</span></label>
      <input value={opposRaw} onChange={e => setOppRaw(e.target.value)} placeholder="e.g. lazy, unmotivated" style={inputStyle} />

      <label style={labelStyle}>Picture <span style={{ fontWeight:'400', color:'#94a3b8' }}>(PNG or JPG, optional)</span></label>
      <div style={{ display:'flex', gap:'12px', alignItems:'flex-start', marginBottom:'16px' }}>
        {picturePreview && (
          <img src={picturePreview} alt="preview" style={{ width:'80px', height:'80px', objectFit:'cover', borderRadius:'12px', border:'1.5px solid #e4e8e7', flexShrink:0 }} />
        )}
        <button onClick={() => fileRef.current?.click()} style={{ padding:'11px 18px', borderRadius:'10px', border:'1.5px dashed #c4cdd6', background:'#f8fafb', color:'#64748b', fontSize:'13px', fontWeight:'600', cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
          {picturePreview ? '🔄 Change image' : '📁 Upload image'}
        </button>
        {picturePreview && (
          <button onClick={() => { setPictureFile(null); setPreview(null) }} style={{ padding:'11px 14px', borderRadius:'10px', border:'1.5px solid #fca5a5', background:'#fef2f2', color:'#ef4444', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>Remove</button>
        )}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" style={{ display:'none' }} onChange={handleFile} />
      </div>

      {error && <div style={{ padding:'10px 14px', background:'#fef2f2', borderRadius:'10px', color:'#ef4444', fontSize:'13px', fontWeight:'600', marginBottom:'14px' }}>{error}</div>}

      <div style={{ display:'flex', gap:'10px' }}>
        <button onClick={onCancel} style={{ flex:1, padding:'13px', borderRadius:'12px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
          Cancel
        </button>
        <button onClick={save} disabled={saving} style={{ flex:2, padding:'13px', borderRadius:'12px', border:'none', background: saving ? '#c4cdd6' : G, color:'white', fontSize:'14px', fontWeight:'700', cursor: saving ? 'default' : 'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
          {uploading ? 'Uploading image...' : saving ? 'Saving...' : initial ? '✓ Save Changes' : '+ Add Word'}
        </button>
      </div>
    </div>
  )
}

// ── VOCAB ADMIN MAIN ──────────────────────────────────────────────────────────
function VocabAdminMain() {
  const [level,       setLevel]      = useState('Pre-Intermediate')
  const [lessonOrder, setLesson]     = useState(1)
  const [words,       setWords]      = useState([])
  const [loading,     setLoading]    = useState(false)
  const [showForm,    setShowForm]   = useState(false)
  const [editWord,    setEditWord]   = useState(null)

  useEffect(() => { fetchWords() }, [level, lessonOrder])

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

  const handleSaved = () => { setShowForm(false); setEditWord(null); fetchWords() }

  return (
    <div style={{ maxWidth:'600px', margin:'0 auto', padding:'24px 20px 60px', fontFamily:"'DM Sans',sans-serif" }}>
      {/* Header */}
      <div style={{ marginBottom:'24px' }}>
        <div style={{ fontSize:'24px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D }}>Vocabulary Recap</div>
        <div style={{ fontSize:'13px', color:'#94a3b8', marginTop:'2px' }}>Add words for each lesson</div>
      </div>

      {/* Level + Lesson selectors */}
      <div style={{ background:'white', borderRadius:'16px', padding:'20px', marginBottom:'20px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 120px', gap:'12px' }}>
          <div>
            <label style={{ fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px' }}>Level</label>
            <select value={level} onChange={e => setLevel(e.target.value)} style={{ width:'100%', padding:'11px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', color:D, fontFamily:"'DM Sans',sans-serif", outline:'none', background:'white' }}>
              {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px' }}>Lesson</label>
            <input type="number" value={lessonOrder} min={1} max={52}
              onChange={e => setLesson(parseInt(e.target.value) || 1)}
              style={{ width:'100%', padding:'11px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', color:D, fontFamily:"'DM Sans',sans-serif", outline:'none', boxSizing:'border-box' }} />
          </div>
        </div>
        <div style={{ marginTop:'12px', fontSize:'13px', color:'#94a3b8' }}>
          {level} · Lesson {lessonOrder} · <strong style={{ color:G }}>{words.length} word{words.length !== 1 ? 's' : ''}</strong>
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
                  <button onClick={() => { setEditWord(w); setShowForm(false) }} style={{ padding:'7px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>Edit</button>
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