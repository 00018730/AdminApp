import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { logEdit } from './editLog'

const G = '#009472'
const D = '#002b2a'
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CATEGORIES = ['Rent','Utilities','Supplies','Marketing','Maintenance','Taxes','Other']

function fmt(n) { return Number(n || 0).toLocaleString('fr-FR').replace(/\u202f/g,' ') }

const inp = { width:'100%', padding:'10px 12px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', color:D, outline:'none', boxSizing:'border-box', fontFamily:"'DM Sans',sans-serif", background:'white' }
const lbl = { fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px', marginTop:'12px' }

// ── Expense add/edit modal ───────────────────────────────────────────────────
function ExpenseModal({ expense, month, year, onClose, onSaved }) {
  const isEdit = !!expense
  const [title,    setTitle]    = useState(expense?.title || '')
  const [amount,   setAmount]   = useState(isEdit ? String(expense.amount) : '')
  const [category, setCategory] = useState(expense?.category || 'Other')
  const [date,     setDate]     = useState(expense?.expense_date || `${year}-${String(month).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`)
  const [notes,    setNotes]    = useState(expense?.notes || '')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const save = async () => {
    const amt = parseFloat(amount)
    if (!title.trim()) { setError('Enter a title.'); return }
    if (!amount || isNaN(amt) || amt <= 0) { setError('Enter a valid amount.'); return }
    if (!date) { setError('Pick a date.'); return }
    setSaving(true); setError('')
    const [yy, mm] = date.split('-').map(Number)
    const sess = (() => { try { return JSON.parse(localStorage.getItem('slc_session')||'null') } catch { return null } })()
    const payload = { title: title.trim(), amount: amt, category, expense_date: date, month: mm, year: yy, notes: notes.trim() || null, created_by: sess?.username || null }
    const { error: err } = isEdit
      ? await supabase.from('expenses').update(payload).eq('id', expense.id)
      : await supabase.from('expenses').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    logEdit({ action: isEdit ? 'update' : 'create', target_table:'expenses', target_id: expense?.id, summary:`${isEdit?'Edited':'Added'} expense "${title.trim()}" — ${fmt(amt)} UZS` })
    onSaved()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'18px', padding:'26px', width:'100%', maxWidth:'420px', boxShadow:'0 24px 64px rgba(0,0,0,0.18)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
          <span style={{ fontSize:'17px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{isEdit ? 'Edit Expense' : 'Add Expense'}</span>
          <button onClick={onClose} style={{ width:'30px', height:'30px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'16px' }}>✕</button>
        </div>

        <label style={lbl}>Title</label>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Office rent" style={inp} />

        <label style={lbl}>Amount (UZS)</label>
        <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0" min="0" style={inp} />

        <label style={lbl}>Category</label>
        <select value={category} onChange={e=>setCategory(e.target.value)} style={{ ...inp, appearance:'none' }}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <label style={lbl}>Date</label>
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inp} />

        <label style={lbl}>Notes (optional)</label>
        <input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Any details…" style={inp} />

        {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginTop:'10px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'10px', marginTop:'18px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'10px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
          <button onClick={save} disabled={saving} style={{ flex:2, padding:'12px', borderRadius:'10px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {saving ? 'Saving…' : (isEdit ? 'Save changes' : 'Add expense')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FinanceSection({ role }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year,  setYear]  = useState(now.getFullYear())
  const [payments, setPayments] = useState([])
  const [teachers, setTeachers] = useState([])
  const [expenses, setExpenses] = useState([])
  const [pctDraft, setPctDraft] = useState({})   // username → editing value
  const [loading,  setLoading]  = useState(true)
  const [showExpense, setShowExpense] = useState(null)  // 'new' | expense
  const [savingPct, setSavingPct] = useState(null)

  useEffect(() => { fetchAll() }, [month, year])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: pays }, { data: tchs }, { data: exps }] = await Promise.all([
      supabase.from('payments').select('teacher_username,amount').eq('payment_month', month).eq('payment_year', year),
      supabase.from('teachers').select('username,full_name,salary_percent').neq('username','test').order('full_name'),
      supabase.from('expenses').select('*').eq('month', month).eq('year', year).order('expense_date', { ascending:false }),
    ])
    setPayments(pays || []); setTeachers(tchs || []); setExpenses(exps || [])
    const draft = {}; (tchs || []).forEach(t => { draft[t.username] = t.salary_percent ?? '' })
    setPctDraft(draft)
    setLoading(false)
  }

  const savePct = async (t) => {
    const raw = pctDraft[t.username]
    const val = raw === '' ? null : Number(raw)
    if (val === (t.salary_percent ?? null)) return
    if (val != null && (isNaN(val) || val < 0 || val > 100)) return
    setSavingPct(t.username)
    await supabase.from('teachers').update({ salary_percent: val }).eq('username', t.username)
    logEdit({ action:'update', target_table:'teachers', target_id:t.username, summary:`Set ${t.full_name} salary % to ${val ?? 0}%` })
    setTeachers(prev => prev.map(x => x.username === t.username ? { ...x, salary_percent: val } : x))
    setSavingPct(null)
  }

  const delExpense = async (exp) => {
    if (!confirm(`Delete expense "${exp.title}"?`)) return
    await supabase.from('expenses').delete().eq('id', exp.id)
    logEdit({ action:'delete', target_table:'expenses', target_id:exp.id, summary:`Deleted expense "${exp.title}" — ${fmt(exp.amount)} UZS` })
    fetchAll()
  }

  // ── computations ──
  const income = payments.reduce((a, p) => a + Number(p.amount || 0), 0)
  const paidByTeacher = {}
  payments.forEach(p => { if (p.teacher_username) paidByTeacher[p.teacher_username] = (paidByTeacher[p.teacher_username] || 0) + Number(p.amount || 0) })
  const teacherRows = teachers.map(t => {
    const collected = paidByTeacher[t.username] || 0
    const pct = Number(t.salary_percent || 0)
    return { ...t, collected, pct, salary: Math.round(collected * pct / 100) }
  })
  const totalSalaries = teacherRows.reduce((a, r) => a + r.salary, 0)
  const totalExpenses = expenses.reduce((a, e) => a + Number(e.amount || 0), 0)
  const grossBalance  = income - totalExpenses
  const netBalance    = income - totalExpenses - totalSalaries

  const monthOptions = []
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthOptions.push({ label:`${MONTHS[d.getMonth()]} ${d.getFullYear()}`, month:d.getMonth()+1, year:d.getFullYear() })
  }

  const th = { padding:'11px 14px', textAlign:'left', fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }
  const td = { padding:'12px 14px', fontSize:'13px', color:D }

  const Card = ({ label, value, color, sub }) => (
    <div style={{ background:'white', borderRadius:'14px', padding:'16px 18px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', flex:1, minWidth:'150px' }}>
      <div style={{ fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'8px' }}>{label}</div>
      <div style={{ fontSize:'20px', fontWeight:'800', color:color||D, fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1.15 }}>{loading?'…':`${fmt(value)}`}</div>
      {sub && <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'3px' }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`select{-webkit-appearance:none;-moz-appearance:none}`}</style>

      {/* Month selector */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
        <select value={`${month}-${year}`} onChange={e => { const [m,y]=e.target.value.split('-'); setMonth(Number(m)); setYear(Number(y)) }}
          style={{ padding:'9px 32px 9px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', fontWeight:'700', color:D, background:'white', cursor:'pointer', outline:'none' }}>
          {monthOptions.map(o => <option key={`${o.month}-${o.year}`} value={`${o.month}-${o.year}`}>{o.label}</option>)}
        </select>
      </div>

      {/* Summary cards */}
      <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', marginBottom:'14px' }}>
        <Card label="Income"   value={income}        color={G} sub="payments collected" />
        <Card label="Salaries" value={totalSalaries} color="#8b5cf6" sub="teacher cut" />
        <Card label="Expenses" value={totalExpenses} color="#ef4444" sub={`${expenses.length} item${expenses.length!==1?'s':''}`} />
      </div>
      <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', marginBottom:'28px' }}>
        <Card label="Gross balance" value={grossBalance} color={grossBalance>=0?D:'#ef4444'} sub="income − expenses" />
        <Card label="Net balance"   value={netBalance}   color={netBalance>=0?G:'#ef4444'}  sub="income − expenses − salaries" />
      </div>

      {/* Teacher salaries */}
      <div style={{ fontSize:'15px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif", marginBottom:'12px' }}>Teacher salaries</div>
      <div style={{ background:'white', borderRadius:'14px', border:'1.5px solid #e4e8e7', overflow:'hidden', marginBottom:'28px' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'620px' }}>
            <thead><tr style={{ background:'#f8fafb', borderBottom:'1.5px solid #e4e8e7' }}>
              <th style={th}>Teacher</th><th style={th}>Students paid</th><th style={th}>Salary %</th><th style={th}>Salary</th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ padding:'40px', textAlign:'center', color:'#94a3b8' }}>Loading…</td></tr>
              ) : teacherRows.length === 0 ? (
                <tr><td colSpan={4} style={{ padding:'40px', textAlign:'center', color:'#94a3b8' }}>No teachers.</td></tr>
              ) : teacherRows.map((t, i) => (
                <tr key={t.username} style={{ borderBottom:i<teacherRows.length-1?'1px solid #f0f2f1':'none' }}>
                  <td style={{ ...td, fontWeight:'700' }}>{t.full_name}</td>
                  <td style={td}>{fmt(t.collected)} UZS</td>
                  <td style={td}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <input type="number" min="0" max="100" value={pctDraft[t.username] ?? ''} onChange={e => setPctDraft(d => ({ ...d, [t.username]: e.target.value }))}
                        onBlur={() => savePct(t)} onKeyDown={e => e.key==='Enter' && e.currentTarget.blur()}
                        placeholder="0" style={{ width:'64px', padding:'6px 8px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'13px', color:D, outline:'none', textAlign:'center' }} />
                      <span style={{ color:'#94a3b8', fontSize:'13px' }}>%</span>
                      {savingPct===t.username && <span style={{ fontSize:'11px', color:'#94a3b8' }}>saving…</span>}
                    </div>
                  </td>
                  <td style={{ ...td, fontWeight:'800', color:'#8b5cf6', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{fmt(t.salary)} UZS</td>
                </tr>
              ))}
              {!loading && teacherRows.length > 0 && (
                <tr style={{ background:'#f8fafb', borderTop:'2px solid #e4e8e7' }}>
                  <td style={{ ...td, fontWeight:'800' }}>Total</td><td style={td}></td><td style={td}></td>
                  <td style={{ ...td, fontWeight:'800', color:'#8b5cf6', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{fmt(totalSalaries)} UZS</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expenses */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
        <div style={{ fontSize:'15px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Expenses</div>
        <button onClick={() => setShowExpense('new')} style={{ padding:'8px 16px', borderRadius:'9px', border:'none', background:G, color:'white', fontSize:'13px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>+ Add expense</button>
      </div>
      <div style={{ background:'white', borderRadius:'14px', border:'1.5px solid #e4e8e7', overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'620px' }}>
            <thead><tr style={{ background:'#f8fafb', borderBottom:'1.5px solid #e4e8e7' }}>
              <th style={th}>Title</th><th style={th}>Category</th><th style={th}>Date</th><th style={th}>Amount</th><th style={th}></th>
            </tr></thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding:'40px', textAlign:'center', color:'#94a3b8' }}>Loading…</td></tr>
              ) : expenses.length === 0 ? (
                <tr><td colSpan={5} style={{ padding:'40px', textAlign:'center', color:'#94a3b8' }}>No expenses for {MONTHS[month-1]} {year}.</td></tr>
              ) : expenses.map((e, i) => (
                <tr key={e.id} style={{ borderBottom:i<expenses.length-1?'1px solid #f0f2f1':'none' }}>
                  <td style={{ ...td, fontWeight:'700' }}>{e.title}{e.notes && <div style={{ fontSize:'11px', color:'#94a3b8', fontWeight:'400' }}>{e.notes}</div>}</td>
                  <td style={td}><span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 9px', borderRadius:'20px', background:'#f0f2f1', color:'#64748b' }}>{e.category || '—'}</span></td>
                  <td style={{ ...td, color:'#64748b' }}>{e.expense_date}</td>
                  <td style={{ ...td, fontWeight:'800', color:'#ef4444', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{fmt(e.amount)} UZS</td>
                  <td style={td}>
                    <div style={{ display:'flex', gap:'6px' }}>
                      <button onClick={() => setShowExpense(e)} style={{ padding:'5px 11px', borderRadius:'7px', border:'1.5px solid #e4e8e7', background:'white', color:D, fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>Edit</button>
                      <button onClick={() => delExpense(e)} style={{ width:'28px', borderRadius:'7px', border:'1.5px solid #fca5a5', background:'#fef2f2', color:'#dc2626', fontSize:'15px', fontWeight:'800', cursor:'pointer' }}>×</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && expenses.length > 0 && (
                <tr style={{ background:'#f8fafb', borderTop:'2px solid #e4e8e7' }}>
                  <td style={{ ...td, fontWeight:'800' }}>Total</td><td style={td}></td><td style={td}></td>
                  <td style={{ ...td, fontWeight:'800', color:'#ef4444', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{fmt(totalExpenses)} UZS</td><td style={td}></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showExpense && (
        <ExpenseModal
          expense={showExpense === 'new' ? null : showExpense}
          month={month} year={year}
          onClose={() => setShowExpense(null)}
          onSaved={() => { setShowExpense(null); fetchAll() }}
        />
      )}
    </div>
  )
}