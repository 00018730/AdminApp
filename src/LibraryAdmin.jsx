import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const G = '#009472'
const D = '#002b2a'

const CATEGORY_META = {
  'Numbers':       { icon:'🔢' }, 'Ordinals':      { icon:'🥇' },
  'Countries':     { icon:'🌍' }, 'Nationalities': { icon:'🧑' },
  'Weekdays':      { icon:'📅' }, 'Months':        { icon:'🗓️' },
  'Animals':       { icon:'🐾' }, 'Insects':       { icon:'🐛' },
  'Fruits':        { icon:'🍎' }, 'Vegetables':    { icon:'🥕' },
  'Family':        { icon:'👨‍👩‍👧' }, 'Names':         { icon:'🔤' },
  'Capitals':      { icon:'🏛️' },
}

const lbl = { fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px' }
const inp = (extra = {}) => ({ width:'100%', padding:'11px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, fontFamily:"'DM Sans',sans-serif", boxSizing:'border-box', ...extra })

// ── ADD / EDIT ITEM MODAL ─────────────────────────────────────────────────────
function ItemModal({ item, category, maxOrder, onClose, onSaved }) {
  const isEdit = !!item
  const [term,   setTerm]   = useState(item?.term || '')
  const [uz,     setUz]     = useState(item?.translation_uz || '')
  const [ru,     setRu]     = useState(item?.translation_ru || '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const save = async () => {
    if (!term.trim()) { setError('English term is required.'); return }
    setSaving(true); setError('')
    if (isEdit) {
      const { error: err } = await supabase.from('starter_content').update({
        term: term.trim(), translation_uz: uz.trim() || null, translation_ru: ru.trim() || null,
      }).eq('id', item.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { error: err } = await supabase.from('starter_content').insert({
        category, term: term.trim(), translation_uz: uz.trim() || null,
        translation_ru: ru.trim() || null, sort_order: maxOrder + 1,
      })
      if (err) { setError(err.message); setSaving(false); return }
    }
    onSaved()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'20px', padding:'26px', width:'100%', maxWidth:'420px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
          <span style={{ fontSize:'17px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {isEdit ? 'Edit Item' : `Add to ${category}`}
          </span>
          <button onClick={onClose} style={{ width:'30px', height:'30px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'15px' }}>✕</button>
        </div>

        <label style={lbl}>English Term *</label>
        <input value={term} onChange={e => setTerm(e.target.value)} placeholder="e.g. elephant" style={{ ...inp(), marginBottom:'14px' }} />

        <label style={lbl}>🇺🇿 Uzbek Translation</label>
        <input value={uz} onChange={e => setUz(e.target.value)} placeholder="e.g. fil" style={{ ...inp(), marginBottom:'14px' }} />

        <label style={lbl}>🇷🇺 Russian Translation</label>
        <input value={ru} onChange={e => setRu(e.target.value)} placeholder="e.g. слон" style={{ ...inp(), marginBottom:'16px' }} />

        {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginBottom:'12px' }}>{error}</div>}

        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'12px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving}
            style={{ flex:2, padding:'12px', borderRadius:'12px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── NEW CATEGORY MODAL ────────────────────────────────────────────────────────
function NewCategoryModal({ existing, onClose, onCreated }) {
  const [name,   setName]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const create = async () => {
    const trimmed = name.trim()
    if (!trimmed) { setError('Category name is required.'); return }
    if (existing.map(c => c.toLowerCase()).includes(trimmed.toLowerCase())) {
      setError('This category already exists.'); return
    }
    // Insert a placeholder so the category shows up immediately
    setSaving(true); setError('')
    const { error: err } = await supabase.from('starter_content').insert({
      category: trimmed, term: '(add items below)', translation_uz: null, translation_ru: null, sort_order: 0,
    })
    if (err) { setError(err.message); setSaving(false); return }
    onCreated(trimmed)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'20px', padding:'26px', width:'100%', maxWidth:'380px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
          <span style={{ fontSize:'17px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>New Category</span>
          <button onClick={onClose} style={{ width:'30px', height:'30px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'15px' }}>✕</button>
        </div>
        <div style={{ background:`${G}0d`, borderRadius:'10px', padding:'10px 12px', marginBottom:'16px', fontSize:'12px', color:'#0f766e', lineHeight:1.5 }}>
          💡 This will create a new topic in the student Library. You can add words to it after creating it.
        </div>
        <label style={lbl}>Category Name *</label>
        <input value={name} onChange={e => { setName(e.target.value); setError('') }}
          placeholder="e.g. Colors, Sports, Professions…"
          style={{ ...inp(), marginBottom:'16px' }} />
        {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginBottom:'12px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'12px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
          <button onClick={create} disabled={saving}
            style={{ flex:2, padding:'12px', borderRadius:'12px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {saving ? 'Creating…' : 'Create Category'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CATEGORY DETAIL — list of items with add / edit / delete ─────────────────
function CategoryDetail({ category, onBack, onCountChange }) {
  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [addOpen,  setAddOpen]  = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const meta = CATEGORY_META[category] || { icon:'📚' }

  useEffect(() => { load() }, [category])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('starter_content').select('*').eq('category', category).order('sort_order')
    setItems(data || [])
    setLoading(false)
  }

  const afterSave = () => { setAddOpen(false); setEditItem(null); load(); onCountChange() }

  const deleteItem = async (id) => {
    setDeleting(id)
    await supabase.from('starter_content').delete().eq('id', id)
    setDeleting(null); load(); onCountChange()
  }

  // Placeholder rows (sort_order=0 with dummy term) don't count as real items
  const realItems = items.filter(i => i.sort_order > 0 || i.term !== '(add items below)')
  const maxOrder  = realItems.length > 0 ? Math.max(...realItems.map(i => i.sort_order)) : 0

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'24px' }}>
        <button onClick={onBack} style={{ width:'36px', height:'36px', borderRadius:'10px', background:'#f0f2f1', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span style={{ fontSize:'26px' }}>{meta.icon}</span>
        <div>
          <h2 style={{ fontSize:'22px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D }}>{category}</h2>
          <div style={{ fontSize:'13px', color:'#94a3b8', marginTop:'2px' }}>{realItems.length} item{realItems.length!==1?'s':''}</div>
        </div>
        <button onClick={() => setAddOpen(true)}
          style={{ marginLeft:'auto', padding:'10px 18px', borderRadius:'10px', border:'none', background:G, color:'white', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif", display:'flex', alignItems:'center', gap:'6px', flexShrink:0 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Item
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#94a3b8' }}>Loading…</div>
      ) : realItems.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', background:'white', borderRadius:'16px', border:'1px solid #f0f2f1' }}>
          <div style={{ fontSize:'40px', marginBottom:'12px' }}>📭</div>
          <div style={{ fontSize:'15px', fontWeight:'700', color:'#111', fontFamily:"'Plus Jakarta Sans',sans-serif", marginBottom:'6px' }}>No items yet</div>
          <div style={{ fontSize:'13px', color:'#94a3b8' }}>Click "Add Item" to add the first word to this category.</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px', maxWidth:'680px' }}>
          {realItems.map((item, idx) => (
            <div key={item.id} style={{ background:'white', borderRadius:'14px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'14px', border:'1px solid #f0f2f1', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:'#f0f2f1', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'700', color:'#94a3b8', flexShrink:0 }}>
                {idx + 1}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'15px', fontWeight:'700', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{item.term}</div>
                <div style={{ display:'flex', gap:'8px', marginTop:'3px', flexWrap:'wrap' }}>
                  {item.translation_uz && (
                    <span style={{ fontSize:'12px', color:'#92400e', background:'#fffbeb', padding:'1px 7px', borderRadius:'5px', fontWeight:'600' }}>🇺🇿 {item.translation_uz}</span>
                  )}
                  {item.translation_ru && (
                    <span style={{ fontSize:'12px', color:'#166534', background:'#f0fdf4', padding:'1px 7px', borderRadius:'5px', fontWeight:'600' }}>🇷🇺 {item.translation_ru}</span>
                  )}
                  {!item.translation_uz && !item.translation_ru && (
                    <span style={{ fontSize:'12px', color:'#94a3b8' }}>No translations</span>
                  )}
                </div>
              </div>
              <button onClick={() => setEditItem(item)}
                style={{ padding:'6px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'12px', fontWeight:'600', cursor:'pointer', flexShrink:0 }}>
                Edit
              </button>
              <button onClick={() => { if (window.confirm(`Delete "${item.term}"?`)) deleteItem(item.id) }}
                disabled={deleting === item.id}
                style={{ width:'32px', height:'32px', borderRadius:'8px', border:'1.5px solid #fde8e8', background:'#fff5f5', color:'#ef4444', fontSize:'16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {deleting === item.id ? '…' : '×'}
              </button>
            </div>
          ))}
        </div>
      )}

      {addOpen  && <ItemModal category={category} maxOrder={maxOrder} onClose={() => setAddOpen(false)} onSaved={afterSave} />}
      {editItem && <ItemModal item={editItem} category={category} maxOrder={maxOrder} onClose={() => setEditItem(null)} onSaved={afterSave} />}
    </div>
  )
}

// ── MAIN LIBRARY ADMIN ────────────────────────────────────────────────────────
export default function LibraryAdmin() {
  const [content,      setContent]      = useState({})   // category -> count
  const [categories,   setCategories]   = useState([])
  const [loading,      setLoading]      = useState(true)
  const [activeCategory, setActiveCategory] = useState(null)
  const [newCatOpen,   setNewCatOpen]   = useState(false)

  useEffect(() => { loadCounts() }, [])

  const loadCounts = async () => {
    setLoading(true)
    const { data } = await supabase.from('starter_content').select('category, id, sort_order, term').order('category').order('sort_order')
    const map = {}
    for (const row of data || []) {
      if (!map[row.category]) map[row.category] = []
      // exclude placeholder rows
      if (row.sort_order > 0 || row.term !== '(add items below)') map[row.category].push(row.id)
    }
    setContent(map)
    setCategories(Object.keys(map).sort())
    setLoading(false)
  }

  if (activeCategory) return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
      <CategoryDetail
        category={activeCategory}
        onBack={() => { setActiveCategory(null); loadCounts() }}
        onCountChange={loadCounts}
      />
    </div>
  )

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'24px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h2 style={{ fontSize:'20px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'4px' }}>Library</h2>
          <p style={{ fontSize:'13px', color:'#94a3b8' }}>Manage vocabulary shown to Starter students in the Student App Library.</p>
        </div>
        <button onClick={() => setNewCatOpen(true)}
          style={{ padding:'10px 18px', borderRadius:'10px', border:'none', background:G, color:'white', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif", display:'flex', alignItems:'center', gap:'6px', boxShadow:`0 3px 12px ${G}40` }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Category
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'80px', color:'#94a3b8' }}>Loading…</div>
      ) : categories.length === 0 ? (
        <div style={{ textAlign:'center', padding:'80px', background:'white', borderRadius:'16px' }}>
          <div style={{ fontSize:'48px', marginBottom:'16px' }}>📚</div>
          <div style={{ fontSize:'16px', fontWeight:'700', color:'#111', fontFamily:"'Plus Jakarta Sans',sans-serif", marginBottom:'6px' }}>No categories yet</div>
          <div style={{ fontSize:'13px', color:'#94a3b8' }}>Click "New Category" to get started.</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:'12px' }}>
          {categories.map(cat => {
            const meta  = CATEGORY_META[cat] || { icon:'📚' }
            const count = content[cat]?.length || 0
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)}
                style={{ background:'white', borderRadius:'18px', padding:'20px 18px', border:'1px solid #f0f2f1', boxShadow:'0 2px 8px rgba(0,0,0,0.05)', cursor:'pointer', textAlign:'left', display:'flex', flexDirection:'column', gap:'12px', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor=G; e.currentTarget.style.boxShadow=`0 4px 16px ${G}20` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='#f0f2f1'; e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <span style={{ fontSize:'28px' }}>{meta.icon}</span>
                  <span style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', background:'#f0f2f1', padding:'3px 8px', borderRadius:'6px' }}>{count} items</span>
                </div>
                <div>
                  <div style={{ fontSize:'16px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{cat}</div>
                  <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'3px', display:'flex', alignItems:'center', gap:'4px' }}>
                    Edit words
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {newCatOpen && (
        <NewCategoryModal
          existing={categories}
          onClose={() => setNewCatOpen(false)}
          onCreated={(name) => { setNewCatOpen(false); loadCounts(); setActiveCategory(name) }}
        />
      )}
    </div>
  )
}