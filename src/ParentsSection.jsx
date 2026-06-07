import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const G = '#009472'
const D = '#002b2a'

const iStyle = { width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, fontFamily:"'DM Sans',sans-serif", marginBottom:'12px', boxSizing:'border-box', background:'white' }
const lStyle = { fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'5px' }

export default function ParentsSection({ readOnly = false }) {
  const [parents, setParents]   = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')
  const [form, setForm] = useState({ full_name:'', username:'', password:'', student_username:'' })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data:p }, { data:s }] = await Promise.all([
      supabase.from('parents').select('*,students(full_name)').order('created_at',{ascending:false}),
      supabase.from('students').select('username,full_name').eq('status','active').order('full_name'),
    ])
    if (p) setParents(p)
    if (s) setStudents(s)
    setLoading(false)
  }

  const save = async () => {
    if (!form.full_name || !form.username || !form.password || !form.student_username) { alert('All fields required'); return }
    setSaving(true)
    const { error } = await supabase.from('parents').insert(form)
    if (error) { alert('Error: '+error.message); setSaving(false); return }
    await fetchAll(); setShowForm(false); setForm({ full_name:'', username:'', password:'', student_username:'' }); setSaving(false)
  }

  const del = async (username) => {
    if (!confirm(`Delete parent account "${username}"?`)) return
    await supabase.from('parents').delete().eq('username', username)
    fetchAll()
  }

  const listed = parents.filter(p => !search ||
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.username?.toLowerCase().includes(search.toLowerCase()) ||
    p.students?.full_name?.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'#94a3b8', fontSize:'14px' }}>Loading...</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'22px', flexWrap:'wrap', gap:'10px' }}>
        <div style={{ fontSize:'14px', color:'#94a3b8', marginTop:'2px' }}>{parents.length} parent accounts</div>
        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'13px', outline:'none', width:'180px' }} />
          {/* Add parent — admin only */}
          {!readOnly && (
            <button onClick={() => setShowForm(true)} style={{ padding:'9px 18px', borderRadius:'8px', border:'none', background:G, color:'white', fontSize:'13px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap' }}>+ Add parent</button>
          )}
        </div>
      </div>

      <div style={{ background:`${G}08`, borderRadius:'12px', padding:'14px 18px', marginBottom:'20px', border:`1px solid ${G}25`, display:'flex', gap:'12px', alignItems:'flex-start' }}>
        <span style={{ fontSize:'20px', flexShrink:0 }}>ℹ️</span>
        <div style={{ fontSize:'13px', color:'#374151', lineHeight:'1.6' }}>
          Parent accounts give parents read-only access to their child's attendance, homework grades, and payments.
        </div>
      </div>

      <div style={{ background:'white', borderRadius:'12px', border:'1.5px solid #e4e8e7', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'14px' }}>
          <thead>
            <tr style={{ background:'#f8fafb', borderBottom:'1.5px solid #e4e8e7' }}>
              {['Parent Name','Username','Linked Student','Created', !readOnly ? '' : null].filter(Boolean).map(h => (
                <th key={h} style={{ padding:'11px 16px', textAlign:'left', fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listed.map((p,i) => (
              <tr key={i} style={{ borderBottom:i<listed.length-1?'1px solid #f0f2f1':'none' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafb'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                <td style={{ padding:'12px 16px', fontWeight:'600', color:D }}>{p.full_name}</td>
                <td style={{ padding:'12px 16px', color:'#64748b', fontFamily:'monospace', fontSize:'13px' }}>{p.username}</td>
                <td style={{ padding:'12px 16px' }}>
                  <span style={{ fontSize:'13px', fontWeight:'600', padding:'3px 10px', borderRadius:'20px', background:`${G}12`, color:G }}>
                    {p.students?.full_name || '—'}
                  </span>
                </td>
                <td style={{ padding:'12px 16px', color:'#94a3b8', fontSize:'13px' }}>{p.created_at?.slice(0,10)}</td>
                {/* Delete — admin only */}
                {!readOnly && (
                  <td style={{ padding:'12px 16px' }}>
                    <button onClick={() => del(p.username)} style={{ padding:'5px 12px', borderRadius:'6px', border:'1.5px solid #fca5a5', background:'#fef2f2', color:'#dc2626', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
            {!listed.length && (
              <tr><td colSpan="5" style={{ padding:'48px', textAlign:'center' }}>
                <div style={{ fontSize:'36px', marginBottom:'10px' }}>👨‍👩‍👧</div>
                <div style={{ fontSize:'15px', fontWeight:'700', color:D, marginBottom:'4px' }}>No parent accounts yet</div>
                <div style={{ fontSize:'13px', color:'#94a3b8' }}>Create accounts for parents to monitor their child's progress</div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}
          onClick={e => e.target===e.currentTarget && setShowForm(false)}>
          <div style={{ background:'white', borderRadius:'16px', padding:'28px', width:'420px', boxShadow:'0 24px 64px rgba(0,0,0,0.18)' }}>
            <h3 style={{ fontSize:'18px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'20px' }}>Create Parent Account</h3>
            {[{l:'Parent Full Name',k:'full_name',ph:"e.g. Aziz Karimov"},{l:'Username',k:'username',ph:'e.g. aziz_parent'},{l:'Password',k:'password',ph:'Set a password'}].map(f => (
              <div key={f.k}>
                <label style={lStyle}>{f.l}</label>
                <input value={form[f.k]} onChange={e => setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={iStyle} />
              </div>
            ))}
            <label style={lStyle}>Linked Student</label>
            <select value={form.student_username} onChange={e => setForm(p=>({...p,student_username:e.target.value}))} style={iStyle}>
              <option value="">Select student...</option>
              {students.map(s => <option key={s.username} value={s.username}>{s.full_name}</option>)}
            </select>
            <div style={{ display:'flex', gap:'10px', marginTop:'8px' }}>
              <button onClick={() => { setShowForm(false); setForm({ full_name:'', username:'', password:'', student_username:'' }) }}
                style={{ flex:1, padding:'12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
              <button onClick={save} disabled={saving}
                style={{ flex:1, padding:'12px', borderRadius:'8px', border:'none', background:G, color:'white', fontSize:'14px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'700', cursor:'pointer' }}>
                {saving?'Creating...':'Create account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}