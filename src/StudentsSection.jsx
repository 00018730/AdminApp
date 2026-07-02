import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const G  = '#009472'
const D  = '#002b2a'

const TIME_SLOTS = {
  '09:00': '09:00 – 10:30', '10:30': '10:30 – 12:00',
  '14:30': '14:30 – 16:00', '16:00': '16:00 – 17:30',
  '17:30': '17:30 – 19:00', '19:00': '19:00 – 20:30',
}
const dayLabel = d => d === 'odd' ? 'Mon / Wed / Fri' : 'Tue / Thu / Sat'
const inp = { width:'100%', padding:'11px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, fontFamily:"'DM Sans',sans-serif", boxSizing:'border-box', marginBottom:'14px' }
const lbl = { fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px' }

function Back({ label, onClick }) {
  return (
    <button onClick={onClick} style={{ display:'flex', alignItems:'center', gap:'6px', background:'none', border:'none', cursor:'pointer', color:'#64748b', fontSize:'13px', fontWeight:'600', marginBottom:'20px', padding:0, fontFamily:"'DM Sans',sans-serif" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      {label}
    </button>
  )
}

function TransferModal({ student, currentGroup, onClose, onDone }) {
  const [groups,    setGroups]    = useState([])
  const [teachers,  setTeachers]  = useState({})
  const [lessonMap, setLessonMap] = useState({})
  const [selected,  setSelected]  = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const load = async () => {
      const [{ data: g }, { data: t }, { data: l }] = await Promise.all([
        supabase.from('groups').select('*').order('class_time'),
        supabase.from('teachers').select('username, full_name').neq('username', 'test'),
        supabase.from('lessons').select('teacher_username, day, class_time, lesson_order').order('lesson_order', { ascending: false }),
      ])
      const tm = {}; for (const x of t||[]) tm[x.username] = x.full_name
      const lm = {}; for (const x of l||[]) { const k=`${x.teacher_username}_${x.day}_${x.class_time}`; if(!lm[k]) lm[k]=x.lesson_order }
      setTeachers(tm); setLessonMap(lm)
      setGroups((g||[]).filter(x => !(x.teacher_username===currentGroup.teacher_username && x.day===currentGroup.day && x.class_time===currentGroup.class_time)))
      setLoading(false)
    }
    load()
  }, [])

  const getKey = g => `${g.teacher_username}|${g.day}|${g.class_time}`
  const getLM  = g => lessonMap[`${g.teacher_username}_${g.day}_${g.class_time}`] || 0

  const confirm = async () => {
    if (!selected) return
    setSaving(true)
    const [tu, day, ct] = selected.split('|')
    await supabase.from('students').update({ teacher_username:tu, day, class_time:ct }).eq('username', student.username)
    setSaving(false); onDone()
  }

  const sorted = [...groups].sort((a,b) => (a.level===currentGroup.level?0:1)-(b.level===currentGroup.level?0:1))

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'white', borderRadius:'20px', width:'100%', maxWidth:'480px', maxHeight:'82vh', display:'flex', flexDirection:'column', overflow:'hidden', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ padding:'20px 20px 14px', borderBottom:'1px solid #f0f2f1', flexShrink:0 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
            <span style={{ fontSize:'17px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Transfer {student.full_name}</span>
            <button onClick={onClose} style={{ width:'30px', height:'30px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'15px' }}>✕</button>
          </div>
          <div style={{ fontSize:'12px', color:'#94a3b8' }}>Current: {currentGroup.level} · {dayLabel(currentGroup.day)} · {TIME_SLOTS[currentGroup.class_time]}</div>
        </div>
        <div style={{ flex:1, overflowY:'auto', padding:'14px 20px' }}>
          {loading ? <div style={{ textAlign:'center', padding:'40px', color:'#94a3b8' }}>Loading…</div> : sorted.map(g => {
            const key=getKey(g), isSel=selected===key, isMatch=g.level===currentGroup.level
            return (
              <div key={key} onClick={()=>setSelected(isSel?null:key)}
                style={{ padding:'12px 14px', borderRadius:'12px', marginBottom:'8px', cursor:'pointer', border:`1.5px solid ${isSel?G:'#f0f2f1'}`, background:isSel?`${G}08`:'white', transition:'all 0.15s' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ display:'flex', gap:'6px', alignItems:'center', marginBottom:'3px' }}>
                      <span style={{ fontSize:'14px', fontWeight:'700', color:isSel?G:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{g.level}</span>
                      {isMatch && <span style={{ fontSize:'10px', fontWeight:'700', padding:'1px 6px', borderRadius:'6px', background:`${G}15`, color:G }}>Same level</span>}
                    </div>
                    <div style={{ fontSize:'12px', color:'#94a3b8' }}>{teachers[g.teacher_username]} · {dayLabel(g.day)} · {TIME_SLOTS[g.class_time]||g.class_time}</div>
                  </div>
                  {getLM(g) > 0 && <div style={{ fontSize:'12px', fontWeight:'700', color:'#94a3b8' }}>Lesson #{getLM(g)}</div>}
                </div>
              </div>
            )
          })}
        </div>
        <div style={{ padding:'14px 20px 20px', borderTop:'1px solid #f0f2f1', flexShrink:0, display:'flex', gap:'10px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'12px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
          <button onClick={confirm} disabled={!selected||saving}
            style={{ flex:2, padding:'12px', borderRadius:'12px', border:'none', background:selected?G:'#e4e8e7', color:'white', fontSize:'14px', fontWeight:'700', cursor:selected?'pointer':'default', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {saving?'Transferring…':'Confirm Transfer'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddStudentModal({ group, onClose, onSaved }) {
  const [fullName,     setFullName]     = useState('')
  const [username,     setUsername]     = useState('')
  const [password,     setPassword]     = useState('')
  const [phone,        setPhone]        = useState('')
  const [enrolledDate, setEnrolledDate] = useState(new Date().toISOString().slice(0,10))
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  const save = async () => {
    if (!fullName.trim() || !username.trim() || !password.trim()) { setError('Full name, username and password are required.'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('students').insert({
      username: username.trim().toLowerCase(), password: password.trim(),
      full_name: fullName.trim(), teacher_username: group.teacher_username,
      day: group.day, class_time: group.class_time, coins: 0, gems: 0,
      phone: phone.trim() || null,
      enrolled_date: enrolledDate || new Date().toISOString().slice(0,10),
      status: 'active',
    })
    if (err) { setError(err.code==='23505'?'Username already taken.':err.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'white', borderRadius:'20px', padding:'26px', width:'100%', maxWidth:'440px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
          <span style={{ fontSize:'17px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Add Student</span>
          <button onClick={onClose} style={{ width:'30px', height:'30px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'15px' }}>✕</button>
        </div>
        <div style={{ fontSize:'12px', color:'#94a3b8', marginBottom:'18px' }}>{group.level} · {dayLabel(group.day)} · {TIME_SLOTS[group.class_time]}</div>
        <label style={lbl}>Full Name *</label>
        <input value={fullName} onChange={e=>setFullName(e.target.value)} placeholder="e.g. Robiya Inoyatova" style={inp} />
        <label style={lbl}>Username *</label>
        <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="e.g. robiya" autoCapitalize="none" style={inp} />
        <label style={lbl}>Password *</label>
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Set a password" style={inp} />
        <label style={lbl}>Phone Number</label>
        <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+998 90 123 45 67" style={inp} />
        <label style={lbl}>Enrolled Date</label>
        <input type="date" value={enrolledDate} onChange={e=>setEnrolledDate(e.target.value)} style={{ ...inp, marginBottom:error?'8px':'16px' }} />
        {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginBottom:'14px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'12px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex:2, padding:'12px', borderRadius:'12px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {saving?'Adding…':'Add Student'}
          </button>
        </div>
      </div>
    </div>
  )
}

function EditStudentModal({ student, group, onClose, onSaved }) {
  const [fullName,     setFullName]     = useState(student.full_name)
  const [password,     setPassword]     = useState(student.password || '')
  const [phone,        setPhone]        = useState(student.phone || '')
  const [enrolledDate, setEnrolledDate] = useState(student.enrolled_date || new Date().toISOString().slice(0,10))
  const [status,       setStatus]       = useState(student.status || 'active')
  const [leftDate,     setLeftDate]     = useState(student.left_date || '')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const [showTransfer, setShowTransfer] = useState(false)
  const [confirmDel,   setConfirmDel]   = useState(false)
  const [deleting,     setDeleting]     = useState(false)

  const deleteStudent = async () => {
    setDeleting(true)
    await Promise.all([
      supabase.from('attendance').delete().eq('student_username', student.username),
      supabase.from('homework_submissions').delete().eq('student_username', student.username),
      supabase.from('vocabulary_progress').delete().eq('student_username', student.username),
      supabase.from('word_of_day_history').delete().eq('student_username', student.username),
      supabase.from('payments').delete().eq('student_username', student.username),
    ])
    const { error: err } = await supabase.from('students').delete().eq('username', student.username)
    if (err) { setError(err.message); setDeleting(false); setConfirmDel(false); return }
    onSaved()
  }

  const save = async () => {
    if (status === 'left' && !leftDate) { setError('Please set the date the student left.'); return }
    setSaving(true); setError('')
    const { error: err } = await supabase.from('students').update({
      full_name: fullName.trim(), password: password.trim(),
      phone: phone.trim() || null, enrolled_date: enrolledDate || null,
      status, left_date: status === 'left' ? leftDate : null,
    }).eq('username', student.username)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  if (showTransfer) return (
    <TransferModal student={student} currentGroup={group}
      onClose={() => setShowTransfer(false)}
      onDone={() => { setShowTransfer(false); onSaved() }} />
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{ background:'white', borderRadius:'20px', padding:'26px', width:'100%', maxWidth:'440px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
          <span style={{ fontSize:'17px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Edit Student</span>
          <button onClick={onClose} style={{ width:'30px', height:'30px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'15px' }}>✕</button>
        </div>
        <div style={{ background:'#f8fafb', borderRadius:'10px', padding:'10px 14px', marginBottom:'18px', fontSize:'13px', color:'#64748b' }}>
          Username: <strong style={{ color:D }}>{student.username}</strong>
        </div>
        <label style={lbl}>Full Name</label>
        <input value={fullName} onChange={e=>setFullName(e.target.value)} style={inp} />
        <label style={lbl}>Password</label>
        <input value={password} onChange={e=>setPassword(e.target.value)} style={inp} />
        <label style={lbl}>Phone Number</label>
        <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+998 90 123 45 67" style={inp} />
        <label style={lbl}>Enrolled Date</label>
        <input type="date" value={enrolledDate} onChange={e=>setEnrolledDate(e.target.value)} style={inp} />
        <label style={lbl}>Status</label>
        <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
          {['active','left'].map(s => (
            <button key={s} onClick={()=>setStatus(s)} style={{ flex:1, padding:'10px', borderRadius:'10px', border:`1.5px solid ${status===s?(s==='active'?G:'#ef4444'):'#e4e8e7'}`, background:status===s?(s==='active'?`${G}10`:'#fde8e8'):'white', color:status===s?(s==='active'?G:'#ef4444'):'#64748b', fontSize:'13px', fontWeight:'700', cursor:'pointer', textTransform:'capitalize' }}>
              {s === 'active' ? '✓ Active' : '✗ Left'}
            </button>
          ))}
        </div>
        {status === 'left' && (
          <>
            <label style={lbl}>Date Left</label>
            <input type="date" value={leftDate} onChange={e=>setLeftDate(e.target.value)} style={inp} />
          </>
        )}
        {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginBottom:'12px' }}>{error}</div>}
        <button onClick={() => setShowTransfer(true)}
          style={{ width:'100%', padding:'11px', borderRadius:'10px', border:`1.5px solid ${G}`, background:'white', color:G, fontSize:'13px', fontWeight:'700', cursor:'pointer', marginBottom:'14px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          Transfer to another group
        </button>
        {!confirmDel ? (
          <button onClick={() => setConfirmDel(true)}
            style={{ width:'100%', padding:'10px', borderRadius:'10px', border:'1.5px solid #fde8e8', background:'white', color:'#ef4444', fontSize:'13px', fontWeight:'700', cursor:'pointer', marginBottom:'12px', marginTop:'4px' }}>
            🗑 Delete Student
          </button>
        ) : (
          <div style={{ background:'#fde8e8', borderRadius:'12px', padding:'14px 16px', marginBottom:'12px' }}>
            <div style={{ fontSize:'13px', fontWeight:'700', color:'#991b1b', marginBottom:'10px' }}>
              Permanently delete <strong>{student.full_name}</strong>? This cannot be undone.
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={() => setConfirmDel(false)} style={{ flex:1, padding:'9px', borderRadius:'9px', border:'1.5px solid #fca5a5', background:'white', color:'#64748b', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
              <button onClick={deleteStudent} disabled={deleting} style={{ flex:2, padding:'9px', borderRadius:'9px', border:'none', background:'#ef4444', color:'white', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
                {deleting ? 'Deleting…' : 'Yes, delete permanently'}
              </button>
            </div>
          </div>
        )}
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'12px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex:2, padding:'12px', borderRadius:'12px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {saving?'Saving…':'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// readOnly = true  → manager: can navigate, search, view students, no add/edit buttons
// readOnly = false → admin: full access
export default function StudentsSection({ readOnly = false, initialGroup = null, onExit = null }) {
  // When initialGroup is provided (admin opened "Students" from a specific group),
  // skip the teacher → group navigation and jump straight to that group's students.
  const lockedToGroup = !!initialGroup
  const [view,            setView]           = useState(initialGroup ? 'students' : 'teachers')
  const [teachers,        setTeachers]       = useState([])
  const [selectedTeacher, setSelectedTeacher]= useState(null)
  const [groups,          setGroups]         = useState([])
  const [selectedGroup,   setSelectedGroup]  = useState(initialGroup)
  const [students,        setStudents]       = useState([])
  const [loading,         setLoading]        = useState(true)
  const [addOpen,         setAddOpen]        = useState(false)
  const [editStudent,     setEditStudent]    = useState(null)

  useEffect(() => {
    if (initialGroup) fetchStudents(initialGroup)
    else fetchTeachers()
  }, [])

  const fetchTeachers = async () => {
    setLoading(true)
    const { data } = await supabase.from('teachers').select('username, full_name').neq('username','test').order('full_name')
    setTeachers(data || []); setLoading(false)
  }

  const fetchGroups = async (teacher) => {
    setLoading(true)
    const [{ data: g }, { data: s }] = await Promise.all([
      supabase.from('groups').select('*').eq('teacher_username', teacher.username).order('day').order('class_time'),
      supabase.from('students').select('day, class_time').eq('teacher_username', teacher.username).neq('status', 'left'),
    ])
    const counts = {}
    for (const x of s||[]) { const k=`${x.day}_${x.class_time}`; counts[k]=(counts[k]||0)+1 }
    setGroups((g||[]).map(x => ({ ...x, studentCount: counts[`${x.day}_${x.class_time}`]||0 })))
    setLoading(false)
  }

  const fetchStudents = async (group) => {
    setLoading(true)
    const { data } = await supabase.from('students').select('*')
      .eq('teacher_username', group.teacher_username).eq('day', group.day).eq('class_time', group.class_time)
      .neq('status', 'left')
      .order('full_name')
    setStudents(data || []); setLoading(false)
  }

  const goToTeacher = (t) => { setSelectedTeacher(t); fetchGroups(t); setView('groups') }
  const goToGroup   = (g) => { setSelectedGroup(g); fetchStudents(g); setView('students') }
  const goBack = () => {
    if (view==='students') {
      if (lockedToGroup) { onExit?.(); return }
      setView('groups'); setSelectedGroup(null); fetchGroups(selectedTeacher)
    }
    if (view==='groups')   { setView('teachers'); setSelectedTeacher(null); fetchTeachers() }
  }

  if (view === 'teachers') return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <h2 style={{ fontSize:'20px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'4px' }}>Students</h2>
      <p style={{ fontSize:'13px', color:'#94a3b8', marginBottom:'20px' }}>Select a teacher to view their students.</p>
      {loading ? <div style={{ textAlign:'center', padding:'60px', color:'#94a3b8' }}>Loading…</div> : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(210px, 1fr))', gap:'12px' }}>
          {teachers.map(t => (
            <button key={t.username} onClick={() => goToTeacher(t)}
              style={{ background:'white', borderRadius:'16px', padding:'20px', border:'1.5px solid #f0f2f1', cursor:'pointer', textAlign:'left', boxShadow:'0 2px 8px rgba(0,0,0,0.05)', transition:'all 0.15s' }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=G; e.currentTarget.style.boxShadow=`0 4px 16px ${G}20`}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='#f0f2f1'; e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'}}>
              <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:`${G}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', marginBottom:'12px' }}>👨‍🏫</div>
              <div style={{ fontSize:'15px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif", marginBottom:'2px' }}>{t.full_name}</div>
              <div style={{ fontSize:'12px', color:'#94a3b8', marginBottom:'10px' }}>@{t.username}</div>
              <div style={{ display:'flex', alignItems:'center', gap:'4px', fontSize:'12px', color:G, fontWeight:'600' }}>
                View groups <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  if (view === 'groups') return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <Back label="All Teachers" onClick={goBack} />
      <h2 style={{ fontSize:'20px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'3px' }}>{selectedTeacher?.full_name}</h2>
      <p style={{ fontSize:'13px', color:'#94a3b8', marginBottom:'20px' }}>Select a group to view students.</p>
      {loading ? <div style={{ textAlign:'center', padding:'60px', color:'#94a3b8' }}>Loading…</div> :
       groups.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', background:'white', borderRadius:'16px' }}>
          <div style={{ fontSize:'36px', marginBottom:'10px' }}>📭</div>
          <div style={{ fontSize:'15px', fontWeight:'700', color:'#111', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>No groups yet</div>
        </div>
       ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', maxWidth:'540px' }}>
          {groups.map(g => (
            <button key={`${g.day}_${g.class_time}`} onClick={() => goToGroup(g)}
              style={{ background:'white', borderRadius:'14px', padding:'16px 20px', border:'1.5px solid #f0f2f1', cursor:'pointer', display:'flex', alignItems:'center', gap:'14px', textAlign:'left', boxShadow:'0 2px 8px rgba(0,0,0,0.05)', transition:'all 0.15s' }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=G}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='#f0f2f1'}}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'15px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif", marginBottom:'3px' }}>{g.level}</div>
                <div style={{ fontSize:'12px', color:'#94a3b8' }}>{dayLabel(g.day)} · {TIME_SLOTS[g.class_time]||g.class_time}</div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:'22px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{g.studentCount}</div>
                <div style={{ fontSize:'11px', color:'#94a3b8' }}>student{g.studentCount!==1?'s':''}</div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ))}
        </div>
       )
      }
    </div>
  )

  if (view === 'students') return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <Back label={lockedToGroup ? 'Groups' : selectedTeacher?.full_name} onClick={goBack} />
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
        <div>
          <h2 style={{ fontSize:'20px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'3px' }}>{selectedGroup?.level}</h2>
          <p style={{ fontSize:'13px', color:'#94a3b8' }}>{dayLabel(selectedGroup?.day)} · {TIME_SLOTS[selectedGroup?.class_time]} · {students.length} student{students.length!==1?'s':''}</p>
        </div>
        {/* Add Student button — admin only */}
        {!readOnly && (
          <button onClick={() => setAddOpen(true)}
            style={{ padding:'10px 18px', borderRadius:'10px', border:'none', background:G, color:'white', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif", display:'flex', alignItems:'center', gap:'6px', boxShadow:`0 3px 12px ${G}40` }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Student
          </button>
        )}
      </div>

      {loading ? <div style={{ textAlign:'center', padding:'60px', color:'#94a3b8' }}>Loading…</div> :
       students.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', background:'white', borderRadius:'16px' }}>
          <div style={{ fontSize:'36px', marginBottom:'10px' }}>👥</div>
          <div style={{ fontSize:'15px', fontWeight:'700', color:'#111', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>No students yet</div>
        </div>
       ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'8px', maxWidth:'600px' }}>
          {students.map(s => {
            const initials = s.full_name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()
            return (
              <div key={s.username} style={{ background:'white', borderRadius:'14px', padding:'14px 16px', display:'flex', alignItems:'center', gap:'12px', boxShadow:'0 1px 6px rgba(0,0,0,0.06)', border:'1px solid #f0f2f1' }}>
                <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:`${G}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:'800', color:G, flexShrink:0, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{initials}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'14px', fontWeight:'700', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{s.full_name}</div>
                  <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'1px' }}>@{s.username}</div>
                </div>
                <div style={{ fontSize:'12px', color:'#f59e0b', fontWeight:'600', marginRight:'6px' }}>🪙 {s.coins||0}</div>
                {/* Edit button — admin only */}
                {!readOnly && (
                  <button onClick={() => setEditStudent(s)}
                    style={{ padding:'7px 14px', borderRadius:'8px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'12px', fontWeight:'600', cursor:'pointer', flexShrink:0 }}>
                    Edit
                  </button>
                )}
              </div>
            )
          })}
        </div>
       )
      }

      {addOpen     && <AddStudentModal  group={selectedGroup} onClose={()=>setAddOpen(false)}    onSaved={()=>{ setAddOpen(false);   fetchStudents(selectedGroup) }} />}
      {editStudent && <EditStudentModal student={editStudent} group={selectedGroup} onClose={()=>setEditStudent(null)} onSaved={()=>{ setEditStudent(null); fetchStudents(selectedGroup) }} />}
    </div>
  )

  return null
}