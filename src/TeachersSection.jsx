import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const G = '#009472'
const D = '#002b2a'

const iStyle = { width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, fontFamily:"'DM Sans',sans-serif", marginBottom:'12px', boxSizing:'border-box', background:'white' }
const lStyle = { fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'5px' }

const ROLES = [
  { key:'teacher', table:'teachers', label:'Teachers', single:'Teacher', color:G },
  { key:'mentor',  table:'mentors',  label:'Mentors',  single:'Mentor',  color:'#8b5cf6' },
  { key:'admin',   table:'admins',   label:'Admins',   single:'Admin',   color:'#3b82f6' },
  { key:'manager', table:'managers', label:'Manager',  single:'Manager', color:'#f59e0b' },
]
const ROLE_BY_KEY = Object.fromEntries(ROLES.map(r => [r.key, r]))
const RELATIONS = ['Parent', 'Sibling', 'Spouse', 'Other']
const CERT_BUCKET = 'ielts-certificates'

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
function initialsOf(name) { return (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() }
function emergencyText(p) {
  const parts = [p.emergency_relation, p.emergency_name, p.emergency_phone].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}
function hasContactInfo(p) {
  return !!(p.phone || p.email || p.telegram || p.birthday || p.joining_date ||
            p.ielts_score != null || p.ielts_certificate_url || emergencyText(p))
}

// ════════════════════════════════════════════════════════════════════════════
// EDIT CONTACT MODAL — contact details only; no credentials, bound to one person
// ════════════════════════════════════════════════════════════════════════════
function ContactModal({ person, role, onClose, onSaved }) {
  const [form, setForm] = useState({
    phone:     phoneDigits(person.phone),
    birthday:  person.birthday || '',
    joining_date: person.joining_date || '',
    email:     person.email || '',
    telegram:  person.telegram || '',
    ielts_score: person.ielts_score ?? '',
    emergency_relation: person.emergency_relation || '',
    emergency_name:     person.emergency_name || '',
    emergency_phone:    phoneDigits(person.emergency_phone),
  })
  const [certFile, setCertFile] = useState(null)
  const [certUrl,  setCertUrl]  = useState(person.ielts_certificate_url || null)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const fileRef = useRef(null)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    setSaving(true); setError('')

    let finalCertUrl = certUrl
    if (certFile) {
      const ext  = certFile.name.split('.').pop()
      const path = `${role}_${person.username}_${Date.now()}.${ext}`
      const { data: up, error: upErr } = await supabase.storage.from(CERT_BUCKET).upload(path, certFile, { upsert: true })
      if (upErr) { setError('Certificate upload failed: ' + upErr.message); setSaving(false); return }
      finalCertUrl = supabase.storage.from(CERT_BUCKET).getPublicUrl(up.path).data.publicUrl
    }

    const payload = {
      phone: form.phone ? formatUzPhone(form.phone) : null,
      birthday: form.birthday || null,
      joining_date: form.joining_date || null,
      email: form.email.trim() || null,
      telegram: form.telegram.trim().replace(/^@/, '') || null,
      ielts_score: form.ielts_score === '' ? null : Number(form.ielts_score),
      ielts_certificate_url: finalCertUrl || null,
      emergency_relation: form.emergency_relation || null,
      emergency_name: form.emergency_name.trim() || null,
      emergency_phone: form.emergency_phone ? formatUzPhone(form.emergency_phone) : null,
    }
    const { error: err } = await supabase.from(ROLE_BY_KEY[role].table).update(payload).eq('username', person.username)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'18px', padding:'26px', width:'100%', maxWidth:'520px', boxShadow:'0 24px 64px rgba(0,0,0,0.18)', maxHeight:'92vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'18px' }}>
          <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:`${ROLE_BY_KEY[role].color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'15px', fontWeight:'800', color:ROLE_BY_KEY[role].color, fontFamily:"'Plus Jakarta Sans',sans-serif", flexShrink:0 }}>{initialsOf(person.full_name)}</div>
          <div>
            <h3 style={{ fontSize:'17px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D }}>{person.full_name || person.username}</h3>
            <div style={{ fontSize:'12px', color:'#94a3b8' }}>{ROLE_BY_KEY[role].single} · contact details</div>
          </div>
        </div>

        <label style={lStyle}>Phone number</label>
        <input value={formatUzPhone(form.phone)} onChange={e => set('phone', phoneDigits(e.target.value))} placeholder="+998 (__) ___-__-__" style={iStyle} />

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <div>
            <label style={lStyle}>Joining date</label>
            <input type="date" value={form.joining_date} onChange={e => set('joining_date', e.target.value)} style={iStyle} />
          </div>
          <div>
            <label style={lStyle}>Birthday</label>
            <input type="date" value={form.birthday} onChange={e => set('birthday', e.target.value)} style={iStyle} />
          </div>
          <div>
            <label style={lStyle}>Email</label>
            <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@email.com" style={iStyle} />
          </div>
          <div>
            <label style={lStyle}>Telegram username</label>
            <input value={form.telegram} onChange={e => set('telegram', e.target.value)} placeholder="@username" style={iStyle} />
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr', gap:'12px', alignItems:'start' }}>
          <div>
            <label style={lStyle}>IELTS band score</label>
            <input type="number" step="0.5" min="0" max="9" value={form.ielts_score} onChange={e => set('ielts_score', e.target.value)} placeholder="e.g. 7.5" style={iStyle} />
          </div>
          <div>
            <label style={lStyle}>IELTS certificate</label>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }}
              onChange={e => { if (e.target.files[0]) setCertFile(e.target.files[0]) }} />
            <button onClick={() => fileRef.current?.click()}
              style={{ ...iStyle, textAlign:'left', cursor:'pointer', color:certFile||certUrl?D:'#94a3b8', display:'flex', alignItems:'center', gap:'8px' }}>
              <span>📎</span>{certFile ? certFile.name : certUrl ? 'Uploaded — replace' : 'Upload image…'}
            </button>
            {certUrl && !certFile && <a href={certUrl} target="_blank" rel="noreferrer" style={{ fontSize:'12px', color:G, fontWeight:'700', textDecoration:'none' }}>View current →</a>}
          </div>
        </div>

        <label style={{ ...lStyle, marginTop:'6px' }}>Emergency contact</label>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <select value={form.emergency_relation} onChange={e => set('emergency_relation', e.target.value)} style={{ ...iStyle, appearance:'none' }}>
            <option value="">Relation…</option>
            {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input value={form.emergency_name} onChange={e => set('emergency_name', e.target.value)} placeholder="Contact name" style={iStyle} />
          <input value={formatUzPhone(form.emergency_phone)} onChange={e => set('emergency_phone', phoneDigits(e.target.value))} placeholder="+998 (__) ___-__-__" style={{ ...iStyle, gridColumn:'1/-1' }} />
        </div>

        {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginBottom:'12px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'10px', marginTop:'4px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'10px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex:2, padding:'12px', borderRadius:'10px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {saving ? 'Saving…' : 'Save contact details'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// PROFILE CARD
// ════════════════════════════════════════════════════════════════════════════
function InfoRow({ icon, label, value, href }) {
  if (!value) return null
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'7px 0', borderBottom:'1px solid #f4f6f5' }}>
      <span style={{ fontSize:'14px', width:'18px', textAlign:'center', flexShrink:0 }}>{icon}</span>
      <span style={{ fontSize:'11px', color:'#94a3b8', fontWeight:'600', width:'72px', flexShrink:0 }}>{label}</span>
      {href
        ? <a href={href} target={href.startsWith('tel:')?undefined:'_blank'} rel="noreferrer" style={{ fontSize:'13px', color:G, fontWeight:'600', textDecoration:'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</a>
        : <span style={{ fontSize:'13px', color:D, fontWeight:'500', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{value}</span>}
    </div>
  )
}

function MemberCard({ person, role, activeStudents, onEdit }) {
  const color = ROLE_BY_KEY[role].color
  const emerg = emergencyText(person)
  const filled = hasContactInfo(person)
  return (
    <div style={{ background:'white', borderRadius:'16px', border:'1.5px solid #e4e8e7', overflow:'hidden' }}>
      <div style={{ height:'5px', background:`linear-gradient(90deg,${D},${color})` }} />
      <div style={{ padding:'18px 20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'13px', marginBottom:'14px' }}>
          <div style={{ width:'50px', height:'50px', borderRadius:'14px', background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'17px', fontWeight:'800', color, fontFamily:"'Plus Jakarta Sans',sans-serif", flexShrink:0 }}>{initialsOf(person.full_name)}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:'16px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, lineHeight:1.2 }}>{person.full_name || person.username}</div>
            <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px', fontFamily:'monospace' }}>@{person.username}</div>
          </div>
          {role === 'teacher' && activeStudents != null && (
            <div style={{ textAlign:'center', flexShrink:0 }}>
              <div style={{ fontSize:'18px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{activeStudents}</div>
              <div style={{ fontSize:'10px', color:'#94a3b8', fontWeight:'600' }}>students</div>
            </div>
          )}
        </div>

        {filled ? (
          <div style={{ marginBottom:'14px' }}>
            <InfoRow icon="📞" label="Phone"     value={person.phone}        href={telHref(person.phone)} />
            <InfoRow icon="✉️" label="Email"     value={person.email}        href={person.email?`mailto:${person.email}`:null} />
            <InfoRow icon="✈️" label="Telegram"  value={person.telegram?`@${person.telegram}`:null} href={person.telegram?`https://t.me/${person.telegram}`:null} />
            <InfoRow icon="🎂" label="Birthday"  value={person.birthday} />
            <InfoRow icon="📅" label="Joined"    value={person.joining_date} />
            <InfoRow icon="🎓" label="IELTS"     value={person.ielts_score != null ? `Band ${person.ielts_score}` : null} />
            <InfoRow icon="📄" label="Certif."   value={person.ielts_certificate_url ? 'View certificate' : null} href={person.ielts_certificate_url} />
            <InfoRow icon="🆘" label="Emergency" value={emerg} />
          </div>
        ) : (
          <div style={{ background:'#f8fafb', borderRadius:'10px', padding:'12px 14px', marginBottom:'14px', fontSize:'12.5px', color:'#94a3b8', textAlign:'center' }}>
            No contact details yet
          </div>
        )}

        <button onClick={onEdit} style={{ width:'100%', padding:'9px', borderRadius:'8px', border:`1.5px solid ${G}`, background:`${G}10`, color:G, fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
          {filled ? 'Edit contact details' : 'Add contact details'}
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN — TEAM (contact directory; staff accounts are created in the manager app)
// ════════════════════════════════════════════════════════════════════════════
export default function TeachersSection() {
  const [tab,      setTab]      = useState('teacher')
  const [people,   setPeople]   = useState({ teacher:[], mentor:[], admin:[], manager:[] })
  const [students, setStudents] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [editing,  setEditing]  = useState(null)   // { person, role }

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [t, m, a, mg, st] = await Promise.all([
      supabase.from('teachers').select('*').order('full_name'),
      supabase.from('mentors').select('*').order('full_name'),
      supabase.from('admins').select('*').order('full_name'),
      supabase.from('managers').select('*').order('full_name'),
      supabase.from('students').select('teacher_username,status'),
    ])
    setPeople({ teacher: t.data || [], mentor: m.data || [], admin: a.data || [], manager: mg.data || [] })
    setStudents(st.data || [])
    setLoading(false)
  }

  const activeCountFor = (username) =>
    students.filter(s => s.teacher_username === username && s.status !== 'left').length

  const list = people[tab] || []

  return (
    <div style={{ display:'flex', gap:'24px', fontFamily:"'DM Sans',sans-serif", alignItems:'flex-start' }}>
      <style>{`select{-webkit-appearance:none;-moz-appearance:none}`}</style>

      {/* Sub-sidebar */}
      <div style={{ width:'190px', flexShrink:0, background:'white', borderRadius:'14px', border:'1.5px solid #f0f2f1', padding:'8px', position:'sticky', top:'24px' }}>
        {ROLES.map(r => {
          const active = tab === r.key
          return (
            <button key={r.key} onClick={() => setTab(r.key)}
              style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 13px', borderRadius:'9px', border:'none', background:active?`${r.color}12`:'transparent', color:active?r.color:'#64748b', fontSize:'13px', fontWeight:active?'700':'500', cursor:'pointer', marginBottom:'2px', textAlign:'left', fontFamily:"'DM Sans',sans-serif" }}>
              {r.label}
              <span style={{ fontSize:'11px', fontFamily:'monospace', background:active?`${r.color}20`:'#f0f2f1', color:active?r.color:'#94a3b8', padding:'1px 7px', borderRadius:'20px' }}>{(people[r.key]||[]).length}</span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
          <div style={{ fontSize:'14px', color:'#94a3b8' }}>{loading ? 'Loading…' : `${list.length} ${ROLE_BY_KEY[tab].label.toLowerCase()}`}</div>
          <div style={{ fontSize:'12px', color:'#94a3b8' }}>Accounts are created in the manager app</div>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'80px', color:'#94a3b8' }}>Loading…</div>
        ) : list.length === 0 ? (
          <div style={{ textAlign:'center', padding:'60px', background:'white', borderRadius:'14px', border:'1.5px solid #e4e8e7' }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>👥</div>
            <div style={{ fontSize:'16px', fontWeight:'700', color:D, marginBottom:'4px', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>No {ROLE_BY_KEY[tab].label.toLowerCase()} yet</div>
            <div style={{ fontSize:'13px', color:'#94a3b8' }}>They'll appear here once the manager creates their accounts.</div>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(310px, 1fr))', gap:'14px' }}>
            {list.map(p => (
              <MemberCard key={p.username} person={p} role={tab}
                activeStudents={tab === 'teacher' ? activeCountFor(p.username) : null}
                onEdit={() => setEditing({ person:p, role:tab })} />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <ContactModal
          person={editing.person}
          role={editing.role}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchAll() }}
        />
      )}
    </div>
  )
}