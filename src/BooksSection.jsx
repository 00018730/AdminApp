import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const G = '#009472'
const D = '#002b2a'
const OR = '#E8470A'

const LEVEL_ORDER = [
  'Beginner','Elementary','Pre-Intermediate',
  'Intermediate','Upper-Intermediate','IELTS Foundation','IELTS Proficiency'
]
const LESSON_COUNTS = {
  'Beginner':13, 'Elementary':40, 'Pre-Intermediate':40, 'Intermediate':40,
  'Upper-Intermediate':40, 'IELTS Foundation':46, 'IELTS Proficiency':46,
}
const LEVEL_COLORS = {
  'Beginner':'#f5a623', 'Elementary':'#3b82f6', 'Pre-Intermediate':G,
  'Intermediate':'#059669', 'Upper-Intermediate':'#8b5cf6',
  'IELTS Foundation':'#0ea5e9', 'IELTS Proficiency':'#7c3aed',
}

const iStyle = { width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, fontFamily:"'DM Sans',sans-serif", marginBottom:'12px', boxSizing:'border-box', background:'white' }
const lStyle = { fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'5px' }

function dayLabel(day) { return day === 'odd' ? 'Mon / Wed / Fri' : 'Tue / Thu / Sat' }

// The warning fires from "Unit 9.1" through the end of the level (Final Exam),
// staying on until the group advances. We anchor to the REAL lesson names in
// level_lessons (robust to the Unit 0 start + Mid-Term/Final exam insertions)
// rather than computing units from lesson_order. Beginner has no "Unit 9", so it
// falls back to its last few lessons (10–13).
function fallbackThreshold(level) {
  const total = LESSON_COUNTS[level] || 40
  if (level === 'Beginner') return total - 3   // 10
  return total - 7
}
// Given a level's lessons (ordered), return the lesson_order at which the warning
// should start — the first lesson whose name begins with "Unit 9", else fallback.
function warnFromOrder(level, lessons) {
  const u9 = (lessons || []).find(l => /^\s*unit\s*9\b/i.test(l.lesson_name || ''))
  if (u9) return u9.lesson_order
  return fallbackThreshold(level)
}
function nextLevelOf(level) {
  const i = LEVEL_ORDER.indexOf(level)
  return (i >= 0 && i < LEVEL_ORDER.length - 1) ? LEVEL_ORDER[i + 1] : null
}

// ── add / edit a book ─────────────────────────────────────────────────────────
function BookModal({ editing, presetLevel, onClose, onSaved }) {
  const isEdit = !!editing
  const [level, setLevel] = useState(editing?.level || presetLevel || 'Elementary')
  const [name,  setName]  = useState(editing?.name || '')
  const [qty,   setQty]   = useState(editing ? String(editing.quantity) : '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const save = async () => {
    if (!name.trim()) { setError('Enter the book name.'); return }
    const q = parseInt(qty, 10)
    if (isNaN(q) || q < 0) { setError('Enter a valid quantity.'); return }
    setSaving(true); setError('')
    const payload = { kind:'book', level, name:name.trim(), quantity:q }
    const { error: err } = isEdit
      ? await supabase.from('book_inventory').update(payload).eq('id', editing.id)
      : await supabase.from('book_inventory').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'16px', padding:'26px', width:'100%', maxWidth:'420px', boxShadow:'0 24px 64px rgba(0,0,0,0.18)' }}>
        <h3 style={{ fontSize:'18px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'18px' }}>{isEdit ? 'Edit book' : 'Add book'}</h3>

        <label style={lStyle}>Level</label>
        <select value={level} onChange={e => setLevel(e.target.value)} disabled={isEdit} style={{ ...iStyle, appearance:'none', opacity:isEdit?0.6:1 }}>
          {LEVEL_ORDER.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <label style={lStyle}>Book name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Student's Book" style={iStyle} />

        <label style={lStyle}>Quantity in stock</label>
        <input type="number" min="0" value={qty} onChange={e => setQty(e.target.value)} placeholder="e.g. 12" style={iStyle} />

        {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginBottom:'12px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'10px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex:2, padding:'12px', borderRadius:'10px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {saving ? 'Saving…' : isEdit ? 'Save' : 'Add book'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BooksSection() {
  const [books,    setBooks]    = useState([])
  const [notebook, setNotebook] = useState(null)   // single book_inventory row, kind='notebook'
  const [groups,   setGroups]   = useState([])
  const [teachers, setTeachers] = useState([])
  const [levelLessons, setLevelLessons] = useState({})  // { level: [{lesson_order, lesson_name}] }
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(null)    // { editing } | { presetLevel }
  const [nbEdit,   setNbEdit]   = useState(false)
  const [nbVal,    setNbVal]    = useState('')

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: inv }, { data: grp }, { data: tch }, { data: ll }] = await Promise.all([
      supabase.from('book_inventory').select('*').order('created_at'),
      supabase.from('groups').select('*'),
      supabase.from('teachers').select('username,full_name'),
      supabase.from('level_lessons').select('level,lesson_order,lesson_name'),
    ])
    const rows = inv || []
    setBooks(rows.filter(r => r.kind === 'book'))
    setNotebook(rows.find(r => r.kind === 'notebook') || null)
    setGroups(grp || [])
    setTeachers(tch || [])
    // group lessons by level, ordered
    const map = {}
    ;(ll || []).forEach(l => { (map[l.level] = map[l.level] || []).push(l) })
    Object.values(map).forEach(arr => arr.sort((a,b) => (a.lesson_order||0) - (b.lesson_order||0)))
    setLevelLessons(map)
    setLoading(false)
  }

  const tName = u => teachers.find(t => t.username === u)?.full_name || u

  const saveNotebook = async () => {
    const q = parseInt(nbVal, 10)
    if (isNaN(q) || q < 0) { setNbEdit(false); return }
    if (notebook) await supabase.from('book_inventory').update({ quantity:q }).eq('id', notebook.id)
    else          await supabase.from('book_inventory').insert({ kind:'notebook', name:'Notebooks', quantity:q })
    setNbEdit(false); fetchAll()
  }

  const delBook = async (b) => {
    if (!confirm(`Remove "${b.name}" (${b.level}) from inventory?`)) return
    await supabase.from('book_inventory').delete().eq('id', b.id)
    fetchAll()
  }

  // Groups approaching a level change → order next level's books.
  // Uses real lesson names (level_lessons) to find "Unit 9.1" and warns from
  // there to the end of the level, until the group advances.
  const warnings = groups
    .map(g => {
      const order = g.current_lesson_order || 0
      const next  = nextLevelOf(g.level)
      if (!g.level || !next) return null
      const lessons = levelLessons[g.level] || []
      if (order < warnFromOrder(g.level, lessons)) return null
      const currentName = lessons.find(l => l.lesson_order === order)?.lesson_name || `lesson ${order}`
      return { group:g, next, currentName }
    })
    .filter(Boolean)
    .sort((a,b) => (b.group.current_lesson_order||0) - (a.group.current_lesson_order||0))

  // Books grouped by level (in level order)
  const byLevel = LEVEL_ORDER
    .map(level => ({ level, items: books.filter(b => b.level === level) }))
    .filter(x => x.items.length > 0)

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'#94a3b8', fontSize:'14px' }}>Loading…</div>

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`select{-webkit-appearance:none;-moz-appearance:none}`}</style>

      {/* ── ORDER-AHEAD WARNINGS ── */}
      {warnings.length > 0 && (
        <div style={{ marginBottom:'24px' }}>
          <div style={{ fontSize:'13px', fontWeight:'800', color:OR, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'10px', display:'flex', alignItems:'center', gap:'7px' }}>
            ⚠ Order books soon
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {warnings.map(({ group, next, currentName }) => (
              <div key={group.id} style={{ background:'#fff7ed', border:'1.5px solid #fed7aa', borderRadius:'12px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:`${OR}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>📚</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'14px', fontWeight:'700', color:D }}>
                    This group is graduating {group.level} — do you have enough books for {next}?
                  </div>
                  <div style={{ fontSize:'12px', color:'#92400e', marginTop:'2px' }}>
                    {tName(group.teacher_username)} · {dayLabel(group.day)} · {group.class_time} · {currentName}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── NOTEBOOKS (general) ── */}
      <div style={{ background:'white', border:'1.5px solid #e4e8e7', borderRadius:'14px', padding:'18px 20px', marginBottom:'24px', display:'flex', alignItems:'center', gap:'16px' }}>
        <div style={{ width:'48px', height:'48px', borderRadius:'14px', background:`${G}12`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', flexShrink:0 }}>📒</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'15px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Notebooks</div>
          <div style={{ fontSize:'12px', color:'#94a3b8' }}>General stock (not level-based)</div>
        </div>
        {nbEdit ? (
          <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
            <input type="number" min="0" value={nbVal} onChange={e => setNbVal(e.target.value)} autoFocus
              style={{ width:'90px', padding:'8px 10px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'15px', fontWeight:'700', color:D, outline:'none', textAlign:'center' }} />
            <button onClick={saveNotebook} style={{ padding:'8px 14px', borderRadius:'8px', border:'none', background:G, color:'white', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>Save</button>
            <button onClick={() => setNbEdit(false)} style={{ padding:'8px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>✕</button>
          </div>
        ) : (
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <span style={{ fontSize:'26px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{notebook?.quantity ?? 0}</span>
            <button onClick={() => { setNbVal(String(notebook?.quantity ?? 0)); setNbEdit(true) }}
              style={{ padding:'8px 14px', borderRadius:'8px', border:`1.5px solid ${G}`, background:`${G}10`, color:G, fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Edit</button>
          </div>
        )}
      </div>

      {/* ── BOOKS BY LEVEL ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
        <div style={{ fontSize:'15px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Books by level</div>
        <button onClick={() => setModal({ editing:null })}
          style={{ padding:'9px 18px', borderRadius:'8px', border:'none', background:G, color:'white', fontSize:'13px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'700', cursor:'pointer' }}>+ Add book</button>
      </div>

      {byLevel.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', background:'white', borderRadius:'14px', border:'1.5px solid #e4e8e7' }}>
          <div style={{ fontSize:'40px', marginBottom:'12px' }}>📚</div>
          <div style={{ fontSize:'16px', fontWeight:'700', color:D, marginBottom:'4px', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>No books added yet</div>
          <div style={{ fontSize:'13px', color:'#94a3b8' }}>Use “Add book” to record what each level uses and how many you have.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          {byLevel.map(({ level, items }) => {
            const color = LEVEL_COLORS[level] || G
            const total = items.reduce((a,b) => a + (b.quantity||0), 0)
            return (
              <div key={level} style={{ background:'white', border:'1.5px solid #e4e8e7', borderRadius:'14px', overflow:'hidden' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 18px', borderBottom:'1px solid #f0f2f1' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <span style={{ fontSize:'11px', fontWeight:'800', padding:'3px 10px', borderRadius:'20px', background:`${color}15`, color }}>{level}</span>
                    <span style={{ fontSize:'12px', color:'#94a3b8' }}>{items.length} title{items.length!==1?'s':''} · {total} in stock</span>
                  </div>
                  <button onClick={() => setModal({ editing:null, presetLevel:level })}
                    style={{ padding:'6px 12px', borderRadius:'8px', border:`1.5px solid ${G}`, background:'white', color:G, fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>+ Add</button>
                </div>
                {items.map((b,i) => (
                  <div key={b.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'13px 18px', borderBottom:i<items.length-1?'1px solid #f5f5f5':'none' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'14px', fontWeight:'700', color:D }}>{b.name}</div>
                    </div>
                    <div style={{ textAlign:'right', flexShrink:0 }}>
                      <span style={{ fontSize:'18px', fontWeight:'800', color:b.quantity>0?D:'#ef4444', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{b.quantity}</span>
                      <span style={{ fontSize:'11px', color:'#94a3b8', marginLeft:'4px' }}>in stock</span>
                    </div>
                    <button onClick={() => setModal({ editing:b })} style={{ padding:'7px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', background:'white', color:D, fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>Edit</button>
                    <button onClick={() => delBook(b)} style={{ width:'30px', height:'30px', borderRadius:'8px', border:'1.5px solid #fde8e8', background:'white', color:'#ef4444', fontSize:'16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'800' }}>×</button>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <BookModal
          editing={modal.editing}
          presetLevel={modal.presetLevel}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchAll() }}
        />
      )}
    </div>
  )
}