import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const G    = '#009472'
const DARK = '#002b2a'
const MONTHS  = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December']
const METHODS = ['Cash','Card','Transfer']
const PRESET_AMOUNTS = [550000, 600000, 650000]

function fmt(n) {
  return Number(n).toLocaleString('fr-FR').replace(/\u202f/g,' ')
}
function fmtDateTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}  ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
function dayLabel(day) {
  return day === 'odd' ? 'Mon / Wed / Fri' : 'Tue / Thu / Sat'
}
function studentInMonth(s, month, year) {
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd   = new Date(year, month, 0)
  const enrolled   = s.enrolled_date ? new Date(s.enrolled_date + 'T00:00:00') : null
  if (enrolled && enrolled > monthEnd) return false
  if (s.status === 'left') {
    const left = s.left_date ? new Date(s.left_date + 'T00:00:00') : null
    if (!left || left < monthStart) return false
  }
  return true
}

const inpStyle = {
  width:'100%', padding:'10px 12px', borderRadius:'10px',
  border:'1.5px solid #e4e8e7', fontSize:'14px', color:DARK,
  outline:'none', boxSizing:'border-box',
  fontFamily:"'DM Sans',sans-serif", background:'white',
}
const lbl = {
  fontSize:'11px', fontWeight:'700', color:'#64748b',
  textTransform:'uppercase', letterSpacing:'0.05em',
  display:'block', marginBottom:'6px', marginTop:'14px',
}

// ── RECORD / EDIT PAYMENT MODAL ───────────────────────────────────────────────
function PaymentModal({ payment, prefill, allStudents, allGroups, month, year, teachers, onClose, onSaved }) {
  const isEdit = !!payment

  // Work out initial teacher/group/student from prefill or existing payment
  const initStudent = prefill?.username || payment?.student_username || ''
  const initStu     = allStudents.find(s => s.username === initStudent)
  const initTeacher = prefill?.teacher_username || initStu?.teacher_username || payment?.teacher_username || ''
  const initGroupKey = initStu ? `${initStu.day}|${initStu.class_time}` : ''

  const [teacherU,  setTeacherU]  = useState(initTeacher)
  const [groupKey,  setGroupKey]  = useState(initGroupKey)
  const [studentU,  setStudentU]  = useState(initStudent)
  const [amount,    setAmount]    = useState(isEdit ? String(payment.amount) : '')
  const [method,    setMethod]    = useState(isEdit ? (payment.method||'Cash') : 'Cash')
  const [payDate,   setPayDate]   = useState(
    isEdit && payment.payment_date ? payment.payment_date.slice(0,10)
    : new Date().toISOString().slice(0,10))
  const [payTime,   setPayTime]   = useState(
    isEdit && payment.payment_date ? payment.payment_date.slice(11,16)
    : new Date().toTimeString().slice(0,5))
  const [notes,     setNotes]     = useState(isEdit ? (payment.notes||'') : '')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  // Groups for selected teacher
  const teacherGroups = allGroups.filter(g => g.teacher_username === teacherU)

  // Students in selected group, filtered to this month
  const [gDay, gTime] = groupKey.split('|')
  const groupStudents = allStudents.filter(s =>
    s.teacher_username === teacherU &&
    s.day === gDay &&
    s.class_time === gTime &&
    studentInMonth(s, month, year)
  )

  const handleTeacherChange = (v) => { setTeacherU(v); setGroupKey(''); setStudentU('') }
  const handleGroupChange   = (v) => { setGroupKey(v); setStudentU('') }

  const save = async () => {
    if (!studentU)           { setError('Select a student.'); return }
    const amt = parseFloat(amount)
    if (!amount || isNaN(amt) || amt < 0) { setError('Enter a valid amount.'); return }
    setSaving(true); setError('')

    // Build a proper local datetime to avoid UTC offset issues
    // Parse the date and time as local (not UTC) so Tashkent time is preserved
    const [yyyy, mm, dd] = payDate.split('-').map(Number)
    const [hh, mi]       = payTime.split(':').map(Number)
    const localDt        = new Date(yyyy, mm - 1, dd, hh, mi, 0)

    const payload = {
      student_username: studentU,
      teacher_username: teacherU,
      amount:           amt,
      method,
      payment_date:     localDt.toISOString(),
      notes:            notes.trim() || null,
      payment_month:    month,
      payment_year:     year,
    }

    const { error: err } = isEdit
      ? await supabase.from('payments').update(payload).eq('id', payment.id)
      : await supabase.from('payments').insert(payload)

    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'20px', padding:'28px', width:'100%', maxWidth:'460px', boxShadow:'0 24px 64px rgba(0,0,0,0.18)', maxHeight:'90vh', overflowY:'auto' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
          <span style={{ fontSize:'18px', fontWeight:'800', color:DARK, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {isEdit ? 'Edit Payment' : 'Record Payment'}
          </span>
          <button onClick={onClose} style={{ width:'30px', height:'30px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'16px' }}>✕</button>
        </div>
        <div style={{ fontSize:'13px', color:'#94a3b8', marginBottom:'4px' }}>
          {MONTHS[month-1]} {year}
        </div>

        {/* ── Teacher ── */}
        <label style={lbl}>Teacher</label>
        <select value={teacherU} onChange={e => handleTeacherChange(e.target.value)}
          disabled={!!prefill || isEdit}
          style={{ ...inpStyle, appearance:'none', cursor: (prefill||isEdit)?'default':'pointer', opacity:(prefill||isEdit)?0.7:1 }}>
          <option value="">Select teacher…</option>
          {teachers.map(t => <option key={t.username} value={t.username}>{t.full_name}</option>)}
        </select>

        {/* ── Group ── */}
        {teacherU && (
          <>
            <label style={lbl}>Group</label>
            <select value={groupKey} onChange={e => handleGroupChange(e.target.value)}
              disabled={!!prefill || isEdit}
              style={{ ...inpStyle, appearance:'none', cursor:(prefill||isEdit)?'default':'pointer', opacity:(prefill||isEdit)?0.7:1 }}>
              <option value="">Select group…</option>
              {teacherGroups.map(g => (
                <option key={`${g.day}|${g.class_time}`} value={`${g.day}|${g.class_time}`}>
                  {g.level} · {dayLabel(g.day)} · {g.class_time}
                </option>
              ))}
            </select>
          </>
        )}

        {/* ── Student ── */}
        {groupKey && (
          <>
            <label style={lbl}>Student</label>
            <select value={studentU} onChange={e => setStudentU(e.target.value)}
              disabled={!!prefill || isEdit}
              style={{ ...inpStyle, appearance:'none', cursor:(prefill||isEdit)?'default':'pointer', opacity:(prefill||isEdit)?0.7:1 }}>
              <option value="">Select student…</option>
              {groupStudents.map(s => (
                <option key={s.username} value={s.username}>
                  {s.full_name}{s.status==='left'?' (left)':''}
                </option>
              ))}
            </select>
          </>
        )}

        {/* ── Amount presets ── */}
        <label style={lbl}>Amount (UZS)</label>
        <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
          {PRESET_AMOUNTS.map(p => (
            <button key={p} onClick={() => setAmount(String(p))}
              style={{ flex:1, padding:'9px 4px', borderRadius:'10px', border:`1.5px solid ${String(amount)===String(p)?G:'#e4e8e7'}`, background:String(amount)===String(p)?`${G}12`:'white', color:String(amount)===String(p)?G:DARK, fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
              {fmt(p)}
            </button>
          ))}
        </div>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
          placeholder="Or enter custom amount…" min="0" style={inpStyle} />

        {/* ── Method ── */}
        <label style={lbl}>Method</label>
        <div style={{ display:'flex', gap:'8px', marginBottom:'4px' }}>
          {METHODS.map(m => (
            <button key={m} onClick={() => setMethod(m)}
              style={{ flex:1, padding:'9px 4px', borderRadius:'10px', border:`1.5px solid ${method===m?G:'#e4e8e7'}`, background:method===m?G:'white', color:method===m?'white':DARK, fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
              {m}
            </button>
          ))}
        </div>

        {/* ── Date & Time ── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <div><label style={lbl}>Date</label><input type="date" value={payDate} onChange={e=>setPayDate(e.target.value)} style={inpStyle}/></div>
          <div><label style={lbl}>Time</label><input type="time" value={payTime} onChange={e=>setPayTime(e.target.value)} style={inpStyle}/></div>
        </div>

        {/* ── Notes ── */}
        <label style={lbl}>Notes (optional)</label>
        <input value={notes} onChange={e=>setNotes(e.target.value)}
          placeholder="Any additional notes…"
          style={{ ...inpStyle, marginBottom: error?'10px':'0' }} />

        {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginTop:'10px' }}>{error}</div>}

        <div style={{ display:'flex', gap:'12px', marginTop:'20px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'13px', borderRadius:'12px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving}
            style={{ flex:2, padding:'13px', borderRadius:'12px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Save payment')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── UNPAID MODAL ──────────────────────────────────────────────────────────────
function UnpaidModal({ students, onRecordPayment, onClose }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'20px', padding:'24px', width:'100%', maxWidth:'480px', boxShadow:'0 24px 64px rgba(0,0,0,0.18)', maxHeight:'80vh', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <span style={{ fontSize:'17px', fontWeight:'800', color:DARK, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            Unpaid Students ({students.length})
          </span>
          <button onClick={onClose} style={{ width:'30px', height:'30px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'16px' }}>✕</button>
        </div>
        <div style={{ overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:'0' }}>
          {students.map((s, i) => (
            <div key={s.username} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 0', borderBottom: i<students.length-1?'1px solid #f0f2f1':'none' }}>
              <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'#fde8e8', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <span style={{ fontSize:'12px', fontWeight:'800', color:'#ef4444' }}>
                  {s.full_name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
                </span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'14px', fontWeight:'700', color:DARK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.full_name}</div>
                {s.phone && <div style={{ fontSize:'11px', color:'#94a3b8' }}>{s.phone}</div>}
              </div>
              <span style={{ fontSize:'11px', fontWeight:'700', padding:'3px 8px', borderRadius:'20px', background:s.status==='active'?`${G}15`:'#fde8e8', color:s.status==='active'?G:'#ef4444', flexShrink:0 }}>
                {s.status==='active'?'Active':'Left'}
              </span>
              <button
                onClick={() => { onClose(); onRecordPayment(s) }}
                style={{ padding:'7px 13px', borderRadius:'9px', border:`1.5px solid ${G}`, background:'white', color:G, fontSize:'12px', fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, transition:'all 0.15s' }}
                onMouseEnter={e=>{e.currentTarget.style.background=G;e.currentTarget.style.color='white'}}
                onMouseLeave={e=>{e.currentTarget.style.background='white';e.currentTarget.style.color=G}}>
                Record payment
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function PaymentsSection() {
  const now = new Date()
  const [month,       setMonth]       = useState(now.getMonth() + 1)
  const [year,        setYear]        = useState(now.getFullYear())
  const [payments,    setPayments]    = useState([])
  const [allStudents, setAllStudents] = useState([])
  const [allGroups,   setAllGroups]   = useState([])
  const [teachers,    setTeachers]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [modal,       setModal]       = useState(null) // null | 'new' | payment-obj
  const [prefill,     setPrefill]     = useState(null) // student to prefill
  const [showUnpaid,  setShowUnpaid]  = useState(false)
  const [deleting,    setDeleting]    = useState(null)

  useEffect(() => { fetchAll() }, [month, year])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: pays }, { data: stus }, { data: grps }, { data: tchs }] = await Promise.all([
      supabase.from('payments').select('*')
        .eq('payment_month', month).eq('payment_year', year)
        .order('payment_date', { ascending: false }),
      supabase.from('students').select('username,full_name,phone,enrolled_date,status,left_date,teacher_username,day,class_time')
        .neq('username','test').order('full_name'),
      supabase.from('groups').select('*').order('class_time'),
      supabase.from('teachers').select('username,full_name').neq('username','test').order('full_name'),
    ])
    setPayments(pays || [])
    setAllStudents(stus || [])
    setAllGroups(grps || [])
    setTeachers(tchs || [])
    setLoading(false)
  }

  const deletePayment = async (id) => {
    if (!confirm('Delete this payment record?')) return
    setDeleting(id)
    await supabase.from('payments').delete().eq('id', id)
    setDeleting(null)
    fetchAll()
  }

  const openNew = (student = null) => {
    setPrefill(student)
    setModal('new')
  }

  // Month options — 24 months back to now
  const monthOptions = []
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthOptions.push({ label:`${MONTHS[d.getMonth()]} ${d.getFullYear()}`, month:d.getMonth()+1, year:d.getFullYear() })
  }

  // Stats
  const eligible      = allStudents.filter(s => studentInMonth(s, month, year))
  const paidUsernames = new Set(payments.map(p => p.student_username))
  const unpaidStudents = eligible.filter(s => !paidUsernames.has(s.username))
  const totalCollected = payments.reduce((a,p) => a + Number(p.amount), 0)

  // Filtered log
  const filtered = payments.filter(p => {
    if (!search.trim()) return true
    const stu = allStudents.find(s => s.username === p.student_username)
    return stu?.full_name?.toLowerCase().includes(search.toLowerCase())
  })

  const th = { fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', padding:'12px 16px' }

  return (
    <div style={{ padding:'32px', fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box }
        select { -webkit-appearance:none; -moz-appearance:none }
      `}</style>

      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', gap:'12px', flexWrap:'wrap' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'800', color:DARK, fontFamily:"'Plus Jakarta Sans',sans-serif", margin:0 }}>Payments</h1>
        <div style={{ fontSize:'13px', color:'#94a3b8' }}>
          {new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
        </div>
      </div>

      {/* Controls row */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px', flexWrap:'wrap' }}>
        {/* Month dropdown */}
        <div style={{ position:'relative' }}>
          <select
            value={`${month}-${year}`}
            onChange={e => { const [m,y] = e.target.value.split('-'); setMonth(Number(m)); setYear(Number(y)) }}
            style={{ padding:'9px 36px 9px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', fontWeight:'700', color:DARK, background:'white', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", outline:'none' }}>
            {monthOptions.map(o => (
              <option key={`${o.month}-${o.year}`} value={`${o.month}-${o.year}`}>{o.label}</option>
            ))}
          </select>
          <svg style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DARK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>

        {/* Search */}
        <div style={{ position:'relative', flex:1, minWidth:'200px', maxWidth:'320px' }}>
          <svg style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student…"
            style={{ width:'100%', padding:'9px 12px 9px 36px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', color:DARK, outline:'none', background:'white', fontFamily:"'DM Sans',sans-serif" }} />
        </div>

        <div style={{ marginLeft:'auto' }}>
          <button onClick={() => openNew()}
            style={{ padding:'9px 18px', borderRadius:'10px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif", display:'flex', alignItems:'center', gap:'6px' }}>
            <span style={{ fontSize:'18px', lineHeight:1 }}>+</span> Record payment
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'28px' }}>
        <div style={{ background:'white', borderRadius:'14px', padding:'18px 20px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px' }}>Total Students</div>
          <div style={{ fontSize:'26px', fontWeight:'800', color:DARK, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{loading?'…':eligible.length}</div>
        </div>
        <div style={{ background:'white', borderRadius:'14px', padding:'18px 20px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px' }}>Paid</div>
          <div style={{ fontSize:'26px', fontWeight:'800', color:G, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{loading?'…':paidUsernames.size}</div>
        </div>
        <div onClick={() => !loading && unpaidStudents.length > 0 && setShowUnpaid(true)}
          style={{ background:'white', borderRadius:'14px', padding:'18px 20px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', cursor:unpaidStudents.length>0?'pointer':'default', border:unpaidStudents.length>0?'1.5px solid #fde8e8':'1.5px solid transparent', transition:'box-shadow 0.15s' }}
          onMouseEnter={e=>{ if(unpaidStudents.length>0) e.currentTarget.style.boxShadow='0 4px 16px rgba(239,68,68,0.15)' }}
          onMouseLeave={e=>e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.06)'}>
          <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px' }}>Unpaid</div>
          <div style={{ fontSize:'26px', fontWeight:'800', color:'#ef4444', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{loading?'…':unpaidStudents.length}</div>
          {!loading && unpaidStudents.length > 0 && <div style={{ fontSize:'12px', color:'#ef4444', marginTop:'4px', fontWeight:'600' }}>Click to see →</div>}
        </div>
        <div style={{ background:'white', borderRadius:'14px', padding:'18px 20px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px' }}>Collected</div>
          <div style={{ fontSize:'22px', fontWeight:'800', color:DARK, fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1.2 }}>{loading?'…':`${fmt(totalCollected)} UZS`}</div>
        </div>
      </div>

      {/* Payment log */}
      <div style={{ background:'white', borderRadius:'16px', overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.07)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'160px 1fr 150px 120px 180px 140px', background:'#f8fafb', borderBottom:'1px solid #f0f2f1' }}>
          {['Receipt #','Student','Amount','Method','Date & Time','Actions'].map((h,i) => (
            <div key={i} style={th}>{h}</div>
          ))}
        </div>
        {loading ? (
          <div style={{ padding:'48px', textAlign:'center', color:'#94a3b8' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:'48px', textAlign:'center', color:'#94a3b8' }}>
            {search ? 'No matching payments found.' : `No payments recorded for ${MONTHS[month-1]} ${year}.`}
          </div>
        ) : filtered.map((p, i) => {
          const stu = allStudents.find(s => s.username === p.student_username)
          const receiptNo = p.receipt_number || `#${String(payments.length - i).padStart(4,'0')}`
          return (
            <div key={p.id} style={{ display:'grid', gridTemplateColumns:'160px 1fr 150px 120px 180px 140px', alignItems:'center', borderBottom:i<filtered.length-1?'1px solid #f0f2f1':'none', background:'white', transition:'background 0.1s' }}
              onMouseEnter={e=>e.currentTarget.style.background='#f8fafb'}
              onMouseLeave={e=>e.currentTarget.style.background='white'}>
              <div style={{ padding:'14px 16px', fontSize:'13px', fontWeight:'700', color:G, fontFamily:'monospace' }}>{receiptNo}</div>
              <div style={{ padding:'14px 16px' }}>
                <div style={{ fontSize:'14px', fontWeight:'700', color:DARK }}>{stu?.full_name || p.student_username}</div>
                {stu?.status==='left' && <span style={{ fontSize:'10px', fontWeight:'700', color:'#ef4444' }}>Left</span>}
              </div>
              <div style={{ padding:'14px 16px', fontSize:'14px', fontWeight:'800', color:Number(p.amount)>0?G:'#94a3b8', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                {fmt(p.amount)} UZS
              </div>
              <div style={{ padding:'14px 16px', fontSize:'13px', color:'#64748b', fontWeight:'600' }}>{p.method||'—'}</div>
              <div style={{ padding:'14px 16px', fontSize:'12px', color:'#64748b', fontFamily:'monospace' }}>{fmtDateTime(p.payment_date)}</div>
              <div style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:'8px' }}>
                <button onClick={() => { setPrefill(null); setModal(p) }}
                  style={{ padding:'6px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', background:'white', color:DARK, fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
                  Edit
                </button>
                <button onClick={() => deletePayment(p.id)} disabled={deleting===p.id}
                  style={{ width:'28px', height:'28px', borderRadius:'8px', border:'1.5px solid #fde8e8', background:'white', color:'#ef4444', fontSize:'16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'800' }}>
                  {deleting===p.id?'…':'×'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modals */}
      {modal && (
        <PaymentModal
          payment={modal==='new' ? null : modal}
          prefill={modal==='new' ? prefill : null}
          allStudents={allStudents}
          allGroups={allGroups}
          month={month} year={year}
          teachers={teachers}
          onClose={() => { setModal(null); setPrefill(null) }}
          onSaved={() => { setModal(null); setPrefill(null); fetchAll() }}
        />
      )}
      {showUnpaid && (
        <UnpaidModal
          students={unpaidStudents}
          onRecordPayment={stu => openNew(stu)}
          onClose={() => setShowUnpaid(false)}
        />
      )}
    </div>
  )
}