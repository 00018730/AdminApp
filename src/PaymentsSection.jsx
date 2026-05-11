import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const G = '#009472'
const D = '#002b2a'
const TIMES = ['9:30','14:30','16:30','18:30']

const iStyle = { width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, fontFamily:"'DM Sans',sans-serif", marginBottom:'12px', boxSizing:'border-box', background:'white' }
const lStyle = { fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'5px' }

const downloadCheque = (payment, studentName) => {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Georgia',serif;background:#f0f2f1;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.cheque{width:620px;background:white;border-radius:16px;overflow:hidden;border:2px solid ${G};box-shadow:0 8px 32px rgba(0,43,42,.15)}.ch-header{background:${D};color:white;padding:28px 36px;display:flex;justify-content:space-between;align-items:center}.logo{font-size:22px;font-weight:700;letter-spacing:-.3px}.num{text-align:right;font-size:12px;opacity:.7}.num span{display:block;font-size:22px;font-weight:700;opacity:1;margin-top:4px;color:${G}}.ch-body{padding:36px}.row{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #f0f2f1}.key{font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;font-weight:600}.val{font-size:15px;color:${D};font-weight:600}.amount-box{background:#f0faf7;border-radius:12px;padding:24px;margin:20px 0;display:flex;justify-content:space-between;align-items:center}.ak{font-size:13px;color:${G};font-weight:700;text-transform:uppercase;letter-spacing:.04em}.av{font-size:32px;color:${G};font-weight:800;font-family:sans-serif}.sigs{margin-top:32px;display:flex;justify-content:space-between}.sb{text-align:center}.sl{width:180px;border-bottom:2px solid ${D};height:44px;margin-bottom:8px}.slb{font-size:11px;color:#94a3b8;letter-spacing:.04em}.footer{background:#f8fafb;padding:16px 36px;border-top:1px solid #f0f2f1;display:flex;justify-content:space-between}.fs{font-size:11px;color:${G};font-weight:600}</style></head><body><div class="cheque"><div class="ch-header"><div class="logo">Smart Learning Center</div><div class="num">Official Receipt<span>#${payment.cheque_number||'—'}</span></div></div><div class="ch-body"><div class="row"><span class="key">Student</span><span class="val">${studentName}</span></div><div class="row"><span class="key">Payment Month</span><span class="val">${payment.payment_month||payment.month||'—'}</span></div><div class="row"><span class="key">Payment Date</span><span class="val">${payment.payment_date||'—'}</span></div><div class="row"><span class="key">Payment Time</span><span class="val">${payment.payment_time||'—'}</span></div><div class="row" style="border:none"><span class="key">Method</span><span class="val" style="text-transform:capitalize">${payment.method||'Cash'}</span></div><div class="amount-box"><span class="ak">Amount Paid</span><span class="av">${Number(payment.amount||0).toLocaleString()} UZS</span></div><div class="sigs"><div class="sb"><div class="sl"></div><div class="slb">Student Signature</div></div><div class="sb"><div class="sl"></div><div class="slb">Administrator</div></div></div></div><div class="footer"><span class="fs">Smart Learning Center · Official Receipt</span><span class="fs">Keep this for your records</span></div></div></body></html>`
  const blob = new Blob([html], { type:'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `Receipt_${payment.cheque_number}_${studentName.replace(/\s+/g,'_')}.html`; a.click()
  URL.revokeObjectURL(url)
}

function PaymentForm({ teachers, students, payments, month, editPayment, onSave, onClose }) {
  const [payStudent, setPayStudent] = useState(editPayment?.student_username || '')
  const [payTeacher, setPayTeacher] = useState('')
  const [payGroup, setPayGroup]     = useState('')
  const [payAmount, setPayAmount]   = useState(String(editPayment?.amount || '550000'))
  const [payMethod, setPayMethod]   = useState(editPayment?.method || 'cash')
  const [payDate, setPayDate]       = useState(editPayment?.payment_date || new Date().toISOString().slice(0,10))
  const [payTime, setPayTime]       = useState(editPayment?.payment_time || new Date().toTimeString().slice(0,5))
  const [payNotes, setPayNotes]     = useState(editPayment?.notes || '')
  const [saving, setSaving]         = useState(false)

  // Pre-fill teacher/group when editing
  useEffect(() => {
    if (editPayment?.student_username) {
      const s = students.find(s => s.username === editPayment.student_username)
      if (s) {
        setPayTeacher(s.teacher_username)
        setPayGroup(`${s.day}-${s.class_time}`)
      }
    }
  }, [editPayment])

  const save = async () => {
    if (!payStudent) { alert('Select a student!'); return }
    setSaving(true)
    if (editPayment) {
      await supabase.from('payments').update({
        amount: parseInt(payAmount),
        method: payMethod,
        payment_date: payDate,
        payment_time: payTime,
        notes: payNotes || null,
      }).eq('id', editPayment.id)
    } else {
      const num = `SLC-${new Date().getFullYear()}-${String(payments.length+1).padStart(4,'0')}`
      await supabase.from('payments').insert({
        student_username: payStudent,
        month, payment_month: month,
        amount: parseInt(payAmount),
        status: 'paid', method: payMethod,
        payment_date: payDate,
        payment_time: payTime,
        cheque_number: num,
        notes: payNotes || null,
      })
    }
    setSaving(false)
    onSave()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'16px', padding:'28px', width:'460px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(0,0,0,0.18)' }}>
        <h3 style={{ fontSize:'18px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'20px' }}>
          {editPayment ? 'Edit Payment' : 'Record Payment'}
        </h3>

        {!editPayment && <>
          <label style={lStyle}>Teacher</label>
          <select value={payTeacher} onChange={e => { setPayTeacher(e.target.value); setPayGroup(''); setPayStudent('') }} style={iStyle}>
            <option value="">Select teacher...</option>
            {teachers.map(t => <option key={t.username} value={t.username}>{t.full_name}</option>)}
          </select>

          {payTeacher && <>
            <label style={lStyle}>Group</label>
            <select value={payGroup} onChange={e => { setPayGroup(e.target.value); setPayStudent('') }} style={iStyle}>
              <option value="">Select group...</option>
              {['odd','even'].map(day => TIMES.map(time => {
                const cnt = students.filter(s => s.teacher_username===payTeacher && s.day===day && s.class_time===time).length
                if (!cnt) return null
                return <option key={`${day}-${time}`} value={`${day}-${time}`}>{day==='odd'?'Odd':'Even'} · {time} ({cnt})</option>
              }))}
            </select>
          </>}

          {payGroup && <>
            <label style={lStyle}>Student</label>
            <select value={payStudent} onChange={e => setPayStudent(e.target.value)} style={iStyle}>
              <option value="">Select student...</option>
              {students.filter(s => {
                const parts = payGroup.split(/-(?=\d)/)
                const day = parts[0], time = parts.slice(1).join('-')
                return s.teacher_username===payTeacher && s.day===day && s.class_time===time
              }).map(s => <option key={s.username} value={s.username}>{s.full_name}</option>)}
            </select>
          </>}
        </>}

        {editPayment && (
          <div style={{ background:`${G}08`, borderRadius:'10px', padding:'12px 14px', marginBottom:'14px', fontSize:'14px', fontWeight:'600', color:D }}>
            Student: {students.find(s=>s.username===editPayment.student_username)?.full_name || editPayment.student_username}
          </div>
        )}

        <label style={lStyle}>Amount (UZS)</label>
        <div style={{ display:'flex', gap:'8px', marginBottom:'8px' }}>
          {['550000','600000','650000'].map(a => (
            <button key={a} onClick={() => setPayAmount(a)} style={{ flex:1, padding:'9px', borderRadius:'8px', border:`1.5px solid ${payAmount===a?G:'#e4e8e7'}`, background:payAmount===a?`${G}12`:'white', color:payAmount===a?G:'#64748b', fontSize:'13px', fontWeight:'600', cursor:'pointer' }}>
              {parseInt(a).toLocaleString()}
            </button>
          ))}
        </div>
        <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} placeholder="Custom amount" style={iStyle} />

        <label style={lStyle}>Method</label>
        <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
          {['cash','card','online','transfer'].map(m => (
            <button key={m} onClick={() => setPayMethod(m)} style={{ flex:1, padding:'9px', borderRadius:'8px', border:`1.5px solid ${payMethod===m?G:'#e4e8e7'}`, background:payMethod===m?`${G}12`:'white', color:payMethod===m?G:'#64748b', fontSize:'12px', fontWeight:'600', cursor:'pointer', textTransform:'capitalize' }}>{m}</button>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          <div>
            <label style={lStyle}>Date</label>
            <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={iStyle} />
          </div>
          <div>
            <label style={lStyle}>Time</label>
            <input type="time" value={payTime} onChange={e => setPayTime(e.target.value)} style={iStyle} />
          </div>
        </div>

        <label style={lStyle}>Notes (optional)</label>
        <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Any additional notes..." style={iStyle} />

        <div style={{ display:'flex', gap:'10px', marginTop:'8px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving || (!editPayment && !payStudent)}
            style={{ flex:1, padding:'12px', borderRadius:'8px', border:'none', background:G, color:'white', fontSize:'14px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'700', cursor:'pointer', opacity:(!editPayment && !payStudent)?.6:1 }}>
            {saving ? 'Saving...' : editPayment ? 'Save changes' : 'Save payment'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PaymentsSection() {
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading]   = useState(true)
  const [month, setMonth]       = useState(() => new Date().toISOString().slice(0,7))
  const [showUnpaid, setShowUnpaid]       = useState(false)
  const [unpaidTeacher, setUnpaidTeacher] = useState(null)
  const [showForm, setShowForm]           = useState(false)
  const [editPayment, setEditPayment]     = useState(null)
  const [search, setSearch]               = useState('')

  const monthOpts = Array.from({length:8},(_,i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-4+i)
    return { val:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label:d.toLocaleDateString('en-US',{month:'long',year:'numeric'}) }
  })

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data:s }, { data:t }, { data:p }] = await Promise.all([
      supabase.from('students').select('*').eq('status','active'),
      supabase.from('teachers').select('*').order('full_name'),
      supabase.from('payments').select('*,students(full_name)').order('created_at',{ascending:false}),
    ])
    if (s) setStudents(s)
    if (t) setTeachers(t)
    if (p) setPayments(p)
    setLoading(false)
  }

  const deletePayment = async (id) => {
    if (!confirm('Delete this payment record?')) return
    await supabase.from('payments').delete().eq('id', id)
    fetchAll()
  }

  const monthPays   = payments.filter(p => (p.payment_month||p.month) === month)
  const paidSet     = new Set(monthPays.map(p => p.student_username))
  const paidCount   = students.filter(s => paidSet.has(s.username)).length
  const unpaidCount = students.length - paidCount
  const collected   = monthPays.reduce((sum,p) => sum+(p.amount||0), 0)
  const listed      = monthPays.filter(p => !search || (p.students?.full_name||p.student_username||'').toLowerCase().includes(search.toLowerCase()))

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'#94a3b8', fontSize:'14px' }}>Loading...</div>

  return (
    <div>
      {/* Controls */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'22px', flexWrap:'wrap', gap:'10px' }}>
        <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
          <select value={month} onChange={e => setMonth(e.target.value)} style={{ padding:'9px 14px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'14px', color:D, outline:'none', fontWeight:'600', cursor:'pointer' }}>
            {monthOpts.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student..." style={{ padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'13px', outline:'none', width:'180px' }} />
        </div>
        <button onClick={() => { setEditPayment(null); setShowForm(true) }} style={{ padding:'9px 18px', borderRadius:'8px', border:'none', background:G, color:'white', fontSize:'13px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'700', cursor:'pointer' }}>+ Record payment</button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px', marginBottom:'22px' }}>
        {[
          { l:'Total Students', v:students.length, c:D, click:false },
          { l:'Paid', v:paidCount, c:G, click:false },
          { l:'Unpaid', v:unpaidCount, c:'#dc2626', click:true, border:'#fca5a5' },
          { l:'Collected', v:collected.toLocaleString()+' UZS', c:D, click:false },
        ].map((x,i) => (
          <div key={i} onClick={() => x.click && setShowUnpaid(!showUnpaid)}
            style={{ background:'white', borderRadius:'12px', padding:'18px', border:`1.5px solid ${x.click && unpaidCount > 0 ? x.border : '#e4e8e7'}`, cursor:x.click?'pointer':'default', transition:'all 0.15s' }}
            onMouseEnter={e => { if (x.click) e.currentTarget.style.boxShadow='0 4px 16px rgba(220,38,38,.12)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow='none' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>{x.l}</div>
            <div style={{ fontSize:'24px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:x.c }}>{x.v}</div>
            {x.click && unpaidCount > 0 && <div style={{ fontSize:'11px', color:'#dc2626', marginTop:'4px', fontWeight:'600' }}>Click to see →</div>}
          </div>
        ))}
      </div>

      {/* Unpaid panel */}
      {showUnpaid && (
        <div style={{ background:'white', borderRadius:'12px', border:'1.5px solid #fca5a5', padding:'20px', marginBottom:'20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
            <h3 style={{ fontSize:'15px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'700', color:D }}>
              {unpaidTeacher ? `Unpaid — ${unpaidTeacher.full_name}` : 'Unpaid Students by Teacher'}
            </h3>
            <div style={{ display:'flex', gap:'6px' }}>
              {unpaidTeacher && <button onClick={() => setUnpaidTeacher(null)} style={{ padding:'5px 12px', borderRadius:'6px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>← Back</button>}
              <button onClick={() => { setShowUnpaid(false); setUnpaidTeacher(null) }} style={{ padding:'5px 12px', borderRadius:'6px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>✕</button>
            </div>
          </div>
          {!unpaidTeacher ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {teachers.map(t => {
                const unpaid = students.filter(s => s.teacher_username===t.username && !paidSet.has(s.username))
                if (!unpaid.length) return null
                return (
                  <button key={t.username} onClick={() => setUnpaidTeacher(t)}
                    style={{ padding:'12px 16px', borderRadius:'8px', border:'1.5px solid #e4e8e7', background:'#f8fafb', textAlign:'left', cursor:'pointer', display:'flex', justifyContent:'space-between', alignItems:'center', transition:'all 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor=G}
                    onMouseLeave={e => e.currentTarget.style.borderColor='#e4e8e7'}>
                    <span style={{ fontSize:'14px', fontWeight:'600', color:D }}>{t.full_name}</span>
                    <span style={{ fontSize:'12px', fontWeight:'700', padding:'3px 10px', borderRadius:'20px', background:'#fef2f2', color:'#dc2626' }}>{unpaid.length} unpaid</span>
                  </button>
                )
              })}
              {teachers.every(t => !students.filter(s => s.teacher_username===t.username && !paidSet.has(s.username)).length) && (
                <div style={{ textAlign:'center', padding:'20px', color:'#94a3b8', fontSize:'13px' }}>🎉 All students paid!</div>
              )}
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'14px' }}>
              <thead><tr style={{ borderBottom:'1px solid #f0f2f1' }}>
                {['Name','Day & Time',''].map(h => <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {students.filter(s => s.teacher_username===unpaidTeacher.username && !paidSet.has(s.username)).map((s,i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #f0f2f1' }}>
                    <td style={{ padding:'10px 12px', fontWeight:'600', color:D }}>{s.full_name}</td>
                    <td style={{ padding:'10px 12px', color:'#64748b', fontSize:'13px' }}>{s.day==='odd'?'Mon/Wed/Fri':'Tue/Thu/Sat'} · {s.class_time}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <button onClick={() => {
                        setEditPayment(null)
                        setShowForm(true)
                        setShowUnpaid(false)
                        setUnpaidTeacher(null)
                      }} style={{ padding:'5px 14px', borderRadius:'6px', border:'none', background:G, color:'white', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>Record</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Payments table */}
      <div style={{ background:'white', borderRadius:'12px', border:'1.5px solid #e4e8e7', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'14px' }}>
          <thead>
            <tr style={{ background:'#f8fafb', borderBottom:'1.5px solid #e4e8e7' }}>
              {['Receipt #','Student','Amount','Method','Date & Time','Actions'].map(h => (
                <th key={h} style={{ padding:'11px 16px', textAlign:'left', fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listed.map((p,i) => (
              <tr key={i} style={{ borderBottom:i<listed.length-1?'1px solid #f0f2f1':'none' }}
                onMouseEnter={e => e.currentTarget.style.background='#f8fafb'}
                onMouseLeave={e => e.currentTarget.style.background='white'}>
                <td style={{ padding:'12px 16px', fontFamily:'monospace', fontSize:'12px', color:G, fontWeight:'700' }}>{p.cheque_number||'—'}</td>
                <td style={{ padding:'12px 16px', fontWeight:'600', color:D }}>{p.students?.full_name||p.student_username}</td>
                <td style={{ padding:'12px 16px', fontWeight:'700', color:G }}>{p.amount?.toLocaleString()} UZS</td>
                <td style={{ padding:'12px 16px', color:'#64748b', textTransform:'capitalize' }}>{p.method||'cash'}</td>
                <td style={{ padding:'12px 16px', color:'#64748b', fontSize:'13px' }}>
                  {p.payment_date||'—'}
                  {p.payment_time && <span style={{ color:'#94a3b8', marginLeft:'6px' }}>{p.payment_time}</span>}
                </td>
                <td style={{ padding:'12px 16px' }}>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button onClick={() => { setEditPayment(p); setShowForm(true) }} style={{ padding:'5px 12px', borderRadius:'6px', border:`1.5px solid ${G}`, background:`${G}10`, color:G, fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>Edit</button>
                    {p.cheque_number && (
                      <button onClick={() => downloadCheque(p, p.students?.full_name||p.student_username||'')}
                        style={{ padding:'5px 12px', borderRadius:'6px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>🧾</button>
                    )}
                    <button onClick={() => deletePayment(p.id)} style={{ padding:'5px 12px', borderRadius:'6px', border:'1.5px solid #fca5a5', background:'#fef2f2', color:'#dc2626', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>✕</button>
                  </div>
                </td>
              </tr>
            ))}
            {!listed.length && (
              <tr><td colSpan="6" style={{ padding:'40px', textAlign:'center', color:'#94a3b8' }}>No payments for {monthOpts.find(o=>o.val===month)?.label}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <PaymentForm
          teachers={teachers}
          students={students}
          payments={payments}
          month={month}
          editPayment={editPayment}
          onSave={() => { fetchAll(); setShowForm(false); setEditPayment(null) }}
          onClose={() => { setShowForm(false); setEditPayment(null) }}
        />
      )}
    </div>
  )
}