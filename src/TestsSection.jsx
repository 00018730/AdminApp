import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const G = '#009472'
const D = '#002b2a'
const TIMES = ['9:30','14:30','16:30','18:30']

const iStyle = { width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, fontFamily:"'DM Sans',sans-serif", marginBottom:'12px', boxSizing:'border-box', background:'white' }
const lStyle = { fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'5px' }

const LEVEL_COLORS = { 'Beginner':'#f5a623', 'Elementary':'#3b82f6', 'Pre-Intermediate':G, 'Intermediate':'#059669', 'Upper-Intermediate':'#8b5cf6' }

function TestCard({ test, onAdd, onDelete }) {
  const [open, setOpen] = useState(false)
  const color = LEVEL_COLORS[test.level] || '#64748b'
  const isAdded = test.status === 'added'
  const total = (test.grammar_score||0)+(test.reading_score||0)+(test.writing_score||test.ai_writing_grade||0)

  return (
    <div style={{ background:'white', border:`1.5px solid ${isAdded ? '#d1fae5' : '#e4e8e7'}`, borderRadius:'14px', overflow:'hidden', transition:'all 0.2s' }}>
      <div style={{ padding:'16px 18px', display:'flex', alignItems:'center', gap:'14px' }}>
        {/* Avatar */}
        <div style={{ width:'46px', height:'46px', borderRadius:'12px', background:`${color}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'15px', fontWeight:'800', color, fontFamily:"'Plus Jakarta Sans',sans-serif", flexShrink:0 }}>
          {test.full_name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px', flexWrap:'wrap' }}>
            <span style={{ fontSize:'15px', fontWeight:'700', color:D }}>{test.full_name}</span>
            <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 10px', borderRadius:'20px', background:`${color}18`, color }}>{test.level}</span>
            {isAdded && <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 8px', borderRadius:'4px', background:'#d1fae5', color:'#065f46' }}>✓ Added to class</span>}
          </div>
          <div style={{ fontSize:'12px', color:'#94a3b8' }}>
            {test.phone} · {test.created_at?.slice(0,10)} · Score: {total}/70
          </div>
        </div>
        <div style={{ display:'flex', gap:'6px', flexShrink:0, alignItems:'center' }}>
          <button onClick={() => setOpen(!open)} style={{ padding:'6px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'12px', fontWeight:'600', cursor:'pointer' }}>
            {open ? '▲' : '▼'} Details
          </button>
          {!isAdded && (
            <button onClick={onAdd} style={{ padding:'6px 14px', borderRadius:'8px', border:'none', background:G, color:'white', fontSize:'12px', fontWeight:'700', cursor:'pointer' }}>
              + Add to class
            </button>
          )}
          <button onClick={onDelete} style={{ padding:'6px 10px', borderRadius:'8px', border:'1.5px solid #fca5a5', background:'#fef2f2', color:'#dc2626', fontSize:'14px', cursor:'pointer' }}>🗑</button>
        </div>
      </div>

      {open && (
        <div style={{ borderTop:'1px solid #f0f2f1', padding:'16px 18px', background:'#f8fafb' }}>
          {/* Score bars */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', marginBottom:'14px' }}>
            {[['Grammar', test.grammar_score, 50, D],['Reading', test.reading_score, 10, '#3b82f6'],['Writing', test.writing_score??test.ai_writing_grade, 10, '#8b5cf6']].map(([label,score,max,c]) => (
              <div key={label} style={{ background:'white', borderRadius:'10px', padding:'12px', textAlign:'center', border:'1px solid #f0f2f1' }}>
                <div style={{ fontSize:'20px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:c }}>{score??'—'}<span style={{ fontSize:'10px', color:'#94a3b8', fontWeight:'400' }}>/{max}</span></div>
                <div style={{ fontSize:'10px', color:'#94a3b8', fontWeight:'700', marginTop:'2px' }}>{label}</div>
                <div style={{ height:'4px', background:'#f0f2f1', borderRadius:'4px', marginTop:'6px', overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${((score||0)/max)*100}%`, background:c, borderRadius:'4px' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Writing answer */}
          {(test.writing_answer) && (
            <div style={{ marginBottom:'10px' }}>
              <div style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>Writing Submission</div>
              <div style={{ background:'white', borderRadius:'8px', padding:'12px', fontSize:'13px', color:D, lineHeight:'1.7', maxHeight:'110px', overflowY:'auto', border:'1px solid #f0f2f1' }}>{test.writing_answer}</div>
            </div>
          )}

          {/* Credentials */}
          {test.student_username && (
            <div style={{ background:`${G}08`, borderRadius:'10px', padding:'12px 14px', border:`1px solid ${G}25` }}>
              <div style={{ fontSize:'10px', fontWeight:'700', color:G, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>🔑 Student Login Credentials</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                {[['Username',test.student_username],['Password',test.student_password]].map(([l,v]) => (
                  <div key={l}>
                    <div style={{ fontSize:'10px', color:'#94a3b8', fontWeight:'600', marginBottom:'3px' }}>{l}</div>
                    <div style={{ fontSize:'14px', fontWeight:'700', color:D, fontFamily:'monospace', background:'white', padding:'7px 10px', borderRadius:'6px', border:'1px solid #e4e8e7', letterSpacing:'0.03em' }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TestsSection() {
  const [tests, setTests]       = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading]   = useState(true)
  const [addingTo, setAddingTo] = useState(null)
  const [form, setForm]         = useState({ teacher_username:'', day:'', class_time:'' })
  const [saving, setSaving]     = useState(false)
  const [filter, setFilter]     = useState('all')

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data:ts }, { data:te }] = await Promise.all([
      supabase.from('placement_results').select('*').order('created_at',{ascending:false}),
      supabase.from('teachers').select('*').order('full_name'),
    ])
    if (ts) setTests(ts)
    if (te) setTeachers(te)
    setLoading(false)
  }

  const deleteTest = async (id) => {
    if (!confirm('Delete this test result?')) return
    await supabase.from('placement_results').delete().eq('id', id)
    fetchAll()
  }

  const addStudent = async () => {
    if (!form.teacher_username || !form.day || !form.class_time) { alert('Please fill all fields'); return }
    setSaving(true)
    const test = addingTo
    const base = test.full_name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'')
    const username = base + '_' + Date.now().toString().slice(-4)
    const password = Math.random().toString(36).slice(-6)

    const { error } = await supabase.from('students').insert({
      username, password, full_name:test.full_name, phone:test.phone,
      teacher_username:form.teacher_username, day:form.day, class_time:form.class_time,
      status:'active', enrolled_date:new Date().toISOString().slice(0,10),
    })
    if (error) { alert('Error: '+error.message); setSaving(false); return }

    // Link to group if exists
    const { data:group } = await supabase.from('groups').select('id').eq('teacher_username',form.teacher_username).eq('day',form.day).eq('class_time',form.class_time).single()
    if (group) await supabase.from('students').update({ group_id:group.id }).eq('username',username)

    // Save credentials
    await supabase.from('placement_results').update({ status:'added', student_username:username, student_password:password }).eq('id',test.id)

    await fetchAll()
    setAddingTo(null); setForm({ teacher_username:'', day:'', class_time:'' }); setSaving(false)
  }

  const filtered = tests.filter(t => {
    if (filter === 'pending') return t.status !== 'added'
    if (filter === 'added') return t.status === 'added'
    return true
  })

  const pendingCount = tests.filter(t => t.status !== 'added').length
  const addedCount   = tests.filter(t => t.status === 'added').length

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'#94a3b8', fontSize:'14px' }}>Loading...</div>

  return (
    <div>
      {/* Filter bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', flexWrap:'wrap', gap:'10px' }}>
        <div style={{ display:'flex', gap:'6px' }}>
          {[['all','All',tests.length,'#e4e8e7',D],['pending','Pending',pendingCount,'#fca5a5','#dc2626'],['added','Added',addedCount,'#6ee7b7','#065f46']].map(([val,label,count,border,textColor]) => (
            <button key={val} onClick={() => setFilter(val)}
              style={{ padding:'6px 16px', borderRadius:'20px', border:`1.5px solid ${filter===val?border:'#e4e8e7'}`, background:filter===val?`${border}30`:'white', color:filter===val?textColor:'#64748b', fontSize:'12px', fontWeight:'700', cursor:'pointer', transition:'all 0.15s' }}>
              {label} <span style={{ fontFamily:'monospace', fontSize:'11px' }}>({count})</span>
            </button>
          ))}
        </div>
        <div style={{ fontSize:'13px', color:'#94a3b8' }}>{pendingCount} awaiting placement</div>
      </div>

      {/* List */}
      {!filtered.length ? (
        <div style={{ textAlign:'center', padding:'60px', background:'white', borderRadius:'14px', border:'1.5px solid #e4e8e7' }}>
          <div style={{ fontSize:'48px', marginBottom:'12px' }}>📝</div>
          <div style={{ fontSize:'16px', fontWeight:'700', color:D, marginBottom:'6px' }}>No tests yet</div>
          <div style={{ fontSize:'13px', color:'#94a3b8' }}>Placement test results will appear here</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
          {filtered.map(t => (
            <TestCard key={t.id} test={t} onAdd={() => setAddingTo(t)} onDelete={() => deleteTest(t.id)} />
          ))}
        </div>
      )}

      {/* Add to class modal */}
      {addingTo && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200 }}
          onClick={e => e.target===e.currentTarget && setAddingTo(null)}>
          <div style={{ background:'white', borderRadius:'16px', padding:'28px', width:'460px', boxShadow:'0 24px 64px rgba(0,0,0,0.18)' }}>
            <h3 style={{ fontSize:'18px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'4px' }}>Add to class</h3>
            <p style={{ fontSize:'13px', color:'#94a3b8', marginBottom:'16px' }}>
              Placing <strong style={{ color:D }}>{addingTo.full_name}</strong> · Level: <strong style={{ color: LEVEL_COLORS[addingTo.level]||G }}>{addingTo.level}</strong>
            </p>

            {/* Score summary */}
            <div style={{ background:'#f8fafb', borderRadius:'10px', padding:'14px', marginBottom:'18px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px', textAlign:'center' }}>
              {[['Grammar',addingTo.grammar_score,50],['Reading',addingTo.reading_score,10],['Writing',addingTo.writing_score??addingTo.ai_writing_grade,10]].map(([l,s,m]) => (
                <div key={l}>
                  <div style={{ fontSize:'20px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D }}>{s??'—'}<span style={{ fontSize:'10px', color:'#94a3b8' }}>/{m}</span></div>
                  <div style={{ fontSize:'10px', color:'#94a3b8', fontWeight:'600' }}>{l}</div>
                </div>
              ))}
            </div>

            <label style={lStyle}>Teacher</label>
            <select value={form.teacher_username} onChange={e => setForm(p=>({...p,teacher_username:e.target.value,day:'',class_time:''}))} style={iStyle}>
              <option value="">Select teacher...</option>
              {teachers.map(t => <option key={t.username} value={t.username}>{t.full_name}</option>)}
            </select>

            <label style={lStyle}>Day</label>
            <select value={form.day} onChange={e => setForm(p=>({...p,day:e.target.value}))} style={iStyle}>
              <option value="">Select day...</option>
              <option value="odd">Odd (Mon · Wed · Fri)</option>
              <option value="even">Even (Tue · Thu · Sat)</option>
            </select>

            <label style={lStyle}>Class Time</label>
            <select value={form.class_time} onChange={e => setForm(p=>({...p,class_time:e.target.value}))} style={iStyle}>
              <option value="">Select time...</option>
              {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {form.teacher_username && form.day && form.class_time && (
              <div style={{ background:`${G}10`, borderRadius:'8px', padding:'10px 14px', marginBottom:'14px', fontSize:'13px', color:G, fontWeight:'600' }}>
                ✓ {teachers.find(t=>t.username===form.teacher_username)?.full_name} · {form.day==='odd'?'Mon/Wed/Fri':'Tue/Thu/Sat'} · {form.class_time}
              </div>
            )}

            <div style={{ display:'flex', gap:'10px' }}>
              <button onClick={() => { setAddingTo(null); setForm({ teacher_username:'', day:'', class_time:'' }) }}
                style={{ flex:1, padding:'12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
              <button onClick={addStudent} disabled={saving||!form.teacher_username||!form.day||!form.class_time}
                style={{ flex:1, padding:'12px', borderRadius:'8px', border:'none', background:G, color:'white', fontSize:'14px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'700', cursor:'pointer', opacity:(!form.teacher_username||!form.day||!form.class_time)?.6:1 }}>
                {saving?'Adding...':'Add student'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}