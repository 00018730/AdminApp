import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { logEdit } from './editLog'

const G    = '#009472'
const DARK = '#002b2a'
const MONTHS  = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December']
const METHODS = ['Cash','Card','Transfer']
const PRESET_AMOUNTS = [550000, 600000, 650000]

const DISCOUNT_PCTS    = [10, 20, 30, 50]
const DISCOUNT_REASONS = ['Sibling', 'Scholarship', 'Staff child', 'Other']
// final amount after a percentage discount, rounded to the nearest so'm
function applyDiscount(base, pct) {
  const b = Number(base) || 0
  if (!pct) return b
  return Math.round(b * (1 - pct / 100))
}

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

// Reusable discount block for both record modals. The parent owns the state
// (enabled / pct / reason) and the base amount; this renders the controls and
// shows the resulting amount. Final amount = applyDiscount(base, enabled?pct:0).
function DiscountControls({ enabled, setEnabled, pct, setPct, reason, setReason, baseAmount }) {
  const base  = Number(baseAmount) || 0
  const final = applyDiscount(base, enabled ? pct : 0)
  return (
    <div style={{ marginTop:'14px', border:`1.5px solid ${enabled?G:'#e4e8e7'}`, borderRadius:'12px', padding:'12px 14px', background:enabled?`${G}08`:'#fafbfc' }}>
      <label style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer' }}>
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}
          style={{ width:'18px', height:'18px', accentColor:G, cursor:'pointer' }} />
        <span style={{ fontSize:'13px', fontWeight:'700', color:DARK }}>Apply discount (skidka)</span>
      </label>
      {enabled && (
        <div style={{ marginTop:'12px' }}>
          <div style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>Percentage</div>
          <div style={{ display:'flex', gap:'6px', marginBottom:'10px' }}>
            {DISCOUNT_PCTS.map(p => (
              <button key={p} type="button" onClick={() => setPct(p)}
                style={{ flex:1, padding:'8px 4px', borderRadius:'9px', border:`1.5px solid ${pct===p?G:'#e4e8e7'}`, background:pct===p?G:'white', color:pct===p?'white':DARK, fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                {p}%
              </button>
            ))}
          </div>
          <div style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>Reason</div>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {DISCOUNT_REASONS.map(r => (
              <button key={r} type="button" onClick={() => setReason(r)}
                style={{ padding:'7px 12px', borderRadius:'9px', border:`1.5px solid ${reason===r?G:'#e4e8e7'}`, background:reason===r?`${G}12`:'white', color:reason===r?G:'#64748b', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
                {r}
              </button>
            ))}
          </div>
          <div style={{ marginTop:'12px', display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'13px' }}>
            <span style={{ color:'#94a3b8', textDecoration:'line-through' }}>{fmt(base)}</span>
            <span style={{ fontWeight:'800', color:G, fontSize:'16px', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{fmt(final)} UZS</span>
          </div>
        </div>
      )}
    </div>
  )
}

function PaymentModal({ payment, prefill, allStudents, allGroups, month, year, teachers, onClose, onSaved }) {
  const isEdit = !!payment
  const initStudent  = prefill?.username || payment?.student_username || ''
  const initStu      = allStudents.find(s => s.username === initStudent)
  const initTeacher  = prefill?.teacher_username || initStu?.teacher_username || payment?.teacher_username || ''
  const initGroupKey = initStu ? `${initStu.day}|${initStu.class_time}` : ''

  const [teacherU, setTeacherU] = useState(initTeacher)
  const [groupKey, setGroupKey] = useState(initGroupKey)
  const [studentU, setStudentU] = useState(initStudent)
  const [amount,   setAmount]   = useState(isEdit ? String(payment.amount) : '')
  const [method,   setMethod]   = useState(isEdit ? (payment.method||'Cash') : 'Cash')
  const [payDate,  setPayDate]  = useState(isEdit && payment.payment_date ? payment.payment_date.slice(0,10) : new Date().toISOString().slice(0,10))
  const [payTime,  setPayTime]  = useState(isEdit && payment.payment_date ? payment.payment_date.slice(11,16) : new Date().toTimeString().slice(0,5))
  const [notes,    setNotes]    = useState(isEdit ? (payment.notes||'') : '')
  const [discEnabled, setDiscEnabled] = useState(isEdit ? !!payment.discount_percent : false)
  const [discPct,     setDiscPct]     = useState(isEdit && payment.discount_percent ? payment.discount_percent : 10)
  const [discReason,  setDiscReason]  = useState(isEdit ? (payment.discount_reason || '') : '')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const teacherGroups = allGroups.filter(g => g.teacher_username === teacherU)
  const [gDay, gTime] = groupKey.split('|')
  const groupStudents = allStudents.filter(s =>
    s.teacher_username === teacherU && s.day === gDay &&
    s.class_time === gTime && studentInMonth(s, month, year)
  )

  const handleTeacherChange = (v) => { setTeacherU(v); setGroupKey(''); setStudentU('') }
  const handleGroupChange   = (v) => { setGroupKey(v); setStudentU('') }

  const save = async () => {
    if (!studentU) { setError('Select a student.'); return }
    const amt = parseFloat(amount)
    if (!amount || isNaN(amt) || amt < 0) { setError('Enter a valid amount.'); return }
    if (discEnabled && !discReason) { setError('Choose a discount reason.'); return }
    setSaving(true); setError('')
    const [yyyy, mm, dd] = payDate.split('-').map(Number)
    const [hh, mi]       = payTime.split(':').map(Number)
    const localDt        = new Date(yyyy, mm - 1, dd, hh, mi, 0)
    const finalAmt = discEnabled ? applyDiscount(amt, discPct) : amt
    const payload = {
      student_username: studentU, teacher_username: teacherU,
      amount: finalAmt, method,
      payment_date: localDt.toISOString(),
      notes: notes.trim() || null,
      payment_month: month, payment_year: year,
      discount_percent: discEnabled ? discPct : null,
      discount_reason:  discEnabled ? discReason : null,
    }
    const { error: err } = isEdit
      ? await supabase.from('payments').update(payload).eq('id', payment.id)
      : await supabase.from('payments').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    const stuName = allStudents.find(s => s.username === studentU)?.full_name || studentU
    const discNote = discEnabled ? ` (${discPct}% ${discReason} discount)` : ''
    if (isEdit) {
      logEdit({ action:'update', target_table:'payments', target_id:payment.id, summary:`Edited payment for ${stuName} → ${fmt(finalAmt)} UZS${discNote}` })
    } else if (discEnabled) {
      logEdit({ action:'create', target_table:'payments', summary:`Recorded ${fmt(finalAmt)} UZS for ${stuName}${discNote}` })
    }
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
        <div style={{ fontSize:'13px', color:'#94a3b8', marginBottom:'4px' }}>{MONTHS[month-1]} {year}</div>

        <label style={lbl}>Teacher</label>
        <select value={teacherU} onChange={e => handleTeacherChange(e.target.value)} disabled={!!prefill || isEdit}
          style={{ ...inpStyle, appearance:'none', cursor:(prefill||isEdit)?'default':'pointer', opacity:(prefill||isEdit)?0.7:1 }}>
          <option value="">Select teacher…</option>
          {teachers.map(t => <option key={t.username} value={t.username}>{t.full_name}</option>)}
        </select>

        {teacherU && <>
          <label style={lbl}>Group</label>
          <select value={groupKey} onChange={e => handleGroupChange(e.target.value)} disabled={!!prefill || isEdit}
            style={{ ...inpStyle, appearance:'none', cursor:(prefill||isEdit)?'default':'pointer', opacity:(prefill||isEdit)?0.7:1 }}>
            <option value="">Select group…</option>
            {teacherGroups.map(g => (
              <option key={`${g.day}|${g.class_time}`} value={`${g.day}|${g.class_time}`}>
                {g.level} · {dayLabel(g.day)} · {g.class_time}
              </option>
            ))}
          </select>
        </>}

        {groupKey && <>
          <label style={lbl}>Student</label>
          <select value={studentU} onChange={e => setStudentU(e.target.value)} disabled={!!prefill || isEdit}
            style={{ ...inpStyle, appearance:'none', cursor:(prefill||isEdit)?'default':'pointer', opacity:(prefill||isEdit)?0.7:1 }}>
            <option value="">Select student…</option>
            {groupStudents.map(s => (
              <option key={s.username} value={s.username}>{s.full_name}{s.status==='left'?' (left)':''}</option>
            ))}
          </select>
        </>}

        <label style={lbl}>Amount (UZS)</label>
        <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
          {PRESET_AMOUNTS.map(p => (
            <button key={p} onClick={() => setAmount(String(p))}
              style={{ flex:1, padding:'9px 4px', borderRadius:'10px', border:`1.5px solid ${String(amount)===String(p)?G:'#e4e8e7'}`, background:String(amount)===String(p)?`${G}12`:'white', color:String(amount)===String(p)?G:DARK, fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
              {fmt(p)}
            </button>
          ))}
        </div>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Or enter custom amount…" min="0" style={inpStyle} />

        <label style={lbl}>Method</label>
        <div style={{ display:'flex', gap:'8px', marginBottom:'4px' }}>
          {METHODS.map(m => (
            <button key={m} onClick={() => setMethod(m)}
              style={{ flex:1, padding:'9px 4px', borderRadius:'10px', border:`1.5px solid ${method===m?G:'#e4e8e7'}`, background:method===m?G:'white', color:method===m?'white':DARK, fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
              {m}
            </button>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <div><label style={lbl}>Date</label><input type="date" value={payDate} onChange={e=>setPayDate(e.target.value)} style={inpStyle}/></div>
          <div><label style={lbl}>Time</label><input type="time" value={payTime} onChange={e=>setPayTime(e.target.value)} style={inpStyle}/></div>
        </div>

        <label style={lbl}>Notes (optional)</label>
        <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any additional notes…" style={{ ...inpStyle, marginBottom:error?'10px':'0' }} />
        <DiscountControls enabled={discEnabled} setEnabled={setDiscEnabled} pct={discPct} setPct={setDiscPct} reason={discReason} setReason={setDiscReason} baseAmount={amount} />
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

function UnpaidModal({ students, onRecordPayment, onClose, readOnly }) {
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
        <div style={{ overflowY:'auto', flex:1 }}>
          {students.map((s, i) => (
            <div key={s.username} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 0', borderBottom:i<students.length-1?'1px solid #f0f2f1':'none' }}>
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
              {/* Record payment button — only for admin and manager, not shown if we ever needed pure view */}
              <button onClick={() => { onClose(); onRecordPayment(s) }}
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

// ════════════════════════════════════════════════════════════════════════════
// MANAGER PAYMENTS — unchanged monthly view (full access). Admin uses the new
// daily design below; this preserves the manager experience exactly as before.
// ════════════════════════════════════════════════════════════════════════════
function ManagerPayments({ readOnly = false, canDelete = false }) {
  const now = new Date()
  const [month,        setMonth]       = useState(now.getMonth() + 1)
  const [year,         setYear]        = useState(now.getFullYear())
  const [payments,     setPayments]    = useState([])
  const [allStudents,  setAllStudents] = useState([])
  const [allGroups,    setAllGroups]   = useState([])
  const [teachers,     setTeachers]    = useState([])
  const [loading,      setLoading]     = useState(true)
  const [search,       setSearch]      = useState('')
  const [modal,        setModal]       = useState(null)
  const [prefill,      setPrefill]     = useState(null)
  const [showUnpaid,   setShowUnpaid]  = useState(false)
  const [deleting,     setDeleting]    = useState(null)

  useEffect(() => { fetchAll() }, [month, year])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: pays }, { data: stus }, { data: grps }, { data: tchs }] = await Promise.all([
      supabase.from('payments').select('*').eq('payment_month', month).eq('payment_year', year).order('payment_date', { ascending: false }),
      supabase.from('students').select('username,full_name,phone,enrolled_date,status,left_date,teacher_username,day,class_time').neq('username','test').order('full_name'),
      supabase.from('groups').select('*').order('class_time'),
      supabase.from('teachers').select('username,full_name').neq('username','test').order('full_name'),
    ])
    setPayments(pays || []); setAllStudents(stus || [])
    setAllGroups(grps || []); setTeachers(tchs || [])
    setLoading(false)
  }

  const deletePayment = async (id) => {
    if (!confirm('Delete this payment record?')) return
    setDeleting(id)
    const p = payments.find(x => x.id === id)
    const stuName = allStudents.find(s => s.username === p?.student_username)?.full_name || p?.student_username || ''
    await supabase.from('payments').delete().eq('id', id)
    logEdit({ action:'delete', target_table:'payments', target_id:id, summary:`Deleted payment for ${stuName} (${fmt(p?.amount||0)} UZS)` })
    setDeleting(null); fetchAll()
  }

  const openNew = (student = null) => { setPrefill(student); setModal('new') }

  const monthOptions = []
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthOptions.push({ label:`${MONTHS[d.getMonth()]} ${d.getFullYear()}`, month:d.getMonth()+1, year:d.getFullYear() })
  }

  const eligible       = allStudents.filter(s => studentInMonth(s, month, year))
  const paidUsernames  = new Set(payments.map(p => p.student_username))
  const unpaidStudents = eligible.filter(s => !paidUsernames.has(s.username))
  const totalCollected = payments.reduce((a, p) => a + Number(p.amount), 0)
  const filtered       = payments.filter(p => {
    if (!search.trim()) return true
    const stu = allStudents.find(s => s.username === p.student_username)
    return stu?.full_name?.toLowerCase().includes(search.toLowerCase())
  })

  // Table columns — no Actions column for admin (readOnly)
  const cols    = readOnly ? '160px 1fr 150px 120px 180px' : '160px 1fr 150px 120px 180px 140px'
  const headers = readOnly ? ['Receipt #','Student','Amount','Method','Date & Time'] : ['Receipt #','Student','Amount','Method','Date & Time','Actions']
  const th = { fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', padding:'12px 16px' }

  return (
    <div style={{ padding:'32px', fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box}select{-webkit-appearance:none;-moz-appearance:none}`}</style>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', gap:'12px', flexWrap:'wrap' }}>
        <h1 style={{ fontSize:'22px', fontWeight:'800', color:DARK, fontFamily:"'Plus Jakarta Sans',sans-serif", margin:0 }}>Payments</h1>
        <div style={{ fontSize:'13px', color:'#94a3b8' }}>{new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px', flexWrap:'wrap' }}>
        <div style={{ position:'relative' }}>
          <select value={`${month}-${year}`} onChange={e => { const [m,y]=e.target.value.split('-'); setMonth(Number(m)); setYear(Number(y)) }}
            style={{ padding:'9px 36px 9px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', fontWeight:'700', color:DARK, background:'white', cursor:'pointer', fontFamily:"'DM Sans',sans-serif", outline:'none' }}>
            {monthOptions.map(o => <option key={`${o.month}-${o.year}`} value={`${o.month}-${o.year}`}>{o.label}</option>)}
          </select>
          <svg style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={DARK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <div style={{ position:'relative', flex:1, minWidth:'200px', maxWidth:'320px' }}>
          <svg style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student…"
            style={{ width:'100%', padding:'9px 12px 9px 36px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', color:DARK, outline:'none', background:'white', fontFamily:"'DM Sans',sans-serif" }} />
        </div>
        {/* Both admin and manager can record a payment */}
        <div style={{ marginLeft:'auto' }}>
          <button onClick={() => openNew()}
            style={{ padding:'9px 18px', borderRadius:'10px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif", display:'flex', alignItems:'center', gap:'6px' }}>
            <span style={{ fontSize:'18px', lineHeight:1 }}>+</span> Record payment
          </button>
        </div>
      </div>

      {/* Stats — admin (readOnly) sees 3 cards, manager sees 4 including Collected */}
      <div style={{ display:'grid', gridTemplateColumns:readOnly ? 'repeat(3,1fr)' : 'repeat(4,1fr)', gap:'16px', marginBottom:'28px' }}>
        <div style={{ background:'white', borderRadius:'14px', padding:'18px 20px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px' }}>Total Students</div>
          <div style={{ fontSize:'26px', fontWeight:'800', color:DARK, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{loading?'…':eligible.length}</div>
        </div>
        <div style={{ background:'white', borderRadius:'14px', padding:'18px 20px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px' }}>Paid</div>
          <div style={{ fontSize:'26px', fontWeight:'800', color:G, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{loading?'…':paidUsernames.size}</div>
        </div>
        {/* Unpaid card — both admin and manager can click to see the list */}
        <div onClick={() => !loading && unpaidStudents.length > 0 && setShowUnpaid(true)}
          style={{ background:'white', borderRadius:'14px', padding:'18px 20px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', cursor:unpaidStudents.length>0?'pointer':'default', border:unpaidStudents.length>0?'1.5px solid #fde8e8':'1.5px solid transparent', transition:'box-shadow 0.15s' }}
          onMouseEnter={e=>{ if(unpaidStudents.length>0) e.currentTarget.style.boxShadow='0 4px 16px rgba(239,68,68,0.15)' }}
          onMouseLeave={e=>e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,0.06)'}>
          <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px' }}>Unpaid</div>
          <div style={{ fontSize:'26px', fontWeight:'800', color:'#ef4444', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{loading?'…':unpaidStudents.length}</div>
          {!loading && unpaidStudents.length > 0 && <div style={{ fontSize:'12px', color:'#ef4444', marginTop:'4px', fontWeight:'600' }}>Click to see →</div>}
        </div>
        {/* Collected — manager only */}
        {!readOnly && (
          <div style={{ background:'white', borderRadius:'14px', padding:'18px 20px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px' }}>Collected</div>
            <div style={{ fontSize:'22px', fontWeight:'800', color:DARK, fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1.2 }}>{loading?'…':`${fmt(totalCollected)} UZS`}</div>
          </div>
        )}
      </div>

      {/* Payment log */}
      <div style={{ background:'white', borderRadius:'16px', overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.07)' }}>
        <div style={{ display:'grid', gridTemplateColumns:cols, background:'#f8fafb', borderBottom:'1px solid #f0f2f1' }}>
          {headers.map((h,i) => <div key={i} style={th}>{h}</div>)}
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
            <div key={p.id} style={{ display:'grid', gridTemplateColumns:cols, alignItems:'center', borderBottom:i<filtered.length-1?'1px solid #f0f2f1':'none', background:'white', transition:'background 0.1s' }}
              onMouseEnter={e=>e.currentTarget.style.background='#f8fafb'}
              onMouseLeave={e=>e.currentTarget.style.background='white'}>
              <div style={{ padding:'14px 16px', fontSize:'13px', fontWeight:'700', color:G, fontFamily:'monospace' }}>{receiptNo}</div>
              <div style={{ padding:'14px 16px' }}>
                <div style={{ fontSize:'14px', fontWeight:'700', color:DARK }}>{stu?.full_name || p.student_username}</div>
                {stu?.status==='left' && <span style={{ fontSize:'10px', fontWeight:'700', color:'#ef4444' }}>Left</span>}
              </div>
              <div style={{ padding:'14px 16px', fontSize:'14px', fontWeight:'800', color:Number(p.amount)>0?G:'#94a3b8', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{fmt(p.amount)} UZS</div>
              <div style={{ padding:'14px 16px', fontSize:'13px', color:'#64748b', fontWeight:'600' }}>{p.method||'—'}</div>
              <div style={{ padding:'14px 16px', fontSize:'12px', color:'#64748b', fontFamily:'monospace' }}>{fmtDateTime(p.payment_date)}</div>
              {/* Edit — manager + CEO. Delete — CEO only. */}
              {!readOnly && (
                <div style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:'8px' }}>
                  <button onClick={() => { setPrefill(null); setModal(p) }}
                    style={{ padding:'6px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', background:'white', color:DARK, fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
                    Edit
                  </button>
                  {canDelete && (
                    <button onClick={() => deletePayment(p.id)} disabled={deleting===p.id}
                      style={{ width:'28px', height:'28px', borderRadius:'8px', border:'1.5px solid #fde8e8', background:'white', color:'#ef4444', fontSize:'16px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:'800' }}>
                      {deleting===p.id?'…':'×'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {modal && (
        <PaymentModal
          payment={modal==='new' ? null : modal}
          prefill={modal==='new' ? prefill : null}
          allStudents={allStudents} allGroups={allGroups}
          month={month} year={year} teachers={teachers}
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


// ════════════════════════════════════════════════════════════════════════════
// ADMIN PAYMENTS — daily view (boss redesign)
//   • today-only payment list + daily cash/card/transfer/total report
//   • Unpaid split into OLD (flat 700,000) and NEW (prorated 60,000 × lessons)
//   • record-only (no edit/delete), partial payments sum toward the dues
// ════════════════════════════════════════════════════════════════════════════

const FLAT_FEE        = 700000
const PER_LESSON_FEE  = 60000

function localDay(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmtTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

// ── proration (mirrors the New Students contract maths) ──────────────────────
function relevantHolidays(student, holidays) {
  return (holidays||[]).filter(h => {
    if (h.scope === 'all') return true
    if (h.scope === 'teacher') return h.teacher_username === student.teacher_username
    if (h.scope === 'group')   return h.group_id === student.group_id
    return false
  })
}
function countClassDays(startStr, endDate, dayType, hols) {
  const classDays = dayType === 'odd' ? [1,3,5] : [2,4,6]
  const isHoliday = ds => hols.some(h => ds >= h.start_date && ds <= h.end_date)
  let c = 0
  const d = new Date(startStr + 'T00:00:00')
  while (d <= endDate) {
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    if (classDays.includes(d.getDay()) && !isHoliday(ds)) c++
    d.setDate(d.getDate() + 1)
  }
  return c
}
// A student is "new" this month if their contract was signed within it.
function isNewThisMonth(s, month, year) {
  if (!s.contract_date) return false
  const d = new Date(s.contract_date + 'T00:00:00')
  return (d.getMonth()+1) === month && d.getFullYear() === year
}
// Owed this month: flat fee for old students, prorated for new ones (from their
// first trial day — clamped to the start of this month — to month-end).
function owedThisMonth(s, month, year, holidays) {
  if (!isNewThisMonth(s, month, year)) return FLAT_FEE
  const monthStart = `${year}-${String(month).padStart(2,'0')}-01`
  const start = (s.enrolled_date && s.enrolled_date > monthStart) ? s.enrolled_date : monthStart
  const end   = new Date(year, month, 0)
  const lessons = countClassDays(start, end, s.day, relevantHolidays(s, holidays))
  return lessons * PER_LESSON_FEE
}

// A LEFT student owes for their final month, prorated to their leave date:
// 60k × lessons from the start of the leave month up to (and including) left_date.
// Returns { owed, month, year } or null if we can't determine the leave date.
function leftStudentOwed(s, holidays) {
  if (!s.left_date) return null
  const ld = new Date(s.left_date + 'T00:00:00')
  if (isNaN(ld)) return null
  const lm = ld.getMonth() + 1, ly = ld.getFullYear()
  const monthStart = `${ly}-${String(lm).padStart(2,'0')}-01`
  // count from enrolment if they enrolled mid-leave-month, else from month start
  const start = (s.enrolled_date && s.enrolled_date > monthStart) ? s.enrolled_date : monthStart
  const lessons = countClassDays(start, ld, s.day, relevantHolidays(s, holidays))
  return { owed: lessons * PER_LESSON_FEE, month: lm, year: ly }
}

// ── record-payment modal (today, presets 700k, partial allowed) ──────────────
function AdminPaymentModal({ prefill, defaultAmount, students, groups, teachers, month, year, onClose, onSaved }) {
  const locked = !!prefill
  const initStu = prefill || null
  const [teacherU, setTeacherU] = useState(initStu?.teacher_username || '')
  const [groupKey, setGroupKey] = useState(initStu ? `${initStu.day}|${initStu.class_time}` : '')
  const [studentU, setStudentU] = useState(initStu?.username || '')
  const [amount,   setAmount]   = useState(defaultAmount != null ? String(defaultAmount) : '')
  const [method,   setMethod]   = useState('Cash')
  const [notes,    setNotes]    = useState('')
  const [discEnabled, setDiscEnabled] = useState(false)
  const [discPct,     setDiscPct]     = useState(10)
  const [discReason,  setDiscReason]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const teacherGroups = groups.filter(g => g.teacher_username === teacherU)
  const [gDay, gTime] = groupKey.split('|')
  const groupStudents = students.filter(s =>
    s.teacher_username === teacherU && s.day === gDay && s.class_time === gTime && s.status === 'active'
  )

  const save = async () => {
    if (!studentU) { setError('Select a student.'); return }
    const amt = parseFloat(amount)
    if (!amount || isNaN(amt) || amt <= 0) { setError('Enter a valid amount.'); return }
    if (discEnabled && !discReason) { setError('Choose a discount reason.'); return }
    setSaving(true); setError('')
    const finalAmt = discEnabled ? applyDiscount(amt, discPct) : amt
    const payload = {
      student_username: studentU, teacher_username: teacherU || (students.find(s=>s.username===studentU)?.teacher_username),
      amount: finalAmt, method,
      payment_date: new Date().toISOString(),
      notes: notes.trim() || null,
      payment_month: month, payment_year: year,
      discount_percent: discEnabled ? discPct : null,
      discount_reason:  discEnabled ? discReason : null,
    }
    const { error: err } = await supabase.from('payments').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    if (discEnabled) {
      const stuName = students.find(s => s.username === studentU)?.full_name || studentU
      logEdit({ action:'create', target_table:'payments', summary:`Recorded ${fmt(finalAmt)} UZS for ${stuName} (${discPct}% ${discReason} discount)` })
    }
    onSaved()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'20px', padding:'28px', width:'100%', maxWidth:'440px', boxShadow:'0 24px 64px rgba(0,0,0,0.18)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
          <span style={{ fontSize:'18px', fontWeight:'800', color:DARK, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Record Payment</span>
          <button onClick={onClose} style={{ width:'30px', height:'30px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'16px' }}>✕</button>
        </div>

        {locked ? (
          <div style={{ background:'#f8fafb', borderRadius:'10px', padding:'12px 14px', marginBottom:'8px' }}>
            <div style={{ fontSize:'14px', fontWeight:'700', color:DARK }}>{prefill.full_name}</div>
            <div style={{ fontSize:'12px', color:'#94a3b8' }}>{dayLabel(prefill.day)} · {prefill.class_time}</div>
          </div>
        ) : (
          <>
            <label style={lbl}>Teacher</label>
            <select value={teacherU} onChange={e => { setTeacherU(e.target.value); setGroupKey(''); setStudentU('') }} style={{ ...inpStyle, appearance:'none' }}>
              <option value="">Select teacher…</option>
              {teachers.map(t => <option key={t.username} value={t.username}>{t.full_name}</option>)}
            </select>
            {teacherU && <>
              <label style={lbl}>Group</label>
              <select value={groupKey} onChange={e => { setGroupKey(e.target.value); setStudentU('') }} style={{ ...inpStyle, appearance:'none' }}>
                <option value="">Select group…</option>
                {teacherGroups.map(g => <option key={`${g.day}|${g.class_time}`} value={`${g.day}|${g.class_time}`}>{g.level} · {dayLabel(g.day)} · {g.class_time}</option>)}
              </select>
            </>}
            {groupKey && <>
              <label style={lbl}>Student</label>
              <select value={studentU} onChange={e => setStudentU(e.target.value)} style={{ ...inpStyle, appearance:'none' }}>
                <option value="">Select student…</option>
                {groupStudents.map(s => <option key={s.username} value={s.username}>{s.full_name}</option>)}
              </select>
            </>}
          </>
        )}

        <label style={lbl}>Amount (UZS)</label>
        <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
          {[FLAT_FEE, defaultAmount].filter((v,i,a) => v != null && a.indexOf(v)===i).map(p => (
            <button key={p} onClick={() => setAmount(String(p))}
              style={{ flex:1, padding:'10px 4px', borderRadius:'10px', border:`1.5px solid ${String(amount)===String(p)?G:'#e4e8e7'}`, background:String(amount)===String(p)?`${G}12`:'white', color:String(amount)===String(p)?G:DARK, fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
              {fmt(p)}{defaultAmount!=null && p===defaultAmount ? ' (due)' : ''}
            </button>
          ))}
        </div>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Or enter a partial amount…" min="0" style={inpStyle} />

        <label style={lbl}>Method</label>
        <div style={{ display:'flex', gap:'8px', marginBottom:'4px' }}>
          {METHODS.map(m => (
            <button key={m} onClick={() => setMethod(m)}
              style={{ flex:1, padding:'10px 4px', borderRadius:'10px', border:`1.5px solid ${method===m?G:'#e4e8e7'}`, background:method===m?G:'white', color:method===m?'white':DARK, fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
              {m}
            </button>
          ))}
        </div>

        <label style={lbl}>Notes (optional)</label>
        <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any additional notes…" style={{ ...inpStyle, marginBottom:error?'10px':'0' }} />
        <DiscountControls enabled={discEnabled} setEnabled={setDiscEnabled} pct={discPct} setPct={setDiscPct} reason={discReason} setReason={setDiscReason} baseAmount={amount} />
        {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginTop:'10px' }}>{error}</div>}

        <div style={{ display:'flex', gap:'12px', marginTop:'20px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'13px', borderRadius:'12px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex:2, padding:'13px', borderRadius:'12px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {saving ? 'Saving…' : 'Save payment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── unpaid bucket list, filterable by teacher + group ────────────────────────
function UnpaidBucketModal({ title, rows, teachers, onRecord, onClose }) {
  const [teacherF, setTeacherF] = useState('all')
  const [groupF,   setGroupF]   = useState('all')

  const groupOptions = Array.from(new Set(
    rows.filter(r => teacherF==='all' || r.student.teacher_username===teacherF)
        .map(r => `${r.student.day}|${r.student.class_time}`)
  ))
  const filtered = rows.filter(r => {
    if (teacherF !== 'all' && r.student.teacher_username !== teacherF) return false
    if (groupF !== 'all' && `${r.student.day}|${r.student.class_time}` !== groupF) return false
    return true
  })
  const tName = u => teachers.find(t => t.username===u)?.full_name || u

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'20px', padding:'24px', width:'100%', maxWidth:'540px', boxShadow:'0 24px 64px rgba(0,0,0,0.18)', maxHeight:'82vh', display:'flex', flexDirection:'column' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
          <span style={{ fontSize:'17px', fontWeight:'800', color:DARK, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{title} ({filtered.length})</span>
          <button onClick={onClose} style={{ width:'30px', height:'30px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'16px' }}>✕</button>
        </div>

        <div style={{ display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap' }}>
          <select value={teacherF} onChange={e => { setTeacherF(e.target.value); setGroupF('all') }} style={{ ...inpStyle, width:'auto', marginBottom:0, appearance:'none', flex:1 }}>
            <option value="all">All teachers</option>
            {teachers.map(t => <option key={t.username} value={t.username}>{t.full_name}</option>)}
          </select>
          <select value={groupF} onChange={e => setGroupF(e.target.value)} style={{ ...inpStyle, width:'auto', marginBottom:0, appearance:'none', flex:1 }}>
            <option value="all">All groups</option>
            {groupOptions.map(k => { const [d,t]=k.split('|'); return <option key={k} value={k}>{dayLabel(d)} · {t}</option> })}
          </select>
        </div>

        <div style={{ overflowY:'auto', flex:1 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'40px', color:'#94a3b8', fontSize:'14px' }}>No unpaid students match these filters.</div>
          ) : filtered.map((r, i) => (
            <div key={r.student.username} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 0', borderBottom:i<filtered.length-1?'1px solid #f0f2f1':'none' }}>
              <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'#fde8e8', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <span style={{ fontSize:'12px', fontWeight:'800', color:'#ef4444' }}>{r.student.full_name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}</span>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'14px', fontWeight:'700', color:DARK, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:'7px' }}>
                  {r.student.full_name}
                  {r.student.status==='left' && <span style={{ fontSize:'10px', fontWeight:'700', padding:'2px 7px', borderRadius:'20px', background:'#fee2e2', color:'#dc2626', flexShrink:0 }}>Left</span>}
                </div>
                <div style={{ fontSize:'11px', color:'#94a3b8' }}>{tName(r.student.teacher_username)} · {dayLabel(r.student.day)} · {r.student.class_time}</div>
                {r.student.phone && (
                  <a href={`tel:${r.student.phone}`} style={{ fontSize:'12px', color:G, fontWeight:'700', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:'4px', marginTop:'2px' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    {r.student.phone}
                  </a>
                )}
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:'14px', fontWeight:'800', color:'#ef4444', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{fmt(r.remaining)}</div>
                <div style={{ fontSize:'10px', color:'#94a3b8' }}>of {fmt(r.owed)} UZS</div>
              </div>
              <button onClick={() => { onClose(); onRecord(r) }}
                style={{ padding:'7px 13px', borderRadius:'9px', border:`1.5px solid ${G}`, background:'white', color:G, fontSize:'12px', fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                Record
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── daily report modal with print-to-PDF ─────────────────────────────────────
function ReportModal({ stats, dateLabel, onClose }) {
  const printReport = () => {
    const rowsHtml = ['Cash','Card','Transfer'].map(m =>
      `<tr><td>${m}</td><td style="text-align:right">${stats.byMethod[m].count}</td><td style="text-align:right">${fmt(stats.byMethod[m].sum)} UZS</td></tr>`
    ).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Daily Payment Report</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#002b2a;padding:40px;max-width:640px;margin:0 auto}
        h1{font-size:22px;margin:0 0 4px}
        .sub{color:#64748b;font-size:13px;margin-bottom:24px}
        table{width:100%;border-collapse:collapse;margin-bottom:18px}
        th,td{padding:10px 12px;border-bottom:1px solid #e4e8e7;font-size:14px}
        th{text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
        .total{font-weight:800;font-size:16px}
        .total td{border-top:2px solid #002b2a;border-bottom:none}
        .meta{display:flex;gap:24px;margin-bottom:20px}
        .meta div{font-size:13px}.meta b{display:block;font-size:20px}
      </style></head><body>
      <h1>Daily Payment Report</h1>
      <div class="sub">Smart Learning Center · ${dateLabel}</div>
      <div class="meta">
        <div>Students paid<b>${stats.studentCount}</b></div>
        <div>Payments<b>${stats.totalCount}</b></div>
        <div>Total collected<b>${fmt(stats.totalSum)} UZS</b></div>
      </div>
      <table>
        <thead><tr><th>Method</th><th style="text-align:right">Count</th><th style="text-align:right">Amount</th></tr></thead>
        <tbody>${rowsHtml}
          <tr class="total"><td>Total</td><td style="text-align:right">${stats.totalCount}</td><td style="text-align:right">${fmt(stats.totalSum)} UZS</td></tr>
        </tbody>
      </table>
      <div style="color:#94a3b8;font-size:11px">Generated ${new Date().toLocaleString('en-GB')}</div>
      <script>window.onload=function(){window.print()}</script>
      </body></html>`
    const w = window.open('', '_blank')
    if (!w) { alert('Please allow pop-ups to download the report.'); return }
    w.document.write(html); w.document.close()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'20px', padding:'26px', width:'100%', maxWidth:'420px', boxShadow:'0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
          <span style={{ fontSize:'18px', fontWeight:'800', color:DARK, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Daily Report</span>
          <button onClick={onClose} style={{ width:'30px', height:'30px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'16px' }}>✕</button>
        </div>
        <div style={{ fontSize:'13px', color:'#94a3b8', marginBottom:'18px' }}>{dateLabel}</div>

        <div style={{ display:'flex', gap:'10px', marginBottom:'16px' }}>
          <div style={{ flex:1, background:'#f8fafb', borderRadius:'12px', padding:'14px', textAlign:'center' }}>
            <div style={{ fontSize:'24px', fontWeight:'800', color:DARK, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{stats.studentCount}</div>
            <div style={{ fontSize:'11px', color:'#94a3b8', fontWeight:'600', marginTop:'2px' }}>Students paid</div>
          </div>
          <div style={{ flex:1, background:'#f8fafb', borderRadius:'12px', padding:'14px', textAlign:'center' }}>
            <div style={{ fontSize:'24px', fontWeight:'800', color:G, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{stats.totalCount}</div>
            <div style={{ fontSize:'11px', color:'#94a3b8', fontWeight:'600', marginTop:'2px' }}>Payments</div>
          </div>
        </div>

        <div style={{ background:'#f8fafb', borderRadius:'12px', padding:'4px 14px', marginBottom:'16px' }}>
          {['Cash','Card','Transfer'].map(m => (
            <div key={m} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #eef1f0' }}>
              <span style={{ fontSize:'13px', color:'#64748b', fontWeight:'600' }}>{m} <span style={{ color:'#cbd5e1' }}>· {stats.byMethod[m].count}</span></span>
              <span style={{ fontSize:'14px', fontWeight:'700', color:DARK }}>{fmt(stats.byMethod[m].sum)} UZS</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0' }}>
            <span style={{ fontSize:'14px', color:DARK, fontWeight:'800' }}>Total</span>
            <span style={{ fontSize:'16px', fontWeight:'800', color:G, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{fmt(stats.totalSum)} UZS</span>
          </div>
        </div>

        <button onClick={printReport} style={{ width:'100%', padding:'13px', borderRadius:'12px', border:'none', background:DARK, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:'8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Download the report (PDF)
        </button>
      </div>
    </div>
  )
}

function AdminPayments() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()
  const today = localDay(now)

  const [payments, setPayments] = useState([])
  const [students, setStudents] = useState([])
  const [groups,   setGroups]   = useState([])
  const [teachers, setTeachers] = useState([])
  const [holidays, setHolidays] = useState([])
  const [leftPayments, setLeftPayments] = useState([])  // all-time payments for left students
  const [loading,  setLoading]  = useState(true)
  const [record,   setRecord]   = useState(null)   // { prefill, defaultAmount } | 'new'
  const [bucket,   setBucket]   = useState(null)    // 'old' | 'new'
  const [showReport, setShowReport] = useState(false)

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: pays }, { data: stus }, { data: grps }, { data: tchs }, { data: hols }] = await Promise.all([
      supabase.from('payments').select('*').eq('payment_month', month).eq('payment_year', year).order('payment_date', { ascending:false }),
      supabase.from('students').select('username,full_name,phone,enrolled_date,contract_date,status,is_trial,left_date,teacher_username,day,class_time,group_id').neq('username','test').order('full_name'),
      supabase.from('groups').select('*').order('class_time'),
      supabase.from('teachers').select('username,full_name').neq('username','test').order('full_name'),
      supabase.from('holidays').select('*'),
    ])
    setPayments(pays||[]); setStudents(stus||[]); setGroups(grps||[]); setTeachers(tchs||[]); setHolidays(hols||[])

    // Left students owe for their FINAL month (prorated to leave date), which may
    // be a past month, so we need their payments from that month specifically.
    const leftUsernames = (stus||[]).filter(s => s.status==='left' && s.left_date).map(s => s.username)
    if (leftUsernames.length) {
      const { data: lp } = await supabase.from('payments')
        .select('student_username,amount,discount_percent,payment_month,payment_year')
        .in('student_username', leftUsernames)
      setLeftPayments(lp||[])
    } else {
      setLeftPayments([])
    }
    setLoading(false)
  }

  // paid-this-month per student (partial payments accumulate)
  const paidByStudent = {}
  const discountByStudent = {}   // max discount % applied to this student this month
  payments.forEach(p => {
    paidByStudent[p.student_username] = (paidByStudent[p.student_username]||0) + Number(p.amount||0)
    const pct = Number(p.discount_percent || 0)
    if (pct > (discountByStudent[p.student_username] || 0)) discountByStudent[p.student_username] = pct
  })

  // unpaid buckets — a discount lowers what the student OWES this month, so a
  // discounted full payment (e.g. 630k on a 700k base) counts as fully paid.
  const active = students.filter(s => s.status === 'active')
  const buildRow = s => {
    const baseOwed = owedThisMonth(s, month, year, holidays)
    const owed = applyDiscount(baseOwed, discountByStudent[s.username] || 0)
    const paid = paidByStudent[s.username] || 0
    return { student:s, owed, paid, remaining: Math.max(owed - paid, 0) }
  }
  const unpaidNew = active.filter(s => isNewThisMonth(s, month, year)).map(buildRow).filter(r => r.remaining > 0)
  const unpaidOldActive = active.filter(s => !isNewThisMonth(s, month, year)).map(buildRow).filter(r => r.remaining > 0)

  // LEFT students who still owe their final-month dues (prorated to leave date).
  // Owed/paid are computed against their LEAVE month — which may be a past month
  // — so they show up regardless of the current month.
  const leftRows = students.filter(s => s.status === 'left').map(s => {
    const info = leftStudentOwed(s, holidays)
    if (!info) return null
    const monthPays = leftPayments.filter(p => p.student_username === s.username && p.payment_month === info.month && p.payment_year === info.year)
    const paid = monthPays.reduce((a,p) => a + Number(p.amount||0), 0)
    const maxDisc = monthPays.reduce((mx,p) => Math.max(mx, Number(p.discount_percent||0)), 0)
    const owed = applyDiscount(info.owed, maxDisc)
    return { student:s, owed, paid, remaining: Math.max(owed - paid, 0), leftMonth: info.month, leftYear: info.year }
  }).filter(r => r && r.remaining > 0)

  // Left students join the "old" bucket, flagged as Left.
  const unpaidOld = [...unpaidOldActive, ...leftRows]

  // today's payments + report stats
  const todayPayments = payments.filter(p => localDay(p.payment_date) === today)
  const reportStats = (() => {
    const byMethod = { Cash:{count:0,sum:0}, Card:{count:0,sum:0}, Transfer:{count:0,sum:0} }
    let totalSum = 0
    todayPayments.forEach(p => {
      const m = (p.method && byMethod[p.method]) ? p.method : 'Cash'
      byMethod[m].count++; byMethod[m].sum += Number(p.amount||0); totalSum += Number(p.amount||0)
    })
    return { byMethod, totalSum, totalCount: todayPayments.length, studentCount: new Set(todayPayments.map(p=>p.student_username)).size }
  })()

  const dateLabel = now.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })

  const openRecordForRow = (r) => setRecord({
    prefill: r.student,
    defaultAmount: r.remaining,
    // left students: file the payment into their leave month so it clears the debt
    ...(r.student.status === 'left' && r.leftMonth ? { month: r.leftMonth, year: r.leftYear } : {}),
  })

  const th = { fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', padding:'12px 16px' }
  const cols = '150px 1fr 160px 120px 90px'

  return (
    <div style={{ padding:'32px', fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');*{box-sizing:border-box}select{-webkit-appearance:none;-moz-appearance:none}`}</style>

      {/* Action bar (no duplicate title/date — the shell header already shows them) */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px', flexWrap:'wrap' }}>
        <button onClick={() => setShowReport(true)}
          style={{ padding:'9px 16px', borderRadius:'10px', border:'1.5px solid #e4e8e7', background:'white', color:DARK, fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif", display:'flex', alignItems:'center', gap:'7px' }}>
          📊 Report
        </button>
        <div style={{ marginLeft:'auto' }}>
          <button onClick={() => setRecord('new')}
            style={{ padding:'9px 18px', borderRadius:'10px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif", display:'flex', alignItems:'center', gap:'6px' }}>
            <span style={{ fontSize:'18px', lineHeight:1 }}>+</span> Record payment
          </button>
        </div>
      </div>

      {/* Daily report bar */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'20px' }}>
        {[
          { label:'Cash today',     value:reportStats.byMethod.Cash.sum,     color:DARK },
          { label:'Card today',     value:reportStats.byMethod.Card.sum,     color:DARK },
          { label:'Transfer today', value:reportStats.byMethod.Transfer.sum, color:DARK },
          { label:'Total today',    value:reportStats.totalSum,              color:G },
        ].map(c => (
          <div key={c.label} style={{ background:'white', borderRadius:'14px', padding:'18px 20px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px' }}>{c.label}</div>
            <div style={{ fontSize:'20px', fontWeight:'800', color:c.color, fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1.2 }}>{loading?'…':`${fmt(c.value)}`}</div>
          </div>
        ))}
      </div>

      {/* Unpaid buckets */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'16px', marginBottom:'28px' }}>
        {[
          { key:'old', label:'Unpaid (old)', rows:unpaidOld },
          { key:'new', label:'Unpaid (new)', rows:unpaidNew },
        ].map(b => (
          <div key={b.key} onClick={() => !loading && b.rows.length>0 && setBucket(b.key)}
            style={{ background:'white', borderRadius:'14px', padding:'18px 20px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', cursor:b.rows.length>0?'pointer':'default', border:b.rows.length>0?'1.5px solid #fde8e8':'1.5px solid transparent' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px' }}>{b.label}</div>
            <div style={{ fontSize:'26px', fontWeight:'800', color:'#ef4444', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{loading?'…':b.rows.length}</div>
            {!loading && b.rows.length>0 && <div style={{ fontSize:'12px', color:'#ef4444', marginTop:'4px', fontWeight:'600' }}>Click to filter & record →</div>}
          </div>
        ))}
      </div>

      {/* Today's payments */}
      <div style={{ fontSize:'13px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'10px' }}>Today's payments</div>
      <div style={{ background:'white', borderRadius:'16px', overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,0.07)' }}>
        <div style={{ display:'grid', gridTemplateColumns:cols, background:'#f8fafb', borderBottom:'1px solid #f0f2f1' }}>
          {['Receipt #','Student','Amount','Method','Time'].map((h,i) => <div key={i} style={th}>{h}</div>)}
        </div>
        {loading ? (
          <div style={{ padding:'48px', textAlign:'center', color:'#94a3b8' }}>Loading…</div>
        ) : todayPayments.length === 0 ? (
          <div style={{ padding:'48px', textAlign:'center', color:'#94a3b8' }}>No payments recorded today yet.</div>
        ) : todayPayments.map((p, i) => {
          const stu = students.find(s => s.username === p.student_username)
          const receiptNo = p.receipt_number || `#${String(todayPayments.length - i).padStart(4,'0')}`
          return (
            <div key={p.id} style={{ display:'grid', gridTemplateColumns:cols, alignItems:'center', borderBottom:i<todayPayments.length-1?'1px solid #f0f2f1':'none' }}>
              <div style={{ padding:'14px 16px', fontSize:'13px', fontWeight:'700', color:G, fontFamily:'monospace' }}>{receiptNo}</div>
              <div style={{ padding:'14px 16px', fontSize:'14px', fontWeight:'700', color:DARK }}>{stu?.full_name || p.student_username}</div>
              <div style={{ padding:'14px 16px', fontSize:'14px', fontWeight:'800', color:G, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{fmt(p.amount)} UZS</div>
              <div style={{ padding:'14px 16px', fontSize:'13px', color:'#64748b', fontWeight:'600' }}>{p.method||'—'}</div>
              <div style={{ padding:'14px 16px', fontSize:'13px', color:'#64748b', fontFamily:'monospace' }}>{fmtTime(p.payment_date)}</div>
            </div>
          )
        })}
      </div>

      {record && (
        <AdminPaymentModal
          prefill={record === 'new' ? null : record.prefill}
          defaultAmount={record === 'new' ? null : record.defaultAmount}
          students={students} groups={groups} teachers={teachers}
          month={record !== 'new' && record.month ? record.month : month}
          year={record !== 'new' && record.year ? record.year : year}
          onClose={() => setRecord(null)}
          onSaved={() => { setRecord(null); fetchAll() }}
        />
      )}
      {bucket && (
        <UnpaidBucketModal
          title={bucket === 'old' ? 'Unpaid (old)' : 'Unpaid (new)'}
          rows={bucket === 'old' ? unpaidOld : unpaidNew}
          teachers={teachers}
          onRecord={openRecordForRow}
          onClose={() => setBucket(null)}
        />
      )}
      {showReport && <ReportModal stats={reportStats} dateLabel={dateLabel} onClose={() => setShowReport(false)} />}
    </div>
  )
}

// Role-driven:
//  • admin   → daily record-only view (AdminPayments), can record + discount
//  • manager → monthly view with edit (no delete)
//  • ceo     → monthly view with edit + delete
// Back-compat: a bare `readOnly` still maps to the admin view.
export default function PaymentsSection({ role, readOnly = false, canDelete = false }) {
  const r = role || (readOnly ? 'admin' : 'manager')
  if (r === 'admin') return <AdminPayments />
  return <ManagerPayments readOnly={false} canDelete={r === 'ceo' || canDelete} />
}