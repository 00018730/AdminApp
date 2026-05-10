import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const G = '#009472'
const D = '#002b2a'

const TYPES = [
  { key:'announcement', label:'📢 Announcement', color:'#3b82f6', bg:'#eff6ff' },
  { key:'payment',      label:'💳 Payment Reminder', color:'#f5a623', bg:'#fffbeb' },
  { key:'homework',     label:'📝 Homework Notice', color:G, bg:'#f0faf7' },
  { key:'event',        label:'🎉 Event', color:'#8b5cf6', bg:'#f5f3ff' },
  { key:'warning',      label:'⚠️ Warning', color:'#dc2626', bg:'#fef2f2' },
]

const TIMES = ['9:30','14:30','16:30','18:30']
const LEVELS = ['Beginner','Elementary','Pre-Intermediate','Intermediate','Upper-Intermediate']

export default function AnnouncementsSection() {
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState([])
  const [groups, setGroups]     = useState([])
  const [notifs, setNotifs]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [sending, setSending]   = useState(false)
  const [sent, setSent]         = useState(false)

  // Form state
  const [title, setTitle]   = useState('')
  const [body, setBody]     = useState('')
  const [type, setType]     = useState('announcement')
  const [target, setTarget] = useState('all') // 'all' | 'teacher' | 'group' | 'level'
  const [selTeacher, setSelTeacher] = useState('')
  const [selDay, setSelDay]         = useState('')
  const [selTime, setSelTime]       = useState('')
  const [selLevel, setSelLevel]     = useState('')

  // History filter
  const [histFilter, setHistFilter] = useState('all')

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data:s }, { data:t }, { data:n }] = await Promise.all([
      supabase.from('students').select('username,full_name,teacher_username,day,class_time,status,group_id').eq('status','active'),
      supabase.from('teachers').select('*').order('full_name'),
      supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(100),
    ])
    if (s) { setStudents(s); buildGroups(s) }
    if (t) setTeachers(t)
    if (n) setNotifs(n)
    setLoading(false)
  }

  const buildGroups = (studs) => {
    const map = {}
    studs.forEach(s => {
      if (!s.teacher_username || !s.day || !s.class_time) return
      const key = `${s.teacher_username}||${s.day}||${s.class_time}`
      if (!map[key]) map[key] = { teacher:s.teacher_username, day:s.day, time:s.class_time, count:0 }
      map[key].count++
    })
    setGroups(Object.values(map))
  }

  // Get recipients based on target
  const getRecipients = () => {
    let list = [...students]
    if (target === 'teacher' && selTeacher)
      list = list.filter(s => s.teacher_username === selTeacher)
    else if (target === 'group' && selTeacher && selDay && selTime)
      list = list.filter(s => s.teacher_username === selTeacher && s.day === selDay && s.class_time === selTime)
    else if (target === 'level' && selLevel) {
      // We'd need level from groups; use group_id approach or filter by whatever level field exists
      // For now filter by level stored in student's group
      list = list.filter(s => s.level === selLevel)
    }
    return list
  }

  const recipients = getRecipients()

  const isValid = title.trim().length > 0 && body.trim().length > 0 && recipients.length > 0

  const send = async () => {
    if (!isValid) return
    setSending(true)

    const rows = recipients.map(s => ({
      student_username: s.username,
      type,
      title: title.trim(),
      body: body.trim(),
      is_read: false,
      sender: 'admin',
    }))

    // Insert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      await supabase.from('notifications').insert(rows.slice(i, i+50))
    }

    setSending(false)
    setSent(true)
    setTitle(''); setBody(''); setTarget('all'); setSelTeacher(''); setSelDay(''); setSelTime(''); setSelLevel('')
    setTimeout(() => setSent(false), 3000)
    fetchAll()
  }

  const deleteNotif = async (id) => {
    await supabase.from('notifications').delete().eq('id', id)
    fetchAll()
  }

  const histFiltered = histFilter === 'all' ? notifs : notifs.filter(n => n.type === histFilter)

  const targetLabel = () => {
    if (target === 'all') return `All students (${students.length})`
    if (target === 'teacher' && selTeacher) {
      const t = teachers.find(t=>t.username===selTeacher)
      return `${t?.full_name}'s students (${recipients.length})`
    }
    if (target === 'group' && selTeacher && selDay && selTime)
      return `${selDay==='odd'?'Mon/Wed/Fri':'Tue/Thu/Sat'} · ${selTime} (${recipients.length} students)`
    if (target === 'level' && selLevel) return `${selLevel} students (${recipients.length})`
    return 'Select a target...'
  }

  const selectedType = TYPES.find(t=>t.key===type) || TYPES[0]

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'#94a3b8', fontSize:'14px' }}>Loading...</div>

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:'24px', alignItems:'start' }}>

      {/* LEFT: Compose */}
      <div>
        <div style={{ background:'white', borderRadius:'14px', border:'1.5px solid #e4e8e7', overflow:'hidden' }}>
          <div style={{ padding:'20px 22px', borderBottom:'1px solid #f0f2f1', background:'#f8fafb' }}>
            <div style={{ fontSize:'16px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D }}>New Announcement</div>
            <div style={{ fontSize:'13px', color:'#94a3b8', marginTop:'2px' }}>Send a notification to students</div>
          </div>

          <div style={{ padding:'22px' }}>
            {/* Type selector */}
            <div style={{ marginBottom:'20px' }}>
              <label style={{ fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'8px' }}>Type</label>
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                {TYPES.map(t => (
                  <button key={t.key} onClick={() => setType(t.key)}
                    style={{ padding:'7px 13px', borderRadius:'20px', border:`1.5px solid ${type===t.key?t.color:'#e4e8e7'}`, background:type===t.key?t.bg:'white', color:type===t.key?t.color:'#64748b', fontSize:'12px', fontWeight:'600', cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div style={{ marginBottom:'16px' }}>
              <label style={{ fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'6px' }}>Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Payment Reminder for May" maxLength={80}
                style={{ width:'100%', padding:'11px 14px', borderRadius:'8px', border:`1.5px solid ${title.length>0?G:'#e4e8e7'}`, fontSize:'15px', outline:'none', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'600', boxSizing:'border-box', transition:'border-color 0.15s' }} />
              <div style={{ textAlign:'right', fontSize:'11px', color:'#94a3b8', marginTop:'4px' }}>{title.length}/80</div>
            </div>

            {/* Body */}
            <div style={{ marginBottom:'20px' }}>
              <label style={{ fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'6px' }}>Message *</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message to students here..." rows={5} maxLength={500}
                style={{ width:'100%', padding:'11px 14px', borderRadius:'8px', border:`1.5px solid ${body.length>0?G:'#e4e8e7'}`, fontSize:'14px', outline:'none', color:D, fontFamily:"'DM Sans',sans-serif", resize:'vertical', lineHeight:'1.6', boxSizing:'border-box', transition:'border-color 0.15s' }} />
              <div style={{ textAlign:'right', fontSize:'11px', color:'#94a3b8', marginTop:'4px' }}>{body.length}/500</div>
            </div>

            {/* Target selector */}
            <div style={{ marginBottom:'20px' }}>
              <label style={{ fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:'8px' }}>Send To</label>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px', marginBottom:'14px' }}>
                {[['all','🌍 All'],['teacher','👨‍🏫 Teacher'],['group','👥 Group'],['level','📚 Level']].map(([val,label]) => (
                  <button key={val} onClick={() => { setTarget(val); setSelTeacher(''); setSelDay(''); setSelTime(''); setSelLevel('') }}
                    style={{ padding:'9px 6px', borderRadius:'8px', border:`1.5px solid ${target===val?G:'#e4e8e7'}`, background:target===val?`${G}12`:'white', color:target===val?G:'#64748b', fontSize:'12px', fontWeight:'600', cursor:'pointer', transition:'all 0.15s' }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Sub-selectors */}
              {(target === 'teacher' || target === 'group') && (
                <select value={selTeacher} onChange={e => { setSelTeacher(e.target.value); setSelDay(''); setSelTime('') }}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, marginBottom:'10px', boxSizing:'border-box', background:'white' }}>
                  <option value="">Select teacher...</option>
                  {teachers.map(t => <option key={t.username} value={t.username}>{t.full_name}</option>)}
                </select>
              )}

              {target === 'group' && selTeacher && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                  <select value={selDay} onChange={e => setSelDay(e.target.value)}
                    style={{ padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, background:'white' }}>
                    <option value="">Day...</option>
                    <option value="odd">Mon/Wed/Fri</option>
                    <option value="even">Tue/Thu/Sat</option>
                  </select>
                  <select value={selTime} onChange={e => setSelTime(e.target.value)}
                    style={{ padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, background:'white' }}>
                    <option value="">Time...</option>
                    {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              {target === 'level' && (
                <select value={selLevel} onChange={e => setSelLevel(e.target.value)}
                  style={{ width:'100%', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, background:'white' }}>
                  <option value="">Select level...</option>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              )}
            </div>

            {/* Preview */}
            {(title || body) && (
              <div style={{ background:'#f8fafb', borderRadius:'10px', padding:'14px', marginBottom:'16px', borderLeft:`4px solid ${selectedType.color}` }}>
                <div style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>Preview</div>
                <div style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
                  <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:selectedType.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', flexShrink:0 }}>
                    {selectedType.label.split(' ')[0]}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'14px', fontWeight:'700', color:D, marginBottom:'3px' }}>{title || 'Your title here'}</div>
                    <div style={{ fontSize:'13px', color:'#64748b', lineHeight:'1.5' }}>{body || 'Your message here...'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Send button */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:'14px' }}>
              <div style={{ fontSize:'13px', color: recipients.length > 0 ? G : '#94a3b8', fontWeight:'600' }}>
                {recipients.length > 0
                  ? `📨 Sending to ${recipients.length} student${recipients.length!==1?'s':''}`
                  : '⚠️ No recipients selected'}
              </div>
              <button onClick={send} disabled={!isValid || sending}
                style={{ padding:'11px 24px', borderRadius:'10px', border:'none', background: isValid&&!sending ? `linear-gradient(135deg,${D},${G})` : '#e4e8e7', color: isValid&&!sending ? 'white' : '#94a3b8', fontSize:'14px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'700', cursor: isValid&&!sending ? 'pointer':'default', transition:'all 0.2s', whiteSpace:'nowrap' }}>
                {sending ? 'Sending...' : sent ? '✓ Sent!' : 'Send notification →'}
              </button>
            </div>

            {sent && (
              <div style={{ marginTop:'12px', background:'#d1fae5', borderRadius:'8px', padding:'10px 14px', fontSize:'13px', color:'#065f46', fontWeight:'600', textAlign:'center' }}>
                ✅ Notification sent successfully to {recipients.length} student{recipients.length!==1?'s':''}!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT: History */}
      <div style={{ position:'sticky', top:'20px' }}>
        <div style={{ background:'white', borderRadius:'14px', border:'1.5px solid #e4e8e7', overflow:'hidden' }}>
          <div style={{ padding:'16px 18px', borderBottom:'1px solid #f0f2f1', background:'#f8fafb', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:'15px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'700', color:D }}>History</div>
            <select value={histFilter} onChange={e => setHistFilter(e.target.value)}
              style={{ padding:'5px 10px', borderRadius:'6px', border:'1.5px solid #e4e8e7', fontSize:'12px', outline:'none', color:D, background:'white' }}>
              <option value="all">All types</option>
              {TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>

          <div style={{ maxHeight:'560px', overflowY:'auto' }}>
            {histFiltered.length === 0 ? (
              <div style={{ padding:'40px', textAlign:'center', color:'#94a3b8', fontSize:'13px' }}>
                <div style={{ fontSize:'32px', marginBottom:'8px' }}>📭</div>
                No notifications sent yet
              </div>
            ) : (
              // Group by unique title+body+created_at combo (sent in batch = same second)
              (() => {
                // Deduplicate: group by title+body+type within 10 seconds
                const seen = {}
                const deduped = []
                histFiltered.forEach(n => {
                  const key = `${n.title}__${n.body}__${n.type}__${n.created_at?.slice(0,16)}`
                  if (!seen[key]) {
                    seen[key] = { ...n, count:0 }
                    deduped.push(seen[key])
                  }
                  seen[key].count++
                })
                return deduped.map((n, i) => {
                  const t = TYPES.find(t=>t.key===n.type) || TYPES[0]
                  return (
                    <div key={i} style={{ padding:'12px 16px', borderBottom:'1px solid #f0f2f1', display:'flex', gap:'10px', alignItems:'flex-start' }}>
                      <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:t.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', flexShrink:0 }}>
                        {t.label.split(' ')[0]}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'6px', marginBottom:'3px' }}>
                          <div style={{ fontSize:'13px', fontWeight:'700', color:D, lineHeight:'1.3' }}>{n.title}</div>
                          <span style={{ fontSize:'10px', fontWeight:'700', padding:'2px 7px', borderRadius:'4px', background:t.bg, color:t.color, flexShrink:0 }}>{n.count}</span>
                        </div>
                        <div style={{ fontSize:'12px', color:'#64748b', lineHeight:'1.4', marginBottom:'4px' }}>{n.body}</div>
                        <div style={{ fontSize:'11px', color:'#94a3b8' }}>{n.created_at?.slice(0,16).replace('T',' ')} · {n.count} student{n.count!==1?'s':''}</div>
                      </div>
                      <button onClick={() => deleteNotif(n.id)} style={{ width:'24px', height:'24px', borderRadius:'6px', border:'none', background:'#fef2f2', color:'#dc2626', fontSize:'12px', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                    </div>
                  )
                })
              })()
            )}
          </div>
        </div>
      </div>
    </div>
  )
}