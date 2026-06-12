import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const G  = '#009472'
const D  = '#002b2a'

const TIME_SLOTS = [
  { start: '09:00', label: '09:00 – 10:30' },
  { start: '10:30', label: '10:30 – 12:00' },
  { start: '14:30', label: '14:30 – 16:00' },
  { start: '16:00', label: '16:00 – 17:30' },
  { start: '17:30', label: '17:30 – 19:00' },
  { start: '19:00', label: '19:00 – 20:30' },
]
const DAYS   = ['odd', 'even']
const LEVELS = ['Beginner','Elementary','Pre-Intermediate','Intermediate','Upper-Intermediate','IELTS Foundation','IELTS Proficiency']

const dayLabel = d => d === 'odd' ? 'Mon / Wed / Fri' : 'Tue / Thu / Sat'
const slotLabel = start => TIME_SLOTS.find(s => s.start === start)?.label || start

// ── CREATE GROUP ──────────────────────────────────────────────────────────────
function CreateGroupModal({ teacher, day, slot, onClose, onCreated }) {
  const [level,           setLevel]           = useState('Elementary')
  const [firstLessonDate, setFirstLessonDate] = useState('')
  const [saving,          setSaving]          = useState(false)
  const [error,           setError]           = useState('')

  const create = async () => {
    setSaving(true); setError('')
    const payload = { teacher_username:teacher.username, day, class_time:slot.start, level }
    // first_lesson_date only matters for Beginner groups (controls the Starter period)
    if (level === 'Beginner' && firstLessonDate) payload.first_lesson_date = firstLessonDate
    const { error: err } = await supabase.from('groups').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    onCreated()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'20px', padding:'28px', width:'100%', maxWidth:'380px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
          <div style={{ fontSize:'17px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Create Group</div>
          <button onClick={onClose} style={{ width:'32px', height:'32px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'16px' }}>✕</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'16px' }}>
          {[{ label:'Teacher', value:teacher.full_name },{ label:'Time', value:slot.label },{ label:'Day', value:day==='odd'?'Mon / Wed / Fri':'Tue / Thu / Sat' }].map(r => (
            <div key={r.label} style={{ background:'#f8fafb', borderRadius:'10px', padding:'10px 12px' }}>
              <div style={{ fontSize:'10px', fontWeight:'700', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.05em' }}>{r.label}</div>
              <div style={{ fontSize:'13px', fontWeight:'700', color:D, marginTop:'2px' }}>{r.value}</div>
            </div>
          ))}
        </div>
        <label style={{ fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px' }}>Level</label>
        <select value={level} onChange={e => setLevel(e.target.value)}
          style={{ width:'100%', padding:'12px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', color:D, fontFamily:"'DM Sans',sans-serif", outline:'none', background:'white', marginBottom:'16px' }}>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        {/* First lesson date — Beginner only (controls Starter period) */}
        {level === 'Beginner' && (
          <div style={{ marginBottom:'16px' }}>
            <label style={{ fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px' }}>First Lesson Date</label>
            <input type="date" value={firstLessonDate} onChange={e => setFirstLessonDate(e.target.value)}
              style={{ width:'100%', padding:'12px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', color:D, fontFamily:"'DM Sans',sans-serif", outline:'none', background:'white', boxSizing:'border-box' }} />
            <div style={{ background:`${G}0d`, borderRadius:'10px', padding:'10px 12px', marginTop:'8px', fontSize:'12px', color:'#0f766e', lineHeight:1.5 }}>
              💡 Until this date, students see a <strong>Starter</strong> level with a Library to study. The day it arrives, they automatically become full Beginners. Leave empty if lessons start right away.
            </div>
          </div>
        )}

        {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginBottom:'12px' }}>{error}</div>}
        <div style={{ background:'#fef3c7', borderRadius:'10px', padding:'10px 12px', marginBottom:'16px', fontSize:'12px', color:'#92400e' }}>
          ⚠️ After creating, the teacher must open <strong>Name Group</strong> in their app to generate lesson records.
        </div>
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'12px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
          <button onClick={create} disabled={saving}
            style={{ flex:2, padding:'12px', borderRadius:'12px', border:'none', background:G, color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {saving ? 'Creating…' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── MOVE GROUP ────────────────────────────────────────────────────────────────
// Students, lessons, and homework are linked to a group by (teacher_username, day,
// class_time) — NOT by group id. So moving a group must cascade-update all of them,
// or the students get orphaned. This modal does the full cascade.
function MoveGroupModal({ group, allGroups, teachers, onClose, onMoved }) {
  const [targetTeacher, setTargetTeacher] = useState(group.teacher_username)
  const [targetDay,     setTargetDay]     = useState(group.day)
  const [targetSlot,    setTargetSlot]    = useState('')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')

  // Which slots are occupied for the chosen teacher + day
  const occupied = new Set(
    allGroups
      .filter(g => g.teacher_username === targetTeacher && g.day === targetDay)
      .map(g => g.class_time)
  )

  const move = async () => {
    if (!targetSlot) { setError('Please choose a destination slot.'); return }
    setSaving(true); setError('')

    const oldMatch = { teacher_username: group.teacher_username, day: group.day, class_time: group.class_time }
    const newVals  = { teacher_username: targetTeacher, day: targetDay, class_time: targetSlot }

    try {
      // Cascade: move all linked records to the new slot FIRST, then the group itself
      await supabase.from('students').update(newVals).match(oldMatch)
      await supabase.from('lessons').update(newVals).match(oldMatch)
      await supabase.from('homework').update(newVals).match(oldMatch)
      const { error: gErr } = await supabase.from('groups').update(newVals).eq('id', group.id)
      if (gErr) throw gErr
      onMoved()
    } catch (err) {
      setError(err.message || 'Move failed.')
      setSaving(false)
    }
  }

  const teacherName = teachers.find(t => t.username === targetTeacher)?.full_name || targetTeacher
  const isSameSlot  = targetTeacher === group.teacher_username && targetDay === group.day && targetSlot === group.class_time

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:300, padding:'24px', fontFamily:"'DM Sans',sans-serif" }}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ background:'white', borderRadius:'20px', padding:'26px', width:'100%', maxWidth:'440px', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
          <span style={{ fontSize:'17px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Move Group</span>
          <button onClick={onClose} style={{ width:'30px', height:'30px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'15px' }}>✕</button>
        </div>
        <div style={{ fontSize:'12px', color:'#94a3b8', marginBottom:'18px' }}>
          From: {group.level} · {dayLabel(group.day)} · {slotLabel(group.class_time)}
        </div>

        {/* Teacher */}
        <label style={{ fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px' }}>Teacher</label>
        <select value={targetTeacher} onChange={e => { setTargetTeacher(e.target.value); setTargetSlot('') }}
          style={{ width:'100%', padding:'12px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', color:D, fontFamily:"'DM Sans',sans-serif", outline:'none', background:'white', marginBottom:'14px', boxSizing:'border-box' }}>
          {teachers.map(t => <option key={t.username} value={t.username}>{t.full_name}</option>)}
        </select>

        {/* Day */}
        <label style={{ fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px' }}>Day</label>
        <div style={{ display:'flex', gap:'8px', marginBottom:'14px' }}>
          {DAYS.map(d => (
            <button key={d} onClick={() => { setTargetDay(d); setTargetSlot('') }}
              style={{ flex:1, padding:'11px', borderRadius:'10px', border:`1.5px solid ${targetDay===d?G:'#e4e8e7'}`, background:targetDay===d?`${G}10`:'white', color:targetDay===d?G:'#64748b', fontSize:'13px', fontWeight:'700', cursor:'pointer' }}>
              {dayLabel(d)}
            </button>
          ))}
        </div>

        {/* Slot */}
        <label style={{ fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px' }}>Time Slot</label>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'16px' }}>
          {TIME_SLOTS.map(s => {
            const isOccupied = occupied.has(s.start)
            const isCurrent  = targetTeacher === group.teacher_username && targetDay === group.day && s.start === group.class_time
            const disabled   = isOccupied // occupied slots (incl. the group's own current slot) can't be chosen
            const selected   = targetSlot === s.start
            return (
              <button key={s.start} disabled={disabled} onClick={() => setTargetSlot(s.start)}
                style={{ padding:'10px', borderRadius:'10px', border:`1.5px solid ${selected?G:'#e4e8e7'}`, background:disabled?'#f4f4f5':selected?`${G}10`:'white', color:disabled?'#c4c4c4':selected?G:'#64748b', fontSize:'12px', fontWeight:'700', cursor:disabled?'not-allowed':'pointer', position:'relative' }}>
                {s.label}
                {isCurrent && <span style={{ display:'block', fontSize:'9px', fontWeight:'600', marginTop:'2px' }}>current</span>}
                {isOccupied && !isCurrent && <span style={{ display:'block', fontSize:'9px', fontWeight:'600', marginTop:'2px' }}>taken</span>}
              </button>
            )
          })}
        </div>

        {targetSlot && !isSameSlot && (
          <div style={{ background:`${G}0d`, borderRadius:'10px', padding:'10px 12px', marginBottom:'14px', fontSize:'12px', color:'#0f766e', lineHeight:1.5 }}>
            ✓ Moving to <strong>{teacherName} · {dayLabel(targetDay)} · {slotLabel(targetSlot)}</strong>. All students, lessons and homework move with the group.
          </div>
        )}

        {error && <div style={{ color:'#ef4444', fontSize:'13px', fontWeight:'600', marginBottom:'12px' }}>{error}</div>}
        <div style={{ display:'flex', gap:'10px' }}>
          <button onClick={onClose} style={{ flex:1, padding:'12px', borderRadius:'12px', border:'1.5px solid #e4e8e7', background:'white', color:'#64748b', fontSize:'14px', fontWeight:'600', cursor:'pointer' }}>Cancel</button>
          <button onClick={move} disabled={saving || !targetSlot || isSameSlot}
            style={{ flex:2, padding:'12px', borderRadius:'12px', border:'none', background:(targetSlot && !isSameSlot)?G:'#e4e8e7', color:'white', fontSize:'14px', fontWeight:'700', cursor:(targetSlot && !isSameSlot)?'pointer':'default', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
            {saving ? 'Moving…' : 'Confirm Move'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TeacherGrid({ teacher, groups, studentCounts, onCreateSlot, onSelectGroup, selectedGroup, readOnly }) {
  const groupMap = {}
  for (const g of groups) groupMap[`${g.day}_${g.class_time}`] = g

  const levelColors = {
    'Beginner':'#dcfce7','Elementary':'#dbeafe','Pre-Intermediate':'#ede9fe',
    'Intermediate':'#fef3c7','Upper-Intermediate':'#fee2e2',
    'IELTS Foundation':'#f0fdf4','IELTS Proficiency':'#f0f9ff',
  }

  return (
    <div style={{ background:'white', borderRadius:'16px', padding:'20px', marginBottom:'16px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
        <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:`${G}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px' }}>👨‍🏫</div>
        <div>
          <div style={{ fontSize:'16px', fontWeight:'800', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{teacher.full_name}</div>
          <div style={{ fontSize:'12px', color:'#94a3b8' }}>@{teacher.username}</div>
        </div>
        <div style={{ marginLeft:'auto', fontSize:'12px', color:'#94a3b8', fontWeight:'600' }}>{groups.length}/12 groups</div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'120px 1fr 1fr', gap:'6px', marginBottom:'6px' }}>
        <div />
        {DAYS.map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:'11px', fontWeight:'700', color:'#64748b', textTransform:'uppercase', letterSpacing:'0.05em' }}>
            {d === 'odd' ? 'Mon/Wed/Fri' : 'Tue/Thu/Sat'}
          </div>
        ))}
      </div>
      {TIME_SLOTS.map(slot => (
        <div key={slot.start} style={{ display:'grid', gridTemplateColumns:'120px 1fr 1fr', gap:'6px', marginBottom:'6px' }}>
          <div style={{ fontSize:'12px', fontWeight:'700', color:'#64748b', display:'flex', alignItems:'center' }}>{slot.label}</div>
          {DAYS.map(day => {
            const key   = `${day}_${slot.start}`
            const group = groupMap[key]
            const count = group ? (studentCounts[`${group.teacher_username}_${group.day}_${group.class_time}`] || 0) : 0

            if (group) return (
              <div key={day} onClick={() => onSelectGroup(group)}
                style={{ background:levelColors[group.level]||'#f8fafb', borderRadius:'10px', padding:'10px 12px', border:`1.5px solid ${selectedGroup?.id===group.id?D:'rgba(0,0,0,0.06)'}`, cursor:'pointer', transition:'all 0.15s', boxShadow:selectedGroup?.id===group.id?`0 0 0 2px ${D}`:'none' }}
                onMouseEnter={e => e.currentTarget.style.opacity='0.85'}
                onMouseLeave={e => e.currentTarget.style.opacity='1'}>
                <div style={{ fontSize:'11px', fontWeight:'800', color:D }}>{group.level}</div>
                <div style={{ fontSize:'11px', color:'#64748b', marginTop:'2px' }}>{count} student{count!==1?'s':''}</div>
                {/* Starter badge if this Beginner group hasn't started yet */}
                {group.level === 'Beginner' && group.first_lesson_date && group.first_lesson_date > new Date().toISOString().slice(0,10) && (
                  <div style={{ fontSize:'9px', fontWeight:'700', color:'#0f766e', marginTop:'3px', background:'rgba(15,118,110,0.1)', padding:'1px 5px', borderRadius:'5px', display:'inline-block' }}>⏳ Starter</div>
                )}
              </div>
            )

            if (readOnly) return (
              <div key={day} style={{ borderRadius:'10px', padding:'10px 12px', border:'1.5px dashed #e4e8e7', background:'#fafafa' }} />
            )

            return (
              <button key={day} onClick={() => onCreateSlot(teacher, day, slot)}
                style={{ borderRadius:'10px', padding:'10px 12px', border:'1.5px dashed #e4e8e7', background:'#fafafa', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', color:'#94a3b8', fontSize:'12px', fontWeight:'600', transition:'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor=G; e.currentTarget.style.color=G }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='#e4e8e7'; e.currentTarget.style.color='#94a3b8' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New group
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

export default function GroupsSection({ readOnly = false, onNavigate = null }) {
  const [teachers,      setTeachers]      = useState([])
  const [groups,        setGroups]        = useState([])
  const [studentCounts, setStudentCounts] = useState({})
  const [loading,       setLoading]       = useState(true)
  const [creating,      setCreating]      = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [deleting,      setDeleting]      = useState(false)
  const [moving,        setMoving]        = useState(false)
  const [firstLessonInput, setFirstLessonInput] = useState('')
  const [savingDate,    setSavingDate]    = useState(false)

  useEffect(() => { fetchAll() }, [])

  // Keep the date input in sync with whichever group is open
  useEffect(() => {
    setFirstLessonInput(selectedGroup?.first_lesson_date || '')
  }, [selectedGroup])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: t }, { data: g }, { data: s }] = await Promise.all([
      supabase.from('teachers').select('username, full_name').neq('username', 'test').order('full_name'),
      supabase.from('groups').select('*'),
      supabase.from('students').select('teacher_username, day, class_time'),
    ])
    const counts = {}
    for (const x of s || []) { const key=`${x.teacher_username}_${x.day}_${x.class_time}`; counts[key]=(counts[key]||0)+1 }
    setTeachers(t || []); setGroups(g || []); setStudentCounts(counts); setLoading(false)
  }

  const deleteGroup = async () => {
    if (!selectedGroup) return
    setDeleting(true)
    await supabase.from('groups').delete().eq('id', selectedGroup.id)
    setDeleting(false); setSelectedGroup(null); fetchAll()
  }

  const saveFirstLessonDate = async () => {
    if (!selectedGroup) return
    setSavingDate(true)
    await supabase.from('groups').update({ first_lesson_date: firstLessonInput || null }).eq('id', selectedGroup.id)
    setSavingDate(false)
    setSelectedGroup({ ...selectedGroup, first_lesson_date: firstLessonInput || null })
    fetchAll()
  }

  const teacherName = selectedGroup
    ? (teachers.find(t => t.username === selectedGroup.teacher_username)?.full_name || selectedGroup.teacher_username)
    : ''

  const today = new Date().toISOString().slice(0,10)

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ marginBottom:'24px' }}>
        <h2 style={{ fontSize:'20px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'4px' }}>Groups</h2>
        <p style={{ fontSize:'13px', color:'#94a3b8' }}>
          {readOnly ? 'View all groups and their students.' : 'Click a group to add students, move it, or delete it.'}
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#94a3b8' }}>Loading…</div>
      ) : teachers.map(teacher => {
        const teacherGroups = groups.filter(g => g.teacher_username === teacher.username)
        return (
          <TeacherGrid key={teacher.username} teacher={teacher} groups={teacherGroups}
            studentCounts={studentCounts} readOnly={readOnly}
            onCreateSlot={(t, d, s) => setCreating({ teacher:t, day:d, slot:s })}
            onSelectGroup={setSelectedGroup}
            selectedGroup={selectedGroup}
          />
        )
      })}

      {creating && (
        <CreateGroupModal teacher={creating.teacher} day={creating.day} slot={creating.slot}
          onClose={() => setCreating(null)}
          onCreated={() => { setCreating(null); fetchAll() }} />
      )}

      {moving && selectedGroup && (
        <MoveGroupModal group={selectedGroup} allGroups={groups} teachers={teachers}
          onClose={() => setMoving(false)}
          onMoved={() => { setMoving(false); setSelectedGroup(null); fetchAll() }} />
      )}

      {selectedGroup && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:200 }}
          onClick={e => e.target===e.currentTarget && setSelectedGroup(null)}>
          <div style={{ background:'white', borderRadius:'24px 24px 0 0', padding:'24px', width:'100%', maxWidth:'480px', fontFamily:"'DM Sans',sans-serif", maxHeight:'88vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
              <h3 style={{ fontSize:'18px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D }}>{selectedGroup.level || 'Group'}</h3>
              <button onClick={() => setSelectedGroup(null)} style={{ width:'32px', height:'32px', borderRadius:'8px', background:'#f0f2f1', border:'none', cursor:'pointer', fontSize:'16px' }}>✕</button>
            </div>
            <p style={{ fontSize:'13px', color:'#94a3b8', marginBottom:'24px' }}>
              {teacherName} · {selectedGroup.day==='odd'?'Mon/Wed/Fri':'Tue/Thu/Sat'} · {selectedGroup.class_time}
              {' · '}{studentCounts[`${selectedGroup.teacher_username}_${selectedGroup.day}_${selectedGroup.class_time}`]||0} students
            </p>

            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {/* Add student link — admin only */}
              {!readOnly && (
                <div onClick={() => { setSelectedGroup(null); onNavigate?.('students') }}
                  style={{ display:'flex', alignItems:'center', gap:'14px', padding:'16px', borderRadius:'14px', border:`1.5px solid ${G}`, background:`${G}08`, cursor:'pointer' }}>
                  <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:`${G}20`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize:'15px', fontWeight:'700', color:G, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Add a Student</div>
                    <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px' }}>Enrol a new student into this group</div>
                  </div>
                </div>
              )}

              {/* First lesson date — Beginner only, admin only */}
              {!readOnly && selectedGroup.level === 'Beginner' && (
                <div style={{ padding:'16px', borderRadius:'14px', border:'1.5px solid #f0f2f1', background:'#f8fafb' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                    <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:`${G}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize:'15px', fontWeight:'700', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>First Lesson Date</div>
                      <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px' }}>
                        {selectedGroup.first_lesson_date
                          ? (selectedGroup.first_lesson_date > today ? '⏳ Students are in Starter mode' : '✓ Lessons have started')
                          : 'Not set — students start as full Beginner'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    <input type="date" value={firstLessonInput} onChange={e => setFirstLessonInput(e.target.value)}
                      style={{ flex:1, padding:'11px 14px', borderRadius:'10px', border:'1.5px solid #e4e8e7', fontSize:'14px', color:D, fontFamily:"'DM Sans',sans-serif", outline:'none', background:'white', boxSizing:'border-box' }} />
                    <button onClick={saveFirstLessonDate} disabled={savingDate || firstLessonInput === (selectedGroup.first_lesson_date || '')}
                      style={{ padding:'11px 18px', borderRadius:'10px', border:'none', background:(firstLessonInput === (selectedGroup.first_lesson_date || ''))?'#e4e8e7':G, color:'white', fontSize:'13px', fontWeight:'700', cursor:(firstLessonInput === (selectedGroup.first_lesson_date || ''))?'default':'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif", flexShrink:0 }}>
                      {savingDate ? '…' : 'Save'}
                    </button>
                  </div>
                </div>
              )}

              {/* Move group — admin only */}
              {!readOnly && (
                <button onClick={() => setMoving(true)}
                  style={{ display:'flex', alignItems:'center', gap:'14px', padding:'16px', borderRadius:'14px', border:'1.5px solid #f0f2f1', background:'white', cursor:'pointer', width:'100%', textAlign:'left' }}>
                  <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:`${G}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>
                  </div>
                  <div>
                    <div style={{ fontSize:'15px', fontWeight:'700', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Move to Another Slot</div>
                    <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px' }}>Students &amp; lessons move with the group</div>
                  </div>
                </button>
              )}

              {/* Group info card — always visible */}
              <div style={{ display:'flex', alignItems:'center', gap:'14px', padding:'16px', borderRadius:'14px', border:'1.5px solid #f0f2f1', background:'#f8fafb' }}>
                <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:`${G}15`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div>
                  <div style={{ fontSize:'15px', fontWeight:'700', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                    {studentCounts[`${selectedGroup.teacher_username}_${selectedGroup.day}_${selectedGroup.class_time}`]||0} Students
                  </div>
                  <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px' }}>Enrolled in this group</div>
                </div>
              </div>

              {/* Delete group — admin only */}
              {!readOnly && (
                <button onClick={() => {
                  if (!window.confirm(`Delete the ${selectedGroup.level} group?\n\nStudents won't be deleted but will no longer be linked to this group.`)) return
                  deleteGroup()
                }} disabled={deleting}
                  style={{ display:'flex', alignItems:'center', gap:'14px', padding:'16px', borderRadius:'14px', border:'1.5px solid #fde8e8', background:'#fff5f5', cursor:'pointer', width:'100%' }}>
                  <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:'#fde8e8', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </div>
                  <div style={{ textAlign:'left' }}>
                    <div style={{ fontSize:'15px', fontWeight:'700', color:'#ef4444', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>{deleting?'Deleting…':'Delete Group'}</div>
                    <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px' }}>Students are kept — only the group slot is removed</div>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}