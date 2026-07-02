import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { logEdit } from './editLog'

const G = '#009472'
const D = '#002b2a'

const iStyle = { width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, fontFamily:"'DM Sans',sans-serif", marginBottom:'12px', boxSizing:'border-box', background:'white' }
const lStyle = { fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'5px' }

const RELATIONS  = ['Parent', 'Sibling', 'Spouse', 'Other']
const CERT_BUCKET = 'ielts-certificates'

// ── Departments → role groups ────────────────────────────────────────────────
// existing:true  → an existing table whose every row is this group (contact-edit
//                  only; accounts come from the login system).
// existing:false → a new department table shared by role (distinguished by the
//                  `role` column = roleValue); manager/CEO can Add/Edit/Delete.
const DEPARTMENTS = [
  { id:'academic', label:'Academic', groups: [
    { key:'teacher',  table:'teachers', single:'Teacher', color:G,          existing:true,  ielts:true,  students:true },
    { key:'mentor',   table:'mentors',  single:'Mentor',  color:'#8b5cf6',  existing:true,  ielts:true },
    { key:'head',     table:'academic_staff', single:'Head Teacher',        roleValue:'Head Teacher',        color:'#0ea5e9', existing:false, ielts:true },
    { key:'counsel',  table:'academic_staff', single:'Academic Counsellor', roleValue:'Academic Counsellor', color:'#14b8a6', existing:false, ielts:true },
    { key:'rnd',      table:'academic_staff', single:'Research & Development', roleValue:'Research & Development', color:'#6366f1', existing:false },
  ]},
  { id:'administrative', label:'Administrative', groups: [
    { key:'admin',    table:'admins',   single:'Administrator', color:'#3b82f6', existing:true },
    { key:'manager',  table:'managers', single:'Manager',       color:'#f59e0b', existing:true },
    { key:'coo',      table:'administrative_staff', single:'Chief Operating Officer', roleValue:'Chief Operating Officer', color:'#8b5cf6', existing:false },
  ]},
  { id:'solutions', label:'Solutions', groups: [
    { key:'solutions', table:'solutions_staff', single:'Solutions Specialist', roleValue:'Solutions Specialist', color:'#0ea5e9', existing:false },
  ]},
  { id:'hr', label:'HR', groups: [
    { key:'hr_dir',   table:'hr_staff', single:'HR Director', roleValue:'HR Director', color:'#ec4899', existing:false },
    { key:'recruit',  table:'hr_staff', single:'Recruiter',   roleValue:'Recruiter',   color:'#f43f5e', existing:false },
  ]},
  { id:'marketing', label:'Marketing', groups: [
    { key:'mkt',      table:'marketing_staff', single:'Marketing Manager', roleValue:'Marketing Manager', color:'#f59e0b', existing:false },
  ]},
]
const ALL_TABLES = [...new Set(DEPARTMENTS.flatMap(d => d.groups.map(g => g.table)))]

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

// Shared contact fields used by both Add and Edit modals
function ContactFields({ form, set, showIelts, certFile, setCertFile, certUrl, fileRef }) {
  return (
    <>
      <label style={lStyle}>Phone number</label>
      <input value={formatUzPhone(form.phone)} onChange={e => set('phone', phoneDigits(e.target.value))} placeholder="+998 (__) ___-__-__" style={iStyle} />

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
        <div><label style={lStyle}>Joining date</label><input type="date" value={form.joining_date} onChange={e => set('joining_date', e.target.value)} style={iStyle} /></div>
        <div><label style={lStyle}>Birthday</label><input type="date" value={form.birthday} onChange={e => set('birthday', e.target.value)} style={iStyle} /></div>
        <div><label style={lStyle}>Email</label><input value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@email.com" style={iStyle} /></div>
        <div><label style={lStyle}>Telegram username</label><input value={form.telegram} onChange={e => set('telegram', e.target.value)} placeholder="@username" style={iStyle} /></div>
      </div>

      {showIelts && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr', gap:'12px', alignItems:'start' }}>
          <div>
            <label style={lStyle}>IELTS band score</label>
            <input type="number" step="0.5" min="0" max="9" value={form.ielts_score} onChange={e => set('ielts_score', e.target.value)} placeholder="e.g. 7.5" style={iStyle} />
          </div>
          <div>
            <label style={lStyle}>IELTS certificate</label>
            <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => { if (e.target.files[0]) setCertFile(e.target.files[0]) }} />
            <button onClick={() => fileRef.current?.click()} style={{ ...iStyle, textAlign:'left', cursor:'pointer', color:certFile||certUrl?D:'#94a3b8', display:'flex', alignItems:'center', gap:'8px' }}>
              <span>📎</span>{certFile ? certFile.name : certUrl ? 'Uploaded — replace' : 'Upload image…'}
            </button>
            {certUrl && !certFile && <a href={certUrl} target="_blank" rel="noreferrer" style={{ fontSize:'12px', color:G, fontWeight:'700', textDecoration:'none' }}>View current →</a>}
          </div>
        </div>
      )}

      <label style={{ ...lStyle, marginTop:'6px' }}>Emergency contact</label>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
        <select value={form.emergency_relation} onChange={e => set('emergency_relation', e.target.value)} style={{ ...iStyle, appearance:'none' }}>
          <option value="">Relation…</option>
          {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input value={form.emergency_name} onChange={e => set('emergency_name', e.target.value)} placeholder="Contact name" style={iStyle} />
        <input value={formatUzPhone(form.emergency_phone)} onChange={e => set('emergency_phone', phoneDigits(e.target.value))} placeholder="+998 (__) ___-__-__" style={{ ...iStyle, gridColumn:'1/-1' }} />
      </div>
    </>
  )
}

function buildContactPayload(form, finalCertUrl) {
  return {
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
}

const AVATAR_BUCKET = 'staff-avatars'

// Upload a cropped avatar blob; returns its public URL (or null on failure).
async function uploadAvatar(table, username, file) {
  const path = `${table}_${username}_${Date.now()}.jpg`
  const { data: up, error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { upsert: true, contentType: 'image/jpeg' })
  if (error) throw error
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(up.path).data.publicUrl
}

// ── Square crop modal: pan + zoom, exports a 400×400 JPEG ────────────────────
const CROP_V = 280, CROP_OUT = 400
function ImageCropModal({ src, onCancel, onCrop }) {
  const imgRef = useRef(null)
  const [nat, setNat]     = useState(null)     // { w, h, base }
  const [zoom, setZoom]   = useState(1)
  const [pos, setPos]     = useState({ x:0, y:0 })
  const drag = useRef(null)
  const [busy, setBusy]   = useState(false)

  const clamp = (p, base, z) => {
    const dw = nat ? nat.w * base * z : 0, dh = nat ? nat.h * base * z : 0
    return { x: Math.min(0, Math.max(CROP_V - dw, p.x)), y: Math.min(0, Math.max(CROP_V - dh, p.y)) }
  }
  const onImgLoad = (e) => {
    const w = e.target.naturalWidth, h = e.target.naturalHeight
    const base = Math.max(CROP_V / w, CROP_V / h)
    setNat({ w, h, base })
    const dw = w * base, dh = h * base
    setPos({ x:(CROP_V - dw)/2, y:(CROP_V - dh)/2 })
    setZoom(1)
  }
  const startDrag = (e) => { drag.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y }; e.currentTarget.setPointerCapture?.(e.pointerId) }
  const moveDrag  = (e) => {
    if (!drag.current || !nat) return
    const nx = drag.current.px + (e.clientX - drag.current.sx)
    const ny = drag.current.py + (e.clientY - drag.current.sy)
    setPos(clamp({ x:nx, y:ny }, nat.base, zoom))
  }
  const endDrag = () => { drag.current = null }
  const changeZoom = (z) => { setZoom(z); if (nat) setPos(p => clamp(p, nat.base, z)) }

  const confirm = () => {
    if (!nat) return
    setBusy(true)
    const s = nat.base * zoom
    const sx = -pos.x / s, sy = -pos.y / s, sSize = CROP_V / s
    const canvas = document.createElement('canvas')
    canvas.width = CROP_OUT; canvas.height = CROP_OUT
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imgRef.current, sx, sy, sSize, sSize, 0, 0, CROP_OUT, CROP_OUT)
    canvas.toBlob(b => { setBusy(false); onCrop(new File([b], 'avatar.jpg', { type:'image/jpeg' })) }, 'image/jpeg', 0.9)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:400, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target===e.currentTarget && onCancel()}>
      <div style={{ background:'white', borderRadius:'18px', padding:'22px', width:'100%', maxWidth:'340px', boxShadow:'0 24px 64px rgba(0,0,0,0.25)' }}>
        <div style={{ fontSize:'16px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif", marginBottom:'14px', textAlign:'center' }}>Adjust photo</div>
        <div style={{ width:CROP_V, height:CROP_V, margin:'0 auto', borderRadius:'50%', overflow:'hidden', position:'relative', background:'#f0f2f1', touchAction:'none', cursor:'grab', userSelect:'none' }}
          onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerLeave={endDrag}>
          <img ref={imgRef} src={src} alt="" onLoad={onImgLoad} draggable={false}
            style={{ position:'absolute', left:pos.x, top:pos.y, width: nat ? nat.w*nat.base*zoom : 'auto', height: nat ? nat.h*nat.base*zoom : 'auto', maxWidth:'none', pointerEvents:'none' }} />
          <div style={{ position:'absolute', inset:0, boxShadow:'0 0 0 2000px rgba(0,0,0,0.04) inset', borderRadius:'50%', pointerEvents:'none' }} />
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', margin:'16px 0' }}>
          <span style={{ fontSize:'13px' }}>🔍</span>
          <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={e => changeZoom(Number(e.target.value))} style={{ flex:1, accentColor:G }} />
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={onCancel} style={{ flex:1, padding:'11px', borderRadius:'10px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
          <button onClick={confirm} disabled={busy || !nat} style={{ flex:2, padding:'11px', borderRadius:'10px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {busy ? 'Saving…' : 'Use photo'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Clickable avatar that opens the crop modal; reports the cropped file up ──
function AvatarEditor({ initials, color, previewUrl, onCropped }) {
  const fileRef = useRef(null)
  const [cropSrc, setCropSrc] = useState(null)
  const pick = (e) => { const f = e.target.files?.[0]; if (f) setCropSrc(URL.createObjectURL(f)); e.target.value = '' }
  return (
    <>
      <button type="button" onClick={() => fileRef.current?.click()} title="Change photo"
        style={{ width:'64px', height:'64px', borderRadius:'16px', border:'none', padding:0, cursor:'pointer', position:'relative', overflow:'hidden', flexShrink:0, background:`${color}15` }}>
        {previewUrl
          ? <img src={previewUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
          : <span style={{ display:'flex', width:'100%', height:'100%', alignItems:'center', justifyContent:'center', fontSize:'20px', fontWeight:'800', color, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{initials}</span>}
        <span style={{ position:'absolute', bottom:0, left:0, right:0, background:'rgba(0,0,0,0.55)', color:'white', fontSize:'9px', fontWeight:'700', padding:'2px 0', textAlign:'center' }}>Edit</span>
      </button>
      <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={pick} />
      {cropSrc && <ImageCropModal src={cropSrc} onCancel={() => setCropSrc(null)} onCrop={(file) => { setCropSrc(null); onCropped(file, URL.createObjectURL(file)) }} />}
    </>
  )
}


// ════════════════════════════════════════════════════════════════════════════
// EDIT CONTACT MODAL — contact details only, keyed by username
// ════════════════════════════════════════════════════════════════════════════
function ContactModal({ person, group, onClose, onSaved }) {
  const [form, setForm] = useState({
    phone: phoneDigits(person.phone), birthday: person.birthday || '', joining_date: person.joining_date || '',
    email: person.email || '', telegram: person.telegram || '', ielts_score: person.ielts_score ?? '',
    emergency_relation: person.emergency_relation || '', emergency_name: person.emergency_name || '', emergency_phone: phoneDigits(person.emergency_phone),
  })
  const [certFile, setCertFile] = useState(null)
  const [certUrl,  setCertUrl]  = useState(person.ielts_certificate_url || null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(person.avatar_url || null)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const fileRef = useRef(null)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    setSaving(true); setError('')
    let finalCertUrl = certUrl
    if (certFile) {
      const ext  = certFile.name.split('.').pop()
      const path = `${group.table}_${person.username}_${Date.now()}.${ext}`
      const { data: up, error: upErr } = await supabase.storage.from(CERT_BUCKET).upload(path, certFile, { upsert: true })
      if (upErr) { setError('Certificate upload failed: ' + upErr.message); setSaving(false); return }
      finalCertUrl = supabase.storage.from(CERT_BUCKET).getPublicUrl(up.path).data.publicUrl
    }
    let avatarUrl = person.avatar_url || null
    if (avatarFile) {
      try { avatarUrl = await uploadAvatar(group.table, person.username, avatarFile) }
      catch (e) { setError('Photo upload failed: ' + e.message); setSaving(false); return }
    }
    const { error: err } = await supabase.from(group.table).update({ ...buildContactPayload(form, finalCertUrl), avatar_url: avatarUrl }).eq('username', person.username)
    if (err) { setError(err.message); setSaving(false); return }
    logEdit({ action:'update', target_table:group.table, target_id:person.username, summary:`Updated ${group.single} ${person.full_name || person.username} contact details` })
    onSaved()
  }

  return (
    <ModalShell title={person.full_name || person.username} subtitle={`${group.single} · tap photo to change`} color={group.color}
      avatarSlot={<AvatarEditor initials={initialsOf(person.full_name)} color={group.color} previewUrl={avatarPreview} onCropped={(file, url) => { setAvatarFile(file); setAvatarPreview(url) }} />}
      onClose={onClose}>
      <ContactFields form={form} set={set} showIelts={!!group.ielts} certFile={certFile} setCertFile={setCertFile} certUrl={certUrl} fileRef={fileRef} />
      {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginBottom:'12px' }}>{error}</div>}
      <ModalButtons saving={saving} onClose={onClose} onSave={save} saveLabel="Save contact details" />
    </ModalShell>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// ADD STAFF MODAL — new-role people (username + password + name + contact)
// ════════════════════════════════════════════════════════════════════════════
function AddStaffModal({ group, onClose, onSaved }) {
  const [form, setForm] = useState({
    username:'', password:'', full_name:'',
    phone:'', birthday:'', joining_date:'', email:'', telegram:'', ielts_score:'',
    emergency_relation:'', emergency_name:'', emergency_phone:'',
  })
  const [certFile, setCertFile] = useState(null)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const fileRef = useRef(null)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const save = async () => {
    if (!form.full_name.trim() || !form.username.trim() || !form.password) { setError('Name, username and password are required.'); return }
    setSaving(true); setError('')
    let finalCertUrl = null
    if (certFile) {
      const ext  = certFile.name.split('.').pop()
      const path = `${group.table}_${form.username.trim()}_${Date.now()}.${ext}`
      const { data: up, error: upErr } = await supabase.storage.from(CERT_BUCKET).upload(path, certFile, { upsert: true })
      if (upErr) { setError('Certificate upload failed: ' + upErr.message); setSaving(false); return }
      finalCertUrl = supabase.storage.from(CERT_BUCKET).getPublicUrl(up.path).data.publicUrl
    }
    let avatarUrl = null
    if (avatarFile) {
      try { avatarUrl = await uploadAvatar(group.table, form.username.trim(), avatarFile) }
      catch (e) { setError('Photo upload failed: ' + e.message); setSaving(false); return }
    }
    const payload = {
      username: form.username.trim(), password: form.password, full_name: form.full_name.trim(),
      ...(group.roleValue ? { role: group.roleValue } : {}), ...buildContactPayload(form, finalCertUrl), avatar_url: avatarUrl,
    }
    const { error: err } = await supabase.from(group.table).insert(payload)
    if (err) { setError(err.code === '23505' ? 'That username already exists.' : err.message); setSaving(false); return }
    logEdit({ action:'create', target_table:group.table, target_id:payload.username, summary:`Added ${group.single} ${payload.full_name}` })
    onSaved()
  }

  return (
    <ModalShell title={`Add ${group.single}`} subtitle="New staff member · tap to add photo" color={group.color}
      avatarSlot={<AvatarEditor initials="+" color={group.color} previewUrl={avatarPreview} onCropped={(file, url) => { setAvatarFile(file); setAvatarPreview(url) }} />}
      onClose={onClose}>
      <label style={lStyle}>Full name</label>
      <input value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="e.g. Dilnoza Karimova" style={iStyle} />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
        <div><label style={lStyle}>Username</label><input value={form.username} onChange={e => set('username', e.target.value)} placeholder="e.g. dilnoza" style={iStyle} /></div>
        <div><label style={lStyle}>Password</label><input value={form.password} onChange={e => set('password', e.target.value)} placeholder="Set a password" style={iStyle} /></div>
      </div>
      <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'-4px', marginBottom:'12px' }}>Username + password prepare this person for a login later.</div>
      <ContactFields form={form} set={set} showIelts={!!group.ielts} certFile={certFile} setCertFile={setCertFile} certUrl={null} fileRef={fileRef} />
      {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginBottom:'12px' }}>{error}</div>}
      <ModalButtons saving={saving} onClose={onClose} onSave={save} saveLabel={`Add ${group.single}`} />
    </ModalShell>
  )
}

// ── shared modal chrome ──────────────────────────────────────────────────────
function ModalShell({ title, subtitle, color, initials, avatarSlot, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'18px', padding:'26px', width:'100%', maxWidth:'520px', boxShadow:'0 24px 64px rgba(0,0,0,0.18)', maxHeight:'92vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'18px' }}>
          {avatarSlot || <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'15px', fontWeight:'800', color, fontFamily:"'Plus Jakarta Sans',sans-serif", flexShrink:0 }}>{initials}</div>}
          <div>
            <h3 style={{ fontSize:'17px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D }}>{title}</h3>
            <div style={{ fontSize:'12px', color:'#94a3b8' }}>{subtitle}</div>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
function ModalButtons({ saving, onClose, onSave, saveLabel }) {
  return (
    <div style={{ display:'flex', gap:'10px', marginTop:'4px' }}>
      <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'10px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
      <button onClick={onSave} disabled={saving} style={{ flex:2, padding:'12px', borderRadius:'10px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
        {saving ? 'Saving…' : saveLabel}
      </button>
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

function MemberCard({ person, group, activeStudents, canWrite, onEdit, onDelete }) {
  const color = group.color
  const emerg = emergencyText(person)
  const filled = hasContactInfo(person)
  return (
    <div style={{ background:'white', borderRadius:'16px', border:'1.5px solid #e4e8e7', overflow:'hidden' }}>
      <div style={{ height:'5px', background:`linear-gradient(90deg,${D},${color})` }} />
      <div style={{ padding:'18px 20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'13px', marginBottom:'14px' }}>
          <div style={{ width:'50px', height:'50px', borderRadius:'14px', background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'17px', fontWeight:'800', color, fontFamily:"'Plus Jakarta Sans',sans-serif", flexShrink:0, overflow:'hidden' }}>
            {person.avatar_url
              ? <img src={person.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : initialsOf(person.full_name)}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:'16px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, lineHeight:1.2 }}>{person.full_name || person.username}</div>
            <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px', fontFamily:'monospace' }}>@{person.username}</div>
          </div>
          {group.students && activeStudents != null && (
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

        {canWrite ? (
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={onEdit} style={{ flex:1, padding:'9px', borderRadius:'8px', border:`1.5px solid ${G}`, background:`${G}10`, color:G, fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
              {filled ? 'Edit contact details' : 'Add contact details'}
            </button>
            {!group.existing && onDelete && (
              <button onClick={onDelete} title="Remove" style={{ width:'40px', borderRadius:'8px', border:'1.5px solid #fca5a5', background:'#fef2f2', color:'#dc2626', fontSize:'16px', fontWeight:'800', cursor:'pointer', flexShrink:0 }}>×</button>
            )}
          </div>
        ) : (
          <div style={{ fontSize:'12px', color:'#cbd5e1', textAlign:'center', padding:'4px' }}>View only</div>
        )}
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN — TEAM by department. Manager + CEO can write; others read-only.
// ════════════════════════════════════════════════════════════════════════════
export default function TeachersSection({ role, readOnly = false }) {
  const canWrite = role === 'manager' || role === 'ceo' ? true : (role ? false : !readOnly)

  const [deptId,   setDeptId]   = useState(DEPARTMENTS[0].id)
  const [byTable,  setByTable]  = useState({})
  const [students, setStudents] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [editing,  setEditing]  = useState(null)   // { person, group }
  const [adding,   setAdding]   = useState(null)    // group

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const results = await Promise.all(ALL_TABLES.map(t => supabase.from(t).select('*').order('full_name')))
    const map = {}; ALL_TABLES.forEach((t, i) => { map[t] = results[i].data || [] })
    const { data: st } = await supabase.from('students').select('teacher_username,status')
    setByTable(map); setStudents(st || [])
    setLoading(false)
  }

  const activeCountFor = (username) => students.filter(s => s.teacher_username === username && s.status !== 'left').length
  const groupList = (g) => {
    const rows = byTable[g.table] || []
    return g.existing ? rows : rows.filter(p => p.role === g.roleValue)
  }

  const del = async (group, person) => {
    if (!confirm(`Remove ${group.single} "${person.full_name || person.username}"?`)) return
    await supabase.from(group.table).delete().eq('username', person.username)
    logEdit({ action:'delete', target_table:group.table, target_id:person.username, summary:`Removed ${group.single} ${person.full_name || person.username}` })
    fetchAll()
  }

  const dept = DEPARTMENTS.find(d => d.id === deptId) || DEPARTMENTS[0]

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`select{-webkit-appearance:none;-moz-appearance:none}`}</style>

      {/* Department tabs */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'22px', overflowX:'auto', paddingBottom:'4px' }}>
        {DEPARTMENTS.map(d => {
          const active = d.id === deptId
          const count = d.groups.reduce((a, g) => a + groupList(g).length, 0)
          return (
            <button key={d.id} onClick={() => setDeptId(d.id)}
              style={{ padding:'9px 18px', borderRadius:'999px', border:`2px solid ${active?G:'#e4e8e7'}`, background:active?G:'white', color:active?'white':D, fontSize:'13px', fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap', fontFamily:"'Plus Jakarta Sans',sans-serif", flexShrink:0, boxShadow:active?`0 3px 12px ${G}35`:'none' }}>
              {d.label} <span style={{ opacity:0.7 }}>· {loading ? '…' : count}</span>
            </button>
          )
        })}
      </div>

      {!canWrite && (
        <div style={{ fontSize:'12px', color:'#94a3b8', marginBottom:'16px' }}>You have view-only access to staff information. Managers and the CEO can edit it.</div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:'80px', color:'#94a3b8' }}>Loading…</div>
      ) : (
        dept.groups.map(g => {
          const list = groupList(g)
          return (
            <div key={g.key} style={{ marginBottom:'28px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'9px' }}>
                  <span style={{ width:'9px', height:'9px', borderRadius:'50%', background:g.color, flexShrink:0 }} />
                  <span style={{ fontSize:'15px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{g.single}</span>
                  <span style={{ fontSize:'11px', fontFamily:'monospace', background:'#f0f2f1', color:'#94a3b8', padding:'1px 8px', borderRadius:'20px' }}>{list.length}</span>
                </div>
                {canWrite && (
                  <button onClick={() => setAdding(g)} style={{ padding:'7px 14px', borderRadius:'8px', border:'none', background:G, color:'white', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>+ Add {g.single}</button>
                )}
              </div>

              {list.length === 0 ? (
                <div style={{ background:'white', borderRadius:'12px', border:'1.5px solid #f0f2f1', padding:'22px', textAlign:'center', fontSize:'13px', color:'#94a3b8' }}>
                  {`No ${g.single.toLowerCase()} yet.`}
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(310px, 1fr))', gap:'14px' }}>
                  {list.map(p => (
                    <MemberCard key={p.username} person={p} group={g}
                      activeStudents={g.students ? activeCountFor(p.username) : null}
                      canWrite={canWrite}
                      onEdit={() => setEditing({ person:p, group:g })}
                      onDelete={() => del(g, p)} />
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}

      {editing && <ContactModal person={editing.person} group={editing.group} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); fetchAll() }} />}
      {adding  && <AddStaffModal group={adding} onClose={() => setAdding(null)} onSaved={() => { setAdding(null); fetchAll() }} />}
    </div>
  )
}