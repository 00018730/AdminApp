import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { logEdit } from './editLog'

const G = '#009472'
const D = '#002b2a'

const iStyle = { width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, fontFamily:"'DM Sans',sans-serif", marginBottom:'12px', boxSizing:'border-box', background:'white' }
const lStyle = { fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'5px' }

const PARENT_ROLES = ['Father', 'Mother', 'Guardian']

// ── UZ phone formatting: digits → "+998 (90) 123-45-67" ──────────────────────
function formatUzPhone(raw) {
  const d = (raw || '').replace(/\D/g, '').replace(/^998/, '').slice(0, 9)
  let out = '+998'
  if (d.length > 0) out += ' (' + d.slice(0, 2)
  if (d.length >= 2) out += ')'
  if (d.length > 2) out += ' ' + d.slice(2, 5)
  if (d.length > 5) out += '-' + d.slice(5, 7)
  if (d.length > 7) out += '-' + d.slice(7, 9)
  return out
}
function phoneDigits(formatted) { return (formatted || '').replace(/\D/g, '').replace(/^998/, '') }
function telHref(formatted) { const d = phoneDigits(formatted); return d ? `tel:+998${d}` : null }

const EMPTY = { full_name:'', username:'', password:'', student_username:'', parent_role:'', phone:'', phone_2:'' }

export default function ParentsSection({ role, readOnly = false, canDelete }) {
  // Add → everyone. Delete → manager + CEO (not admin).
  const canDeleteResolved = canDelete != null ? canDelete : (role === 'manager' || role === 'ceo')

  const [parents, setParents]   = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')
  // phone fields are kept as raw digits in state; displayed formatted
  const [form, setForm] = useState(EMPTY)

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

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    if (!form.full_name || !form.username || !form.password || !form.student_username) { setError('Name, username, password and student are required.'); return }
    if (!form.parent_role) { setError('Choose Father / Mother / Guardian.'); return }
    if (!form.phone) { setError('Primary phone is required.'); return }
    setSaving(true); setError('')
    const payload = {
      full_name: form.full_name.trim(),
      username: form.username.trim(),
      password: form.password,
      student_username: form.student_username,
      parent_role: form.parent_role,
      phone: formatUzPhone(form.phone),
      phone_2: form.phone_2 ? formatUzPhone(form.phone_2) : null,
    }
    const { error: err } = await supabase.from('parents').insert(payload)
    if (err) { setError(err.code === '23505' ? 'That username already exists.' : err.message); setSaving(false); return }
    logEdit({ action:'create', target_table:'parents', target_id:payload.username, summary:`Added parent ${payload.full_name} (${payload.parent_role})` })
    await fetchAll(); setShowForm(false); setForm(EMPTY); setSaving(false)
  }

  const del = async (p) => {
    if (!confirm(`Delete parent account "${p.username}"?`)) return
    await supabase.from('parents').delete().eq('username', p.username)
    logEdit({ action:'delete', target_table:'parents', target_id:p.username, summary:`Deleted parent ${p.full_name || p.username}` })
    fetchAll()
  }

  const listed = parents.filter(p => !search ||
    p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.username?.toLowerCase().includes(search.toLowerCase()) ||
    p.students?.full_name?.toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'#94a3b8', fontSize:'14px' }}>Loading...</div>

  const headers = ['Parent','Role','Phone','Linked Student','Created', canDeleteResolved ? '' : null].filter(h => h !== null)

  return (
    <div>
      <style>{`select{-webkit-appearance:none;-moz-appearance:none}`}</style>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'22px', flexWrap:'wrap', gap:'10px' }}>
        <div style={{ fontSize:'14px', color:'#94a3b8', marginTop:'2px' }}>{parents.length} parent accounts</div>
        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'13px', outline:'none', width:'180px' }} />
          <button onClick={() => { setForm(EMPTY); setError(''); setShowForm(true) }} style={{ padding:'9px 18px', borderRadius:'8px', border:'none', background:G, color:'white', fontSize:'13px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap' }}>+ Add parent</button>
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
              {headers.map((h,i) => (
                <th key={i} style={{ padding:'11px 16px', textAlign:'left', fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listed.map((p,i) => (
              <tr key={i} style={{ borderBottom:i<listed.length-1?'1px solid #f0f2f1':'none' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafb'}
                onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                <td style={{ padding:'12px 16px' }}>
                  <div style={{ fontWeight:'600', color:D }}>{p.full_name}</div>
                  <div style={{ fontSize:'12px', color:'#94a3b8', fontFamily:'monospace' }}>{p.username}</div>
                </td>
                <td style={{ padding:'12px 16px' }}>
                  {p.parent_role
                    ? <span style={{ fontSize:'12px', fontWeight:'700', padding:'3px 10px', borderRadius:'20px', background:'#eef2ff', color:'#4338ca' }}>{p.parent_role}</span>
                    : <span style={{ color:'#cbd5e1' }}>—</span>}
                </td>
                <td style={{ padding:'12px 16px', fontSize:'13px' }}>
                  {p.phone
                    ? <div style={{ display:'flex', flexDirection:'column', gap:'2px' }}>
                        <a href={telHref(p.phone)} style={{ color:G, fontWeight:'600', textDecoration:'none' }}>{p.phone}</a>
                        {p.phone_2 && <a href={telHref(p.phone_2)} style={{ color:'#94a3b8', fontWeight:'500', textDecoration:'none', fontSize:'12px' }}>{p.phone_2}</a>}
                      </div>
                    : <span style={{ color:'#cbd5e1' }}>—</span>}
                </td>
                <td style={{ padding:'12px 16px' }}>
                  <span style={{ fontSize:'13px', fontWeight:'600', padding:'3px 10px', borderRadius:'20px', background:`${G}12`, color:G }}>
                    {p.students?.full_name || '—'}
                  </span>
                </td>
                <td style={{ padding:'12px 16px', color:'#94a3b8', fontSize:'13px' }}>{p.created_at?.slice(0,10)}</td>
                {canDeleteResolved && (
                  <td style={{ padding:'12px 16px' }}>
                    <button onClick={() => del(p)} style={{ padding:'5px 12px', borderRadius:'6px', border:'1.5px solid #fca5a5', background:'#fef2f2', color:'#dc2626', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
            {!listed.length && (
              <tr><td colSpan={headers.length} style={{ padding:'48px', textAlign:'center' }}>
                <div style={{ fontSize:'36px', marginBottom:'10px' }}>👨‍👩‍👧</div>
                <div style={{ fontSize:'15px', fontWeight:'700', color:D, marginBottom:'4px' }}>No parent accounts yet</div>
                <div style={{ fontSize:'13px', color:'#94a3b8' }}>Create accounts for parents to monitor their child's progress</div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'24px' }}
          onClick={e => e.target===e.currentTarget && setShowForm(false)}>
          <div style={{ background:'white', borderRadius:'16px', padding:'28px', width:'100%', maxWidth:'440px', boxShadow:'0 24px 64px rgba(0,0,0,0.18)', maxHeight:'92vh', overflowY:'auto' }}>
            <h3 style={{ fontSize:'18px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'20px' }}>Create Parent Account</h3>

            <label style={lStyle}>Parent Full Name</label>
            <input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="e.g. Aziz Karimov" style={iStyle} />

            <label style={lStyle}>Parent</label>
            <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
              {PARENT_ROLES.map(r => (
                <button key={r} type="button" onClick={() => set('parent_role', r)}
                  style={{ flex:1, padding:'9px 4px', borderRadius:'9px', border:`1.5px solid ${form.parent_role===r?G:'#e4e8e7'}`, background:form.parent_role===r?`${G}12`:'white', color:form.parent_role===r?G:'#64748b', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
                  {r}
                </button>
              ))}
            </div>

            <label style={lStyle}>Username</label>
            <input value={form.username} onChange={e => set('username', e.target.value)} placeholder="e.g. aziz_parent" style={iStyle} />

            <label style={lStyle}>Password</label>
            <input value={form.password} onChange={e => set('password', e.target.value)} placeholder="Set a password" style={iStyle} />

            <label style={lStyle}>Primary phone (required)</label>
            <input value={formatUzPhone(form.phone)} onChange={e => set('phone', phoneDigits(e.target.value))} placeholder="+998 (__) ___-__-__" style={iStyle} />

            <label style={lStyle}>Secondary phone (optional)</label>
            <input value={formatUzPhone(form.phone_2)} onChange={e => set('phone_2', phoneDigits(e.target.value))} placeholder="+998 (__) ___-__-__" style={iStyle} />

            <label style={lStyle}>Linked Student</label>
            <select value={form.student_username} onChange={e => set('student_username', e.target.value)} style={{ ...iStyle, appearance:'none' }}>
              <option value="">Select student...</option>
              {students.map(s => <option key={s.username} value={s.username}>{s.full_name}</option>)}
            </select>

            {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginBottom:'10px' }}>{error}</div>}

            <div style={{ display:'flex', gap:'10px', marginTop:'8px' }}>
              <button onClick={() => { setShowForm(false); setForm(EMPTY) }}
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