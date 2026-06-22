import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const G = '#009472'
const D = '#002b2a'

const LEVEL_COLORS = { 'Beginner':'#f5a623', 'Elementary':'#3b82f6', 'Pre-Intermediate':G, 'Intermediate':'#059669', 'Upper-Intermediate':'#8b5cf6', 'IELTS Foundation':'#0ea5e9', 'IELTS Proficiency':'#7c3aed' }
const PRICE_PER_LESSON = 60000
const DEFAULT_PASSWORD  = '12345678'

const REASONS = [
  { id:'teacher',     label:"Doesn't vibe with the teacher" },
  { id:'group',       label:"Doesn't vibe with the group" },
  { id:'knows_topic', label:"Already knows the topic" },
  { id:'other',       label:"Other (note required)" },
]
const REASON_LABEL = Object.fromEntries(REASONS.map(r => [r.id, r.label]))

const iStyle = { width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, fontFamily:"'DM Sans',sans-serif", marginBottom:'12px', boxSizing:'border-box', background:'white' }
const lStyle = { fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'5px' }

function fmt(n) { return Number(n||0).toLocaleString('fr-FR').replace(/\u202f/g,' ') }
function dayLabel(day) { return day === 'odd' ? 'Mon / Wed / Fri' : 'Tue / Thu / Sat' }
function initialsOf(name) { return (name||'?').split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() }

// ── USERNAME GENERATION ───────────────────────────────────────────────────────
// Boss rule: "Surname Name" with the first letter of each capitalised, space kept.
// e.g. full_name "Robiya Inoyatova" → "Inoyatova Robiya". Duplicates get " 2", " 3"…
function titleCase(s) {
  return (s||'').split(/\s+/).filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}
function baseUsername(fullName) {
  const parts = (fullName||'').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''
  const name    = parts[0]
  const surname = parts.length > 1 ? parts.slice(1).join(' ') : parts[0]
  return `${titleCase(surname)} ${titleCase(name)}`
}
async function uniqueUsername(base) {
  if (!base) return ''
  const { data } = await supabase.from('students').select('username').ilike('username', `${base}%`)
  const taken = new Set((data||[]).map(s => s.username))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}

// ── PRORATION ─────────────────────────────────────────────────────────────────
// Owed = (class days from first trial day → end of that month, skipping holidays)
// × 60,000. Class days follow the group's odd/even pattern.
function fmtDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function lastDayOfMonth(dateStr) { const d = new Date(dateStr+'T00:00:00'); return new Date(d.getFullYear(), d.getMonth()+1, 0) }
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
  const d = new Date(startStr+'T00:00:00')
  while (d <= endDate) {
    const ds = fmtDate(d)
    if (classDays.includes(d.getDay()) && !isHoliday(ds)) c++
    d.setDate(d.getDate() + 1)
  }
  return c
}
function lessonsOwed(student, holidays) {
  if (!student.enrolled_date) return 0
  const hols = relevantHolidays(student, holidays)
  return countClassDays(student.enrolled_date, lastDayOfMonth(student.enrolled_date), student.day, hols)
}

// ════════════════════════════════════════════════════════════════════════════
// MODALS
// ════════════════════════════════════════════════════════════════════════════

// Add a placement-test student into a group → creates a TRIAL student + account
function AddToGroupModal({ test, teachers, groups, onClose, onSaved }) {
  const [form,   setForm]   = useState({ teacher_username:'', day:'', class_time:'' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [created, setCreated] = useState(null)   // { username, password } to show after success

  const save = async () => {
    if (!form.teacher_username || !form.day || !form.class_time) { setError('Please fill all fields.'); return }
    setSaving(true); setError('')

    const base     = baseUsername(test.full_name)
    const username = await uniqueUsername(base)
    if (!username) { setError('Could not generate a username from this name.'); setSaving(false); return }

    const today = new Date().toISOString().slice(0,10)
    const { data: group } = await supabase.from('groups').select('id')
      .eq('teacher_username', form.teacher_username).eq('day', form.day).eq('class_time', form.class_time).maybeSingle()

    const { error: insErr } = await supabase.from('students').insert({
      username, password: DEFAULT_PASSWORD,
      full_name: test.full_name, phone: test.phone || null,
      teacher_username: form.teacher_username, day: form.day, class_time: form.class_time,
      group_id: group?.id || null,
      status: 'trial', is_trial: true,
      enrolled_date: today, trial_restarted_date: today, redirect_count: 0,
      coins: 0, gems: 0,
    })
    if (insErr) { setError(insErr.code==='23505' ? 'That username is already taken.' : insErr.message); setSaving(false); return }

    await supabase.from('placement_results').update({ status:'added', student_username:username }).eq('id', test.id)
    setCreated({ username, password: DEFAULT_PASSWORD })
    setSaving(false)
  }

  const teacherGroups = groups.filter(g => g.teacher_username === form.teacher_username && g.day === form.day)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target===e.currentTarget && (created ? onSaved() : onClose())}>
      <div style={{ background:'white', borderRadius:'16px', padding:'28px', width:'100%', maxWidth:'460px', boxShadow:'0 24px 64px rgba(0,0,0,0.18)', maxHeight:'90vh', overflowY:'auto' }}>
        {created ? (
          <>
            <h3 style={{ fontSize:'18px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'4px' }}>✓ Trial started</h3>
            <p style={{ fontSize:'13px', color:'#94a3b8', marginBottom:'18px' }}>Share these login details with {test.full_name}. They can change their password in the app.</p>
            <div style={{ background:`${G}08`, borderRadius:'10px', padding:'14px', border:`1px solid ${G}25`, marginBottom:'18px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                {[['Username',created.username],['Password',created.password]].map(([l,v]) => (
                  <div key={l}>
                    <div style={{ fontSize:'10px', color:'#94a3b8', fontWeight:'700', marginBottom:'3px' }}>{l}</div>
                    <div style={{ fontSize:'14px', fontWeight:'700', color:D, fontFamily:'monospace', background:'white', padding:'8px 10px', borderRadius:'6px', border:'1px solid #e4e8e7' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={onSaved} style={{ width:'100%', padding:'12px', borderRadius:'10px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Done</button>
          </>
        ) : (
          <>
            <h3 style={{ fontSize:'18px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'4px' }}>Add to a group</h3>
            <p style={{ fontSize:'13px', color:'#94a3b8', marginBottom:'8px' }}>
              <strong style={{ color:D }}>{test.full_name}</strong> · Level: <strong style={{ color:LEVEL_COLORS[test.level]||G }}>{test.level}</strong>
            </p>
            <div style={{ background:'#f8fafb', borderRadius:'10px', padding:'10px 14px', marginBottom:'16px', fontSize:'12px', color:'#64748b' }}>
              A trial account will be created automatically — username <strong>{baseUsername(test.full_name) || '—'}</strong>, password <strong>{DEFAULT_PASSWORD}</strong>.
            </div>

            <label style={lStyle}>Teacher</label>
            <select value={form.teacher_username} onChange={e => setForm(p=>({...p, teacher_username:e.target.value, day:'', class_time:''}))} style={iStyle}>
              <option value="">Select teacher…</option>
              {teachers.map(t => <option key={t.username} value={t.username}>{t.full_name}</option>)}
            </select>

            <label style={lStyle}>Day</label>
            <select value={form.day} onChange={e => setForm(p=>({...p, day:e.target.value, class_time:''}))} style={iStyle} disabled={!form.teacher_username}>
              <option value="">Select day…</option>
              <option value="odd">Odd (Mon · Wed · Fri)</option>
              <option value="even">Even (Tue · Thu · Sat)</option>
            </select>

            <label style={lStyle}>Class Time</label>
            <select value={form.class_time} onChange={e => setForm(p=>({...p, class_time:e.target.value}))} style={iStyle} disabled={!form.teacher_username || !form.day}>
              <option value="">{!form.teacher_username || !form.day ? 'Select teacher & day first…' : 'Select time…'}</option>
              {teacherGroups.sort((a,b)=>a.class_time.localeCompare(b.class_time)).map(g => (
                <option key={g.class_time} value={g.class_time}>{g.class_time} · {g.level}</option>
              ))}
            </select>

            {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginBottom:'12px' }}>{error}</div>}
            <div style={{ display:'flex', gap:'10px', marginTop:'6px' }}>
              <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'10px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ flex:2, padding:'12px', borderRadius:'10px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                {saving ? 'Creating…' : 'Start trial'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Redirect a trial student to a new group (restart trial) OR declare no-match.
// reason + note are logged to trial_feedback every time.
function RedirectModal({ student, teachers, groups, onClose, onDone }) {
  const willBeNoMatch = (student.redirect_count || 0) >= 4   // the 5th redirect ends the funnel
  const [form,   setForm]   = useState({ teacher_username:'', day:'', class_time:'' })
  const [reason, setReason] = useState('')
  const [note,   setNote]   = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const teacherName = u => teachers.find(t => t.username === u)?.full_name || u
  const teacherGroups = groups.filter(g => g.teacher_username === form.teacher_username && g.day === form.day &&
    !(g.teacher_username===student.teacher_username && g.day===student.day && g.class_time===student.class_time))

  const submit = async () => {
    if (!reason) { setError('Choose a reason.'); return }
    if (reason === 'other' && !note.trim()) { setError('A note is required for "Other".'); return }
    if (!willBeNoMatch && (!form.teacher_username || !form.day || !form.class_time)) { setError('Choose the new group.'); return }
    setSaving(true); setError('')

    const newCount = (student.redirect_count || 0) + 1
    const today    = new Date().toISOString().slice(0,10)

    let update, toTeacher
    if (willBeNoMatch) {
      update = { redirect_count:newCount, status:'no_match', is_trial:false }
      toTeacher = null
    } else {
      const { data: group } = await supabase.from('groups').select('id')
        .eq('teacher_username', form.teacher_username).eq('day', form.day).eq('class_time', form.class_time).maybeSingle()
      update = {
        teacher_username: form.teacher_username, day: form.day, class_time: form.class_time,
        group_id: group?.id || null,
        trial_restarted_date: today, redirect_count: newCount, status:'trial', is_trial:true,
      }
      toTeacher = form.teacher_username
    }

    const { error: upErr } = await supabase.from('students').update(update).eq('username', student.username)
    if (upErr) { setError(upErr.message); setSaving(false); return }

    await supabase.from('trial_feedback').insert({
      student_username: student.username, student_name: student.full_name,
      from_teacher: student.teacher_username, to_teacher: toTeacher,
      reason, note: note.trim() || null, redirect_no: newCount,
    })
    setSaving(false); onDone()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'16px', padding:'26px', width:'100%', maxWidth:'460px', boxShadow:'0 24px 64px rgba(0,0,0,0.18)', maxHeight:'90vh', overflowY:'auto' }}>
        <h3 style={{ fontSize:'18px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'4px' }}>
          {willBeNoMatch ? 'Declare “No match”' : 'Redirect trial student'}
        </h3>
        <p style={{ fontSize:'13px', color:'#94a3b8', marginBottom:'16px' }}>
          {student.full_name} · redirect {(student.redirect_count||0)+1} of 5
          {willBeNoMatch && ' — this is the 5th, so the student will be marked No match.'}
        </p>

        <label style={lStyle}>Reason</label>
        <div style={{ display:'flex', flexDirection:'column', gap:'7px', marginBottom:'12px' }}>
          {REASONS.map(r => (
            <button key={r.id} onClick={() => setReason(r.id)}
              style={{ textAlign:'left', padding:'10px 14px', borderRadius:'10px', border:`1.5px solid ${reason===r.id?G:'#e4e8e7'}`, background:reason===r.id?`${G}10`:'white', color:reason===r.id?G:D, fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
              {r.label}
            </button>
          ))}
        </div>

        {reason === 'other' && (
          <>
            <label style={lStyle}>Note (required)</label>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Explain the reason…" style={iStyle} />
          </>
        )}

        {!willBeNoMatch && (
          <>
            <label style={lStyle}>New Teacher</label>
            <select value={form.teacher_username} onChange={e => setForm(p=>({...p, teacher_username:e.target.value, day:'', class_time:''}))} style={iStyle}>
              <option value="">Select teacher…</option>
              {teachers.map(t => <option key={t.username} value={t.username}>{t.full_name}</option>)}
            </select>
            <label style={lStyle}>Day</label>
            <select value={form.day} onChange={e => setForm(p=>({...p, day:e.target.value, class_time:''}))} style={iStyle} disabled={!form.teacher_username}>
              <option value="">Select day…</option>
              <option value="odd">Odd (Mon · Wed · Fri)</option>
              <option value="even">Even (Tue · Thu · Sat)</option>
            </select>
            <label style={lStyle}>Class Time</label>
            <select value={form.class_time} onChange={e => setForm(p=>({...p, class_time:e.target.value}))} style={iStyle} disabled={!form.teacher_username || !form.day}>
              <option value="">{!form.teacher_username || !form.day ? 'Select teacher & day first…' : 'Select time…'}</option>
              {teacherGroups.sort((a,b)=>a.class_time.localeCompare(b.class_time)).map(g => (
                <option key={g.class_time} value={g.class_time}>{g.class_time} · {g.level}</option>
              ))}
            </select>
          </>
        )}

        {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginBottom:'12px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'10px', marginTop:'6px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'10px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={saving} style={{ flex:2, padding:'12px', borderRadius:'10px', border:'none', background:willBeNoMatch?'#ef4444':G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {saving ? 'Saving…' : willBeNoMatch ? 'Confirm No match' : 'Redirect & restart trial'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Make a contract — trial → real student, compute the month's dues.
function ContractModal({ student, holidays, onClose, onDone }) {
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const lessons = lessonsOwed(student, holidays)
  const owed    = lessons * PRICE_PER_LESSON

  const confirm = async () => {
    setSaving(true); setError('')
    const today = new Date().toISOString().slice(0,10)
    const { error: err } = await supabase.from('students')
      .update({ is_trial:false, status:'active', contract_date:today }).eq('username', student.username)
    if (err) { setError(err.message); setSaving(false); return }
    setSaving(false); onDone()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'16px', padding:'28px', width:'100%', maxWidth:'420px', boxShadow:'0 24px 64px rgba(0,0,0,0.18)' }}>
        <h3 style={{ fontSize:'18px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'4px' }}>Make a contract</h3>
        <p style={{ fontSize:'13px', color:'#94a3b8', marginBottom:'18px' }}>{student.full_name} becomes a full student. This month's dues are prorated from their first trial day.</p>

        <div style={{ background:'#f8fafb', borderRadius:'12px', padding:'16px', marginBottom:'18px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px', fontSize:'13px', color:'#64748b' }}>
            <span>First trial day</span><strong style={{ color:D }}>{student.enrolled_date || '—'}</strong>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px', fontSize:'13px', color:'#64748b' }}>
            <span>Lessons to month-end</span><strong style={{ color:D }}>{lessons} × {fmt(PRICE_PER_LESSON)}</strong>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', paddingTop:'8px', borderTop:'1px solid #e4e8e7', fontSize:'15px' }}>
            <span style={{ fontWeight:'700', color:D }}>Owed this month</span>
            <strong style={{ color:G, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{fmt(owed)} UZS</strong>
          </div>
        </div>

        {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginBottom:'12px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'10px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
          <button onClick={confirm} disabled={saving} style={{ flex:2, padding:'12px', borderRadius:'10px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {saving ? 'Saving…' : 'Confirm contract'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// CARDS
// ════════════════════════════════════════════════════════════════════════════

function PlacementCard({ test, teacherName, onAdd }) {
  const [open, setOpen] = useState(false)
  const color = LEVEL_COLORS[test.level] || '#64748b'
  const isAdded = test.status === 'added'
  const total = (test.grammar_score||0)+(test.reading_score||0)+(test.writing_score ?? test.ai_writing_grade ?? 0)
  return (
    <div style={{ background:'white', border:`1.5px solid ${isAdded?'#d1fae5':'#e4e8e7'}`, borderRadius:'14px', overflow:'hidden' }}>
      <div style={{ padding:'16px 18px', display:'flex', alignItems:'center', gap:'14px' }}>
        <div style={{ width:'46px', height:'46px', borderRadius:'12px', background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'15px', fontWeight:'800', color, fontFamily:"'Plus Jakarta Sans',sans-serif", flexShrink:0 }}>{initialsOf(test.full_name)}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px', flexWrap:'wrap' }}>
            <span style={{ fontSize:'15px', fontWeight:'700', color:D }}>{test.full_name}</span>
            <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 10px', borderRadius:'20px', background:`${color}18`, color }}>{test.level}</span>
            {isAdded && <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 8px', borderRadius:'4px', background:'#d1fae5', color:'#065f46' }}>✓ Added{teacherName?` · ${teacherName}`:''}</span>}
          </div>
          <div style={{ fontSize:'12px', color:'#94a3b8' }}>{test.phone || 'No phone'} · {test.created_at?.slice(0,10)} · Score: {total}/70</div>
        </div>
        <div style={{ display:'flex', gap:'6px', flexShrink:0, alignItems:'center' }}>
          <button onClick={() => setOpen(!open)} style={{ padding:'6px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>{open?'▲':'▼'} Details</button>
          {!isAdded && <button onClick={onAdd} style={{ padding:'6px 14px', borderRadius:'8px', border:'none', background:G, color:'white', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>+ Add to group</button>}
        </div>
      </div>
      {open && (
        <div style={{ borderTop:'1px solid #f0f2f1', padding:'16px 18px', background:'#f8fafb' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:test.writing_answer?'14px':0 }}>
            {[['Grammar', test.grammar_score, 50, D],['Reading', test.reading_score, 10, '#3b82f6'],['Writing', test.writing_score ?? test.ai_writing_grade, 10, '#8b5cf6']].map(([label,score,max,c]) => (
              <div key={label} style={{ background:'white', borderRadius:'10px', padding:'12px', textAlign:'center', border:'1px solid #f0f2f1' }}>
                <div style={{ fontSize:'20px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:c }}>{score??'—'}<span style={{ fontSize:'10px', color:'#94a3b8', fontWeight:'400' }}>/{max}</span></div>
                <div style={{ fontSize:'10px', color:'#94a3b8', fontWeight:'700', marginTop:'2px' }}>{label}</div>
              </div>
            ))}
          </div>
          {test.writing_answer && (
            <div>
              <div style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>Writing Submission</div>
              <div style={{ background:'white', borderRadius:'8px', padding:'12px', fontSize:'13px', color:D, lineHeight:1.7, maxHeight:'110px', overflowY:'auto', border:'1px solid #f0f2f1' }}>{test.writing_answer}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TrialCard({ student, present, absent, teacherName, onRedirect, onContract }) {
  const pct  = Math.min(present / 3, 1)
  const done = present >= 3
  const canContract = present >= 2
  const color = done ? G : present >= 2 ? '#f59e0b' : '#94a3b8'
  return (
    <div style={{ background:'white', border:`1.5px solid ${done?'#d1fae5':'#e4e8e7'}`, borderRadius:'14px', padding:'16px 18px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
        <div style={{ width:'46px', height:'46px', borderRadius:'12px', background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'15px', fontWeight:'800', color, fontFamily:"'Plus Jakarta Sans',sans-serif", flexShrink:0 }}>{initialsOf(student.full_name)}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px', flexWrap:'wrap' }}>
            <span style={{ fontSize:'15px', fontWeight:'700', color:D }}>{student.full_name}</span>
            <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 8px', borderRadius:'20px', background:'#fef3cd', color:'#92400e' }}>Trial</span>
            {(student.redirect_count||0) > 0 && <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 8px', borderRadius:'20px', background:'#ede9fe', color:'#6d28d9' }}>↻ {student.redirect_count}/5</span>}
            {canContract && <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 8px', borderRadius:'20px', background:'#d1fae5', color:'#065f46' }}>Ready for contract</span>}
          </div>
          <div style={{ fontSize:'12px', color:'#94a3b8', marginBottom:'8px' }}>{teacherName || student.teacher_username} · {dayLabel(student.day)} · {student.class_time} · @{student.username}</div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <div style={{ flex:1, height:'6px', background:'#f0f2f1', borderRadius:'6px', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${pct*100}%`, background:color, borderRadius:'6px', transition:'width 0.5s ease' }} />
            </div>
            <span style={{ fontSize:'13px', fontWeight:'800', color, minWidth:'28px' }}>{present}/3</span>
            <span style={{ fontSize:'11px', color:'#94a3b8' }}>present</span>
            {absent > 0 && <span style={{ fontSize:'11px', fontWeight:'700', color:'#ef4444' }}>· {absent} absent</span>}
          </div>
        </div>
      </div>
      <div style={{ display:'flex', gap:'8px', marginTop:'14px', justifyContent:'flex-end' }}>
        <button onClick={onRedirect} style={{ padding:'8px 14px', borderRadius:'9px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>↻ Redirect</button>
        <button onClick={onContract} disabled={!canContract}
          style={{ padding:'8px 16px', borderRadius:'9px', border:'none', background:canContract?G:'#e4e8e7', color:'white', fontSize:'12px', fontWeight:'700', cursor:canContract?'pointer':'default', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
          Make a contract
        </button>
      </div>
    </div>
  )
}

function ContractRow({ student, teacherName, owed, paid, onRecord }) {
  const remaining = Math.max(owed - paid, 0)
  const settled = paid >= owed && owed > 0
  return (
    <div style={{ background:'white', border:`1.5px solid ${settled?'#d1fae5':'#fde8e8'}`, borderRadius:'14px', padding:'16px 18px', display:'flex', alignItems:'center', gap:'14px' }}>
      <div style={{ width:'46px', height:'46px', borderRadius:'12px', background:`${G}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'15px', fontWeight:'800', color:G, fontFamily:"'Plus Jakarta Sans',sans-serif", flexShrink:0 }}>{initialsOf(student.full_name)}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'15px', fontWeight:'700', color:D, marginBottom:'2px' }}>{student.full_name}</div>
        <div style={{ fontSize:'12px', color:'#94a3b8' }}>{teacherName || student.teacher_username} · contract {student.contract_date || '—'}</div>
      </div>
      <div style={{ textAlign:'right', flexShrink:0 }}>
        <div style={{ fontSize:'15px', fontWeight:'800', color:settled?G:'#ef4444', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{settled ? 'Paid' : `${fmt(remaining)} left`}</div>
        <div style={{ fontSize:'11px', color:'#94a3b8' }}>{fmt(paid)} / {fmt(owed)} UZS</div>
      </div>
      {!settled && <button onClick={onRecord} style={{ padding:'8px 14px', borderRadius:'9px', border:`1.5px solid ${G}`, background:'white', color:G, fontSize:'12px', fontWeight:'700', cursor:'pointer', flexShrink:0 }}>Record payment</button>}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════
const SIDEBAR = [
  { id:'placement', label:'Placement Tests' },
  { id:'trial',     label:'Trial Students' },
  { id:'contracts', label:'Contracts' },
  { id:'nomatch',   label:'No Matches' },
  { id:'feedback',  label:'Feedback' },
]

export default function TestsSection({ onNavigate = null }) {
  const [tab,       setTab]       = useState('placement')
  const [loading,   setLoading]   = useState(true)
  const [tests,     setTests]     = useState([])
  const [teachers,  setTeachers]  = useState([])
  const [groups,    setGroups]    = useState([])
  const [students,  setStudents]  = useState([])
  const [progress,  setProgress]  = useState({})   // username → { present, absent }
  const [feedback,  setFeedback]  = useState([])
  const [holidays,  setHolidays]  = useState([])
  const [payments,  setPayments]  = useState([])
  const [fbTeacher, setFbTeacher] = useState('all')

  const [addTest,   setAddTest]   = useState(null)
  const [redirect,  setRedirect]  = useState(null)
  const [contract,  setContract]  = useState(null)

  useEffect(() => { fetchAll() }, [])

  const tName = u => teachers.find(t => t.username === u)?.full_name || u

  const fetchAll = async () => {
    setLoading(true)
    const now = new Date()
    const [{ data: ts }, { data: te }, { data: gr }, { data: stu }, { data: fb }, { data: hol }, { data: pay }] = await Promise.all([
      supabase.from('placement_results').select('*').order('created_at', { ascending:false }),
      supabase.from('teachers').select('username, full_name').neq('username','test').order('full_name'),
      supabase.from('groups').select('*'),
      supabase.from('students').select('*').neq('username','test'),
      supabase.from('trial_feedback').select('*').order('created_at', { ascending:false }),
      supabase.from('holidays').select('*'),
      supabase.from('payments').select('student_username, amount, payment_month, payment_year').eq('payment_month', now.getMonth()+1).eq('payment_year', now.getFullYear()),
    ])
    setTests(ts||[]); setTeachers(te||[]); setGroups(gr||[]); setStudents(stu||[])
    setFeedback(fb||[]); setHolidays(hol||[]); setPayments(pay||[])

    // Trial progress: present/absent since trial_restarted_date in the CURRENT group
    const trials = (stu||[]).filter(s => s.is_trial && s.status === 'trial')
    if (trials.length) {
      const { data: lessons } = await supabase.from('lessons').select('id, teacher_username, day, class_time, lesson_date')
      const lmap = {}; (lessons||[]).forEach(l => { lmap[l.id] = l })
      const { data: att } = await supabase.from('attendance')
        .select('lesson_id, student_username, status')
        .in('student_username', trials.map(s => s.username))
      const prog = {}
      trials.forEach(s => {
        const anchor = s.trial_restarted_date || s.enrolled_date || '1970-01-01'
        let present = 0, absent = 0
        ;(att||[]).forEach(a => {
          if (a.student_username !== s.username) return
          const l = lmap[a.lesson_id]
          if (!l) return
          if (l.teacher_username===s.teacher_username && l.day===s.day && l.class_time===s.class_time && l.lesson_date >= anchor) {
            if (a.status === 'present') present++
            else if (a.status === 'absent') absent++
          }
        })
        prog[s.username] = { present, absent }
      })
      setProgress(prog)
    } else setProgress({})
    setLoading(false)
  }

  const paidByStudent = {}
  payments.forEach(p => { paidByStudent[p.student_username] = (paidByStudent[p.student_username]||0) + Number(p.amount||0) })

  const trialStudents = students.filter(s => s.is_trial && s.status === 'trial')
  const contractStudents = students.filter(s => s.contract_date && s.status === 'active')
  const noMatchStudents  = students.filter(s => s.status === 'no_match')
  const pendingTests     = tests.filter(t => t.status !== 'added')

  const counts = {
    placement: pendingTests.length,
    trial:     trialStudents.length,
    contracts: contractStudents.length,
    nomatch:   noMatchStudents.length,
    feedback:  feedback.length,
  }

  const Empty = ({ icon, title, sub }) => (
    <div style={{ textAlign:'center', padding:'60px', background:'white', borderRadius:'14px', border:'1.5px solid #e4e8e7' }}>
      <div style={{ fontSize:'42px', marginBottom:'12px' }}>{icon}</div>
      <div style={{ fontSize:'16px', fontWeight:'700', color:D, marginBottom:'6px', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{title}</div>
      <div style={{ fontSize:'13px', color:'#94a3b8' }}>{sub}</div>
    </div>
  )

  return (
    <div style={{ display:'flex', gap:'24px', fontFamily:"'DM Sans',sans-serif", alignItems:'flex-start' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');select{-webkit-appearance:none;-moz-appearance:none}`}</style>

      {/* Sub-sidebar */}
      <div style={{ width:'200px', flexShrink:0, background:'white', borderRadius:'14px', border:'1.5px solid #f0f2f1', padding:'8px', position:'sticky', top:'24px' }}>
        {SIDEBAR.map(s => {
          const active = tab === s.id
          return (
            <button key={s.id} onClick={() => setTab(s.id)}
              style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 13px', borderRadius:'9px', border:'none', background:active?`${G}12`:'transparent', color:active?G:'#64748b', fontSize:'13px', fontWeight:active?'700':'500', cursor:'pointer', marginBottom:'2px', textAlign:'left', fontFamily:"'DM Sans',sans-serif" }}>
              {s.label}
              <span style={{ fontSize:'11px', fontFamily:'monospace', background:active?`${G}20`:'#f0f2f1', color:active?G:'#94a3b8', padding:'1px 7px', borderRadius:'20px' }}>{counts[s.id]}</span>
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={{ flex:1, minWidth:0 }}>
        {loading ? <div style={{ textAlign:'center', padding:'80px', color:'#94a3b8' }}>Loading…</div> : (
          <>
            {tab === 'placement' && (
              pendingTests.length === 0
                ? <Empty icon="📝" title="No pending placement tests" sub="New test results from the staff app appear here." />
                : <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    {pendingTests.map(t => <PlacementCard key={t.id} test={t} teacherName={null} onAdd={() => setAddTest(t)} />)}
                  </div>
            )}

            {tab === 'trial' && (
              trialStudents.length === 0
                ? <Empty icon="🎓" title="No trial students" sub="Students added from a placement test appear here for their first 3 lessons." />
                : <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#92400e', fontWeight:'600' }}>
                      💡 After 2 present lessons you can make a contract. Redirecting restarts the trial and logs feedback. The 5th redirect marks the student “No match.”
                    </div>
                    {trialStudents.map(s => {
                      const p = progress[s.username] || { present:0, absent:0 }
                      return <TrialCard key={s.username} student={s} present={p.present} absent={p.absent} teacherName={tName(s.teacher_username)}
                        onRedirect={() => setRedirect(s)} onContract={() => setContract(s)} />
                    })}
                  </div>
            )}

            {tab === 'contracts' && (
              contractStudents.length === 0
                ? <Empty icon="📄" title="No contracts yet" sub="Students with a signed contract appear here with their monthly dues." />
                : <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    {contractStudents.map(s => {
                      const owed = lessonsOwed(s, holidays) * PRICE_PER_LESSON
                      const paid = paidByStudent[s.username] || 0
                      return <ContractRow key={s.username} student={s} teacherName={tName(s.teacher_username)} owed={owed} paid={paid}
                        onRecord={() => onNavigate ? onNavigate('payments') : alert('Open the Payments section to record this payment.')} />
                    })}
                  </div>
            )}

            {tab === 'nomatch' && (
              noMatchStudents.length === 0
                ? <Empty icon="🔍" title="No “No match” students" sub="Students who used all 5 redirects without a match appear here." />
                : <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    {noMatchStudents.map(s => (
                      <div key={s.username} style={{ background:'white', border:'1.5px solid #e4e8e7', borderRadius:'14px', padding:'16px 18px', display:'flex', alignItems:'center', gap:'14px' }}>
                        <div style={{ width:'46px', height:'46px', borderRadius:'12px', background:'#f0f2f1', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'15px', fontWeight:'800', color:'#64748b', fontFamily:"'Plus Jakarta Sans',sans-serif", flexShrink:0 }}>{initialsOf(s.full_name)}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:'15px', fontWeight:'700', color:D, marginBottom:'2px' }}>{s.full_name}</div>
                          <div style={{ fontSize:'12px', color:'#94a3b8' }}>5 redirects · last teacher {tName(s.teacher_username)}</div>
                        </div>
                        <span style={{ fontSize:'11px', fontWeight:'700', padding:'3px 10px', borderRadius:'20px', background:'#fef2f2', color:'#ef4444', flexShrink:0 }}>No match</span>
                      </div>
                    ))}
                  </div>
            )}

            {tab === 'feedback' && (
              <>
                <div style={{ display:'flex', gap:'8px', marginBottom:'14px', flexWrap:'wrap' }}>
                  <button onClick={() => setFbTeacher('all')} style={{ padding:'6px 14px', borderRadius:'20px', border:`1.5px solid ${fbTeacher==='all'?G:'#e4e8e7'}`, background:fbTeacher==='all'?`${G}12`:'white', color:fbTeacher==='all'?G:'#64748b', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>All teachers</button>
                  {teachers.map(t => (
                    <button key={t.username} onClick={() => setFbTeacher(t.username)} style={{ padding:'6px 14px', borderRadius:'20px', border:`1.5px solid ${fbTeacher===t.username?G:'#e4e8e7'}`, background:fbTeacher===t.username?`${G}12`:'white', color:fbTeacher===t.username?G:'#64748b', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>{t.full_name}</button>
                  ))}
                </div>
                {(() => {
                  const rows = feedback.filter(f => fbTeacher==='all' || f.from_teacher===fbTeacher || f.to_teacher===fbTeacher)
                  if (rows.length === 0) return <Empty icon="💬" title="No feedback yet" sub="Reasons captured during redirects appear here." />
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                      {rows.map(f => (
                        <div key={f.id} style={{ background:'white', border:'1.5px solid #f0f2f1', borderRadius:'12px', padding:'14px 16px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px', flexWrap:'wrap', gap:'6px' }}>
                            <span style={{ fontSize:'14px', fontWeight:'700', color:D }}>{f.student_name || f.student_username}</span>
                            <span style={{ fontSize:'11px', color:'#94a3b8' }}>{f.created_at?.slice(0,10)} · redirect {f.redirect_no || '—'}</span>
                          </div>
                          <div style={{ fontSize:'12px', color:'#64748b', marginBottom:f.note?'6px':0 }}>
                            <span style={{ fontWeight:'700', color:'#92400e' }}>{REASON_LABEL[f.reason] || f.reason}</span>
                            {' · '}{tName(f.from_teacher)} {f.to_teacher ? `→ ${tName(f.to_teacher)}` : '→ No match'}
                          </div>
                          {f.note && <div style={{ fontSize:'13px', color:D, background:'#f8fafb', borderRadius:'8px', padding:'8px 12px' }}>{f.note}</div>}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </>
            )}
          </>
        )}
      </div>

      {addTest  && <AddToGroupModal test={addTest} teachers={teachers} groups={groups} onClose={() => setAddTest(null)} onSaved={() => { setAddTest(null); fetchAll() }} />}
      {redirect && <RedirectModal student={redirect} teachers={teachers} groups={groups} onClose={() => setRedirect(null)} onDone={() => { setRedirect(null); fetchAll() }} />}
      {contract && <ContractModal student={contract} holidays={holidays} onClose={() => setContract(null)} onDone={() => { setContract(null); fetchAll() }} />}
    </div>
  )
}