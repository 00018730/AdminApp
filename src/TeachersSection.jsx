import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const G = '#009472'
const D = '#002b2a'

const iStyle = { width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, fontFamily:"'DM Sans',sans-serif", marginBottom:'12px', boxSizing:'border-box', background:'white' }
const lStyle = { fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'5px' }

export default function TeachersSection() {
  const [teachers, setTeachers] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [saving, setSaving]     = useState(false)
  const [form, setForm] = useState({ full_name:'', username:'', password:'' })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data:t }, { data:s }] = await Promise.all([
      supabase.from('teachers').select('*').order('full_name'),
      supabase.from('students').select('teacher_username,status'),
    ])
    if (t) setTeachers(t)
    if (s) setStudents(s)
    setLoading(false)
  }

  const openAdd = () => {
    setEditing(null)
    setForm({ full_name:'', username:'', password:'' })
    setShowForm(true)
  }

  const openEdit = (t) => {
    setEditing(t)
    setForm({ full_name:t.full_name, username:t.username, password:t.password||'' })
    setShowForm(true)
  }

  const save = async () => {
    if (!form.full_name || !form.username || !form.password) { alert('All fields are required'); return }
    setSaving(true)
    if (editing) {
      await supabase.from('teachers').update({ full_name:form.full_name, password:form.password }).eq('username', editing.username)
    } else {
      const { error } = await supabase.from('teachers').insert(form)
      if (error) { alert('Error: '+error.message); setSaving(false); return }
    }
    await fetchAll(); setShowForm(false); setSaving(false)
  }

  const del = async (username) => {
    const studentCount = students.filter(s => s.teacher_username === username && s.status !== 'left').length
    if (studentCount > 0) { alert(`Cannot delete: ${username} has ${studentCount} active students. Reassign them first.`); return }
    if (!confirm(`Delete teacher account "${username}"?`)) return
    await supabase.from('teachers').delete().eq('username', username)
    fetchAll()
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'#94a3b8', fontSize:'14px' }}>Loading...</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'22px' }}>
        <div style={{ fontSize:'14px', color:'#94a3b8' }}>{teachers.length} teacher accounts</div>
        <button onClick={openAdd} style={{ padding:'9px 18px', borderRadius:'8px', border:'none', background:G, color:'white', fontSize:'13px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'700', cursor:'pointer' }}>+ Add teacher</button>
      </div>

      {/* Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'14px' }}>
        {teachers.map(t => {
          const activeStudents = students.filter(s => s.teacher_username === t.username && s.status !== 'left').length
          const initials = t.full_name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()
          return (
            <div key={t.username} style={{ background:'white', borderRadius:'14px', border:'1.5px solid #e4e8e7', overflow:'hidden', transition:'box-shadow 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,43,42,.08)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
              {/* Top colored bar */}
              <div style={{ height:'5px', background:`linear-gradient(90deg,${D},${G})` }} />
              <div style={{ padding:'20px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'14px', marginBottom:'16px' }}>
                  <div style={{ width:'52px', height:'52px', borderRadius:'14px', background:`${G}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', fontWeight:'800', color:G, fontFamily:"'Plus Jakarta Sans',sans-serif", flexShrink:0 }}>{initials}</div>
                  <div>
                    <div style={{ fontSize:'16px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, lineHeight:'1.2' }}>{t.full_name}</div>
                    <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px', fontFamily:'monospace' }}>@{t.username}</div>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'16px' }}>
                  <div style={{ background:'#f8fafb', borderRadius:'8px', padding:'10px 12px' }}>
                    <div style={{ fontSize:'20px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D }}>{activeStudents}</div>
                    <div style={{ fontSize:'11px', color:'#94a3b8', fontWeight:'600', marginTop:'1px' }}>Active students</div>
                  </div>
                  <div style={{ background:`${G}08`, borderRadius:'8px', padding:'10px 12px' }}>
                    <div style={{ fontSize:'20px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:G }}>
                      {[...new Set(students.filter(s => s.teacher_username === t.username).map(s => s.class_time))].length}
                    </div>
                    <div style={{ fontSize:'11px', color:'#94a3b8', fontWeight:'600', marginTop:'1px' }}>Groups</div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={() => openEdit(t)} style={{ flex:1, padding:'9px', borderRadius:'8px', border:`1.5px solid ${G}`, background:`${G}10`, color:G, fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Edit</button>
                  <button onClick={() => del(t.username)} style={{ flex:1, padding:'9px', borderRadius:'8px', border:'1.5px solid #fca5a5', background:'#fef2f2', color:'#dc2626', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>Delete</button>
                </div>
              </div>
            </div>
          )
        })}
        {!teachers.length && (
          <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'60px', background:'white', borderRadius:'14px', border:'1.5px solid #e4e8e7' }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>👨‍🏫</div>
            <div style={{ fontSize:'16px', fontWeight:'700', color:D, marginBottom:'4px' }}>No teachers yet</div>
            <div style={{ fontSize:'13px', color:'#94a3b8' }}>Add your first teacher account</div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}
          onClick={e => e.target===e.currentTarget && setShowForm(false)}>
          <div style={{ background:'white', borderRadius:'16px', padding:'28px', width:'420px', boxShadow:'0 24px 64px rgba(0,0,0,0.18)' }}>
            <h3 style={{ fontSize:'18px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'20px' }}>{editing ? 'Edit Teacher' : 'Add New Teacher'}</h3>

            <label style={lStyle}>Full Name *</label>
            <input value={form.full_name} onChange={e => setForm(p=>({...p,full_name:e.target.value}))} placeholder="e.g. Abdurahmon Toshmatov" style={iStyle} />

            <label style={lStyle}>Username *</label>
            <input value={form.username} onChange={e => setForm(p=>({...p,username:e.target.value}))} placeholder="e.g. abdurahmon" disabled={!!editing} style={{...iStyle, opacity:editing?.6:1}} />
            {!editing && <p style={{ fontSize:'11px', color:'#94a3b8', marginTop:'-8px', marginBottom:'12px' }}>Used to log into the Staff App</p>}

            <label style={lStyle}>Password *</label>
            <input value={form.password} onChange={e => setForm(p=>({...p,password:e.target.value}))} placeholder="Set a password" style={iStyle} />

            {editing && (
              <div style={{ background:`${G}08`, borderRadius:'8px', padding:'10px 14px', marginBottom:'12px', fontSize:'13px', color:'#64748b' }}>
                ℹ️ Username cannot be changed. Only name and password can be updated.
              </div>
            )}

            <div style={{ display:'flex', gap:'10px', marginTop:'8px' }}>
              <button onClick={() => setShowForm(false)} style={{ flex:1, padding:'12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex:1, padding:'12px', borderRadius:'8px', border:'none', background:G, color:'white', fontSize:'14px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'700', cursor:'pointer' }}>
                {saving ? 'Saving...' : editing ? 'Save changes' : 'Add teacher'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}