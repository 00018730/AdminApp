import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const G = '#009472'
const D = '#002b2a'
const TIMES = ['9:30','14:30','16:30','18:30']

function formatPhone(val) {
  const digits = val.replace(/\D/g,'').slice(0,12)
  if (!digits.length) return ''
  let r = '+998'
  if (digits.length > 3) r += ' (' + digits.slice(3,5)
  if (digits.length > 5) r += ') ' + digits.slice(5,8)
  if (digits.length > 8) r += '-' + digits.slice(8,10)
  if (digits.length > 10) r += '-' + digits.slice(10,12)
  return r
}

const iStyle = { width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, fontFamily:"'DM Sans',sans-serif", marginBottom:'12px', boxSizing:'border-box', background:'white' }
const lStyle = { fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'5px' }

export default function StudentsSection() {
  const [teachers, setTeachers]           = useState([])
  const [students, setStudents]           = useState([])
  const [selTeacher, setSelTeacher]       = useState(null)
  const [selGroup, setSelGroup]           = useState(null) // {day,time}
  const [showForm, setShowForm]           = useState(false)
  const [editing, setEditing]             = useState(null)
  const [saving, setSaving]               = useState(false)
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [form, setForm] = useState({ full_name:'', username:'', password:'', phone:'', day:'odd', class_time:'', teacher_username:'', enrolled_date:'', status:'active' })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: t }, { data: s }] = await Promise.all([
      supabase.from('teachers').select('*').order('full_name'),
      supabase.from('students').select('*').order('full_name'),
    ])
    if (t) setTeachers(t)
    if (s) setStudents(s)
    setLoading(false)
  }

  const groupStudents = (teacher, day, time) =>
    students.filter(s => s.teacher_username === teacher && s.day === day && s.class_time === time && s.status !== 'left')

  const openAdd = () => {
    setEditing(null)
    setForm({ full_name:'', username:'', password:'', phone:'', day: selGroup?.day || 'odd', class_time: selGroup?.time || '', teacher_username: selTeacher?.username || '', enrolled_date:'', status:'active' })
    setShowForm(true)
  }

  const openEdit = (s) => {
    setEditing(s)
    setForm({ full_name: s.full_name, username: s.username, password: s.password || '', phone: s.phone || '', day: s.day, class_time: s.class_time, teacher_username: s.teacher_username, enrolled_date: s.enrolled_date || '', status: s.status || 'active' })
    setShowForm(true)
  }

  const save = async () => {
    if (!form.full_name || !form.username || !form.password) { alert('Name, username and password are required'); return }
    setSaving(true)
    if (editing) {
      await supabase.from('students').update({ full_name:form.full_name, password:form.password, phone:form.phone||null, day:form.day, class_time:form.class_time, teacher_username:form.teacher_username, enrolled_date:form.enrolled_date||null, status:form.status }).eq('username', editing.username)
    } else {
      const { error } = await supabase.from('students').insert({ ...form, phone:form.phone||null, enrolled_date:form.enrolled_date||null })
      if (error) { alert('Error: ' + error.message); setSaving(false); return }
    }
    await fetchAll(); setShowForm(false); setSaving(false)
  }

  const del = async (username) => {
    if (!confirm(`Delete "${username}"?`)) return
    await supabase.from('students').delete().eq('username', username)
    await fetchAll()
  }

  const listed = selGroup
    ? groupStudents(selTeacher?.username, selGroup.day, selGroup.time).filter(s => !search || s.full_name.toLowerCase().includes(search.toLowerCase()) || s.username.toLowerCase().includes(search.toLowerCase()))
    : []

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'#94a3b8', fontSize:'14px' }}>Loading...</div>

  return (
    <div style={{ display:'flex', gap:'20px', height:'100%' }}>

      {/* Teachers column */}
      <div style={{ width:'200px', flexShrink:0 }}>
        <p style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'10px' }}>Teachers</p>
        {teachers.map(t => {
          const cnt = students.filter(s => s.teacher_username === t.username && s.status !== 'left').length
          const active = selTeacher?.username === t.username
          return (
            <button key={t.username} onClick={() => { setSelTeacher(t); setSelGroup(null); setSearch('') }}
              style={{ width:'100%', padding:'11px 13px', borderRadius:'10px', border:`1.5px solid ${active ? G : '#e4e8e7'}`, background: active ? `${G}12` : 'white', textAlign:'left', cursor:'pointer', marginBottom:'6px', transition:'all 0.15s' }}>
              <div style={{ fontSize:'14px', fontWeight:'700', color: active ? G : D, lineHeight:'1.2' }}>{t.full_name}</div>
              <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'2px' }}>{cnt} students</div>
            </button>
          )
        })}
        {!teachers.length && <p style={{ fontSize:'13px', color:'#94a3b8' }}>No teachers</p>}
      </div>

      {/* Groups column */}
      {selTeacher && (
        <div style={{ width:'180px', flexShrink:0 }}>
          <p style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'10px' }}>Groups</p>
          {['odd','even'].map(day => (
            <div key={day} style={{ marginBottom:'12px' }}>
              <p style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', marginBottom:'5px', letterSpacing:'0.04em' }}>{day === 'odd' ? 'Mon·Wed·Fri' : 'Tue·Thu·Sat'}</p>
              {TIMES.map(time => {
                const cnt = groupStudents(selTeacher.username, day, time).length
                const active = selGroup?.day === day && selGroup?.time === time
                return (
                  <button key={time} onClick={() => { setSelGroup({ day, time }); setSearch('') }}
                    style={{ width:'100%', padding:'8px 12px', borderRadius:'8px', border:`1.5px solid ${active ? G : '#e4e8e7'}`, background: active ? `${G}12` : 'white', textAlign:'left', cursor:'pointer', marginBottom:'4px', display:'flex', justifyContent:'space-between', alignItems:'center', transition:'all 0.15s' }}>
                    <span style={{ fontSize:'13px', fontWeight:'600', color: active ? G : D }}>{time}</span>
                    <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 7px', borderRadius:'4px', background: active ? G : '#f0f2f1', color: active ? 'white' : '#94a3b8' }}>{cnt}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Students table */}
      {selGroup && (
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', gap:'10px', flexWrap:'wrap' }}>
            <div>
              <div style={{ fontSize:'17px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D }}>
                {selTeacher?.full_name} · {selGroup.day === 'odd' ? 'Mon/Wed/Fri' : 'Tue/Thu/Sat'} · {selGroup.time}
              </div>
              <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px' }}>{groupStudents(selTeacher.username, selGroup.day, selGroup.time).length} students</div>
            </div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ padding:'8px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'13px', outline:'none', width:'150px' }} />
              <button onClick={openAdd} style={{ padding:'9px 18px', borderRadius:'8px', border:'none', background:G, color:'white', fontSize:'13px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap' }}>+ Add student</button>
            </div>
          </div>

          <div style={{ background:'white', borderRadius:'12px', border:'1.5px solid #e4e8e7', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'14px' }}>
              <thead>
                <tr style={{ background:'#f8fafb', borderBottom:'1.5px solid #e4e8e7' }}>
                  {['Full Name','Username','Phone','Enrolled','Status','Actions'].map(h => (
                    <th key={h} style={{ padding:'11px 16px', textAlign:'left', fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {listed.map((s, i) => (
                  <tr key={s.username} style={{ borderBottom: i < listed.length-1 ? '1px solid #f0f2f1' : 'none', transition:'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <td style={{ padding:'12px 16px', fontWeight:'600', color:D }}>{s.full_name}</td>
                    <td style={{ padding:'12px 16px', color:'#64748b', fontFamily:'monospace', fontSize:'13px' }}>{s.username}</td>
                    <td style={{ padding:'12px 16px', color:'#64748b', fontSize:'13px' }}>{s.phone || '—'}</td>
                    <td style={{ padding:'12px 16px', color:'#64748b', fontSize:'13px' }}>{s.enrolled_date || '—'}</td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{ fontSize:'11px', fontWeight:'700', padding:'3px 10px', borderRadius:'20px', background: s.status==='active' ? `${G}15` : '#fef2f2', color: s.status==='active' ? G : '#dc2626' }}>{s.status||'active'}</span>
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <div style={{ display:'flex', gap:'6px' }}>
                        <button onClick={() => openEdit(s)} style={{ padding:'5px 12px', borderRadius:'6px', border:'1.5px solid #e4e8e7', background:'white', color:D, fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>Edit</button>
                        <button onClick={() => del(s.username)} style={{ padding:'5px 12px', borderRadius:'6px', border:'1.5px solid #fca5a5', background:'#fef2f2', color:'#dc2626', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!listed.length && (
                  <tr><td colSpan="6" style={{ padding:'40px', textAlign:'center', color:'#94a3b8', fontSize:'14px' }}>
                    {search ? 'No students match your search' : 'No students in this group yet'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Placeholder when nothing selected */}
      {!selTeacher && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'12px', color:'#94a3b8' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <p style={{ fontSize:'14px' }}>Select a teacher to see groups</p>
        </div>
      )}
      {selTeacher && !selGroup && (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:'12px', color:'#94a3b8' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <p style={{ fontSize:'14px' }}>Select a group to see students</p>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}
          onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{ background:'white', borderRadius:'16px', padding:'28px', width:'460px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.18)' }}>
            <h3 style={{ fontSize:'18px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'20px' }}>{editing ? 'Edit Student' : 'Add New Student'}</h3>

            {[{l:'Full Name *',k:'full_name',ph:'e.g. Malika Abdurashitova'},{l:'Username *',k:'username',ph:'e.g. malika_a',dis:!!editing},{l:'Password *',k:'password',ph:'Set a password'}].map(f => (
              <div key={f.k}>
                <label style={lStyle}>{f.l}</label>
                <input value={form[f.k]} onChange={e => setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} disabled={f.dis} style={{...iStyle,opacity:f.dis?.6:1}} />
              </div>
            ))}

            <label style={lStyle}>Phone</label>
            <input value={form.phone} onChange={e => setForm(p=>({...p,phone:formatPhone(e.target.value)}))} placeholder="+998 (90) 123-45-67" style={iStyle} />

            <label style={lStyle}>Enrolled Date</label>
            <input type="date" value={form.enrolled_date} onChange={e => setForm(p=>({...p,enrolled_date:e.target.value}))} style={iStyle} />

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div>
                <label style={lStyle}>Day</label>
                <select value={form.day} onChange={e => setForm(p=>({...p,day:e.target.value}))} style={iStyle}>
                  <option value="odd">Odd (Mon/Wed/Fri)</option>
                  <option value="even">Even (Tue/Thu/Sat)</option>
                </select>
              </div>
              <div>
                <label style={lStyle}>Time</label>
                <select value={form.class_time} onChange={e => setForm(p=>({...p,class_time:e.target.value}))} style={iStyle}>
                  <option value="">Select time...</option>
                  {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <label style={lStyle}>Teacher</label>
            <select value={form.teacher_username} onChange={e => setForm(p=>({...p,teacher_username:e.target.value}))} style={iStyle}>
              <option value="">Select teacher...</option>
              {teachers.map(t => <option key={t.username} value={t.username}>{t.full_name}</option>)}
            </select>

            <label style={lStyle}>Status</label>
            <select value={form.status} onChange={e => setForm(p=>({...p,status:e.target.value}))} style={iStyle}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="left">Left</option>
            </select>

            <div style={{ display:'flex', gap:'10px', marginTop:'8px' }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:'12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex:1, padding:'12px', borderRadius:'8px', border:'none', background:G, color:'white', fontSize:'14px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'700', cursor:'pointer' }}>{saving ? 'Saving...' : editing ? 'Save changes' : 'Add student'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}