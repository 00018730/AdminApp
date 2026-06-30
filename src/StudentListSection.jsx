import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { logEdit } from './editLog'

const G = '#009472'
const D = '#002b2a'

function dayLabel(day) {
  if (day === 'odd')  return 'Mon / Wed / Fri'
  if (day === 'even') return 'Tue / Thu / Sat'
  return day || ''
}
// contract numbers sort by [year, seq]; unnumbered sort last
function contractSortKey(cn) {
  if (!cn) return [9999, 999999]
  const [y, n] = cn.split('-')
  return [parseInt(y, 10) || 9999, parseInt(n, 10) || 999999]
}

export default function StudentsListSection({ role }) {
  const [students, setStudents] = useState([])
  const [teachers, setTeachers] = useState({})   // username → full_name
  const [groups,   setGroups]   = useState({})   // id → group
  const [parents,  setParents]  = useState({})   // student_username → parent
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [busy,     setBusy]     = useState(null)  // username being assigned

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    // students — page through (Supabase caps each request at 1000 rows)
    const PAGE = 1000
    let from = 0, allStudents = []
    while (true) {
      const { data, error } = await supabase.from('students')
        .select('username,full_name,phone,enrolled_date,contract_number,status,teacher_username,day,class_time,group_id')
        .neq('username', 'test')
        .order('username', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error || !data) break
      allStudents = allStudents.concat(data)
      if (data.length < PAGE) break
      from += PAGE
    }

    const [{ data: tchs }, { data: grps }, { data: prnts }] = await Promise.all([
      supabase.from('teachers').select('username,full_name'),
      supabase.from('groups').select('id,level,day,class_time,teacher_username'),
      supabase.from('parents').select('student_username,full_name,phone,phone_2,parent_role'),
    ])

    const tMap = {}; (tchs || []).forEach(t => { tMap[t.username] = t.full_name })
    const gMap = {}; (grps || []).forEach(g => { gMap[g.id] = g })
    const pMap = {}; (prnts || []).forEach(p => { if (!pMap[p.student_username]) pMap[p.student_username] = p })

    setStudents(allStudents); setTeachers(tMap); setGroups(gMap); setParents(pMap)
    setLoading(false)
  }

  const generateNumber = async (stu) => {
    setBusy(stu.username)
    const { data, error } = await supabase.rpc('assign_contract_number', { p_username: stu.username })
    if (!error) {
      logEdit({ action:'update', target_table:'students', target_id:stu.username, summary:`Generated contract # ${data} for ${stu.full_name}` })
      setStudents(prev => prev.map(s => s.username === stu.username ? { ...s, contract_number: data } : s))
    } else {
      alert('Could not generate a contract number: ' + error.message)
    }
    setBusy(null)
  }

  const groupLabel = (stu) => {
    const g = stu.group_id ? groups[stu.group_id] : null
    if (g) return `${g.level ? g.level + ' · ' : ''}${dayLabel(g.day)}${g.class_time ? ' · ' + g.class_time : ''}`
    if (stu.day || stu.class_time) return `${dayLabel(stu.day)}${stu.class_time ? ' · ' + stu.class_time : ''}`
    return '—'
  }

  const q = search.trim().toLowerCase()
  const filtered = students.filter(s => {
    if (!q) return true
    const parent = parents[s.username]
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.contract_number?.toLowerCase().includes(q) ||
      teachers[s.teacher_username]?.toLowerCase().includes(q) ||
      s.phone?.toLowerCase().includes(q) ||
      parent?.full_name?.toLowerCase().includes(q)
    )
  })
  const sorted = [...filtered].sort((a, b) => {
    const ka = contractSortKey(a.contract_number), kb = contractSortKey(b.contract_number)
    if (ka[0] !== kb[0]) return ka[0] - kb[0]
    if (ka[1] !== kb[1]) return ka[1] - kb[1]
    return (a.full_name || '').localeCompare(b.full_name || '')
  })

  const numbered   = students.filter(s => s.contract_number).length
  const unnumbered = students.length - numbered

  const th = { padding:'11px 14px', textAlign:'left', fontSize:'11px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em', whiteSpace:'nowrap' }
  const td = { padding:'12px 14px', fontSize:'13px', color:D, verticalAlign:'middle' }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'#94a3b8', fontSize:'14px' }}>Loading students…</div>

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      {/* Stats */}
      <div style={{ display:'flex', gap:'12px', marginBottom:'20px', flexWrap:'wrap' }}>
        {[
          { label:'Total students', value:students.length, color:D },
          { label:'With contract #', value:numbered,       color:G },
          { label:'Awaiting #',      value:unnumbered,      color:'#f59e0b' },
        ].map(s => (
          <div key={s.label} style={{ flex:1, minWidth:'140px', background:'white', borderRadius:'14px', padding:'14px 18px', border:'1px solid #f0f2f1', boxShadow:'0 1px 6px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize:'22px', fontWeight:'800', color:s.color, fontFamily:"'Plus Jakarta Sans',sans-serif", lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:'11px', color:'#94a3b8', fontWeight:'600', marginTop:'4px' }}>{s.label}</div>
          </div>
        ))}
        <div style={{ flex:2, minWidth:'200px', display:'flex', alignItems:'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, contract #, teacher, phone…"
            style={{ width:'100%', padding:'11px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', outline:'none', color:D, fontFamily:"'DM Sans',sans-serif" }} />
        </div>
      </div>

      <div style={{ background:'white', borderRadius:'14px', border:'1.5px solid #e4e8e7', overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'900px' }}>
            <thead>
              <tr style={{ background:'#f8fafb', borderBottom:'1.5px solid #e4e8e7' }}>
                <th style={th}>Contract #</th>
                <th style={th}>Student</th>
                <th style={th}>Teacher</th>
                <th style={th}>Group</th>
                <th style={th}>Phone</th>
                <th style={th}>Enrolled</th>
                <th style={th}>Parent</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => {
                const parent = parents[s.username]
                return (
                  <tr key={s.username} style={{ borderBottom:i<sorted.length-1?'1px solid #f0f2f1':'none' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f8fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <td style={td}>
                      {s.contract_number
                        ? <span style={{ fontFamily:'monospace', fontWeight:'700', color:G }}>{s.contract_number}</span>
                        : <button onClick={() => generateNumber(s)} disabled={busy===s.username}
                            style={{ padding:'5px 11px', borderRadius:'7px', border:`1.5px solid ${G}`, background:'white', color:G, fontSize:'12px', fontWeight:'700', cursor:busy===s.username?'default':'pointer', whiteSpace:'nowrap' }}>
                            {busy===s.username ? '…' : 'Generate #'}
                          </button>}
                    </td>
                    <td style={td}>
                      <div style={{ fontWeight:'700' }}>{s.full_name}</div>
                      {s.status==='left' && <span style={{ fontSize:'10px', fontWeight:'700', color:'#ef4444' }}>Left</span>}
                    </td>
                    <td style={{ ...td, color:'#64748b' }}>{teachers[s.teacher_username] || '—'}</td>
                    <td style={{ ...td, color:'#64748b' }}>{groupLabel(s)}</td>
                    <td style={td}>{s.phone ? <a href={`tel:${s.phone}`} style={{ color:G, fontWeight:'600', textDecoration:'none' }}>{s.phone}</a> : <span style={{ color:'#cbd5e1' }}>—</span>}</td>
                    <td style={{ ...td, color:'#64748b' }}>{s.enrolled_date || '—'}</td>
                    <td style={td}>
                      {parent
                        ? <div>
                            <div style={{ fontWeight:'600' }}>{parent.full_name}{parent.parent_role ? <span style={{ color:'#94a3b8', fontWeight:'500' }}> ({parent.parent_role})</span> : ''}</div>
                            {parent.phone && <a href={`tel:${parent.phone}`} style={{ color:G, fontWeight:'600', textDecoration:'none', fontSize:'12px' }}>{parent.phone}</a>}
                          </div>
                        : <span style={{ color:'#cbd5e1' }}>—</span>}
                    </td>
                  </tr>
                )
              })}
              {!sorted.length && (
                <tr><td colSpan={7} style={{ padding:'48px', textAlign:'center', color:'#94a3b8' }}>
                  {search ? 'No students match your search.' : 'No students yet.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'12px', lineHeight:1.6 }}>
        New students get a contract number automatically after their first payment. For students enrolled before this system, use <b>Generate #</b> to assign one, then write it on their paper contract.
      </div>
    </div>
  )
}