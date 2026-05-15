import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const G  = '#009472'
const D  = '#002b2a'
const OR = '#E8470A'

const LEVEL_ORDER = [
  'Beginner', 'Elementary', 'Pre-Intermediate',
  'Intermediate', 'Upper-Intermediate', 'IELTS Foundation', 'IELTS Proficiency',
]

const HOLIDAY_TYPES = [
  { key: 'public',   label: 'Public Holiday', emoji: '🎉', color: G },
  { key: 'illness',  label: 'Teacher Illness', emoji: '🤒', color: OR },
  { key: 'other',    label: 'Other',            emoji: '📌', color: '#64748b' },
]

// ── PURE HELPERS ─────────────────────────────────────────────────────────────

// Returns all dates in [startDate, endDate] that match the group's odd/even schedule.
// Odd/even is determined by the calendar day number (26 = even, 27 = odd, etc.)
function getGroupDatesInRange(startDate, endDate, groupDay) {
  const dates = []
  const end   = new Date(endDate)
  for (let d = new Date(startDate); d <= end; d.setDate(d.getDate() + 1)) {
    const isEven = d.getDate() % 2 === 0
    if ((groupDay === 'even' && isEven) || (groupDay === 'odd' && !isEven))
      dates.push(new Date(d).toISOString().slice(0, 10))
  }
  return dates
}

// ── DB LOGIC ─────────────────────────────────────────────────────────────────

// Returns the groups affected by a holiday based on its scope.
async function getAffectedGroups(holiday) {
  let query = supabase.from('groups').select('*')
  if (holiday.scope === 'teacher') query = query.eq('teacher_username', holiday.teacher_username)
  else if (holiday.scope === 'group') query = query.eq('id', holiday.group_id)
  const { data } = await query
  return data || []
}

// Builds a level-lesson cache (fetches on demand, never twice for the same level)
async function makeLevelCache() {
  const cache = {}
  return async (level) => {
    if (!cache[level]) {
      const { data } = await supabase
        .from('level_lessons').select('*').eq('level', level).order('lesson_order')
      cache[level] = data || []
    }
    return cache[level]
  }
}

// Re-numbers and renames all lesson rows for a group from `fromDate` onwards,
// starting at lesson order `startOrder`. Handles level-boundary crossings.
async function resequenceGroupLessons(group, fromDate, startOrder) {
  const { data: lessons } = await supabase
    .from('lessons').select('*')
    .eq('teacher_username', group.teacher_username)
    .eq('day',              group.day)
    .eq('class_time',       group.class_time)
    .gte('lesson_date',     fromDate)
    .order('lesson_date')

  if (!lessons?.length) return

  const getLevelLessons = await makeLevelCache()
  const isIELTS = group.level?.startsWith('IELTS')

  let curLevel        = group.level
  let curOrder        = startOrder
  let curLevelLessons = isIELTS ? [] : await getLevelLessons(curLevel)

  for (const lesson of lessons) {
    // Cross level boundary if needed
    if (!isIELTS && curLevelLessons.length > 0) {
      while (curOrder > curLevelLessons.length) {
        const nextIdx = LEVEL_ORDER.indexOf(curLevel) + 1
        if (nextIdx >= LEVEL_ORDER.length) break
        curOrder        -= curLevelLessons.length
        curLevel         = LEVEL_ORDER[nextIdx]
        curLevelLessons  = await getLevelLessons(curLevel)
      }
    }

    const ll    = curLevelLessons.find(l => l.lesson_order === curOrder)
    const title = ll?.lesson_name
      ?? (isIELTS ? `IELTS Lesson ${curOrder}` : `Lesson ${curOrder}`)

    await supabase.from('lessons')
      .update({ lesson_number: curOrder, title })
      .eq('id', lesson.id)

    curOrder++
  }
}

// APPLY: delete lessons that fall in the holiday, then shift the rest back.
async function applyHoliday(holiday) {
  const groups = await getAffectedGroups(holiday)

  for (const group of groups) {
    const { data: affected } = await supabase
      .from('lessons').select('*')
      .eq('teacher_username', group.teacher_username)
      .eq('day',              group.day)
      .eq('class_time',       group.class_time)
      .gte('lesson_date',     holiday.start_date)
      .lte('lesson_date',     holiday.end_date)
      .order('lesson_date')

    if (!affected?.length) continue

    // The first lost lesson's order is where the next available day must continue from
    const firstOrder = affected[0].lesson_number

    // Delete the holiday lesson rows
    await supabase.from('lessons').delete()
      .in('id', affected.map(l => l.id))

    // Re-sequence everything from the day after the holiday
    const dayAfter = new Date(holiday.end_date)
    dayAfter.setDate(dayAfter.getDate() + 1)
    await resequenceGroupLessons(group, dayAfter.toISOString().slice(0, 10), firstOrder)
  }
}

// REMOVE: restore lesson rows for the holiday dates, then re-sequence everything.
async function removeHoliday(holiday) {
  const groups = await getAffectedGroups(holiday)

  for (const group of groups) {
    // What order number should the first restored lesson have?
    const { data: lastBefore } = await supabase
      .from('lessons').select('lesson_number')
      .eq('teacher_username', group.teacher_username)
      .eq('day',              group.day)
      .eq('class_time',       group.class_time)
      .lt('lesson_date',      holiday.start_date)
      .order('lesson_date',   { ascending: false })
      .limit(1)

    const startOrder = lastBefore?.length
      ? lastBefore[0].lesson_number + 1
      : group.current_lesson_order || 1

    // Which dates within the holiday range does this group normally have lessons?
    const datesToRestore = getGroupDatesInRange(
      holiday.start_date, holiday.end_date, group.day
    )
    if (!datesToRestore.length) continue

    // Build lesson rows to insert, with correct order numbers and titles
    const getLevelLessons = await makeLevelCache()
    const isIELTS         = group.level?.startsWith('IELTS')

    let curLevel        = group.level
    let curOrder        = startOrder
    let curLevelLessons = isIELTS ? [] : await getLevelLessons(curLevel)

    const newRows = []
    for (const date of datesToRestore) {
      if (!isIELTS && curLevelLessons.length > 0) {
        while (curOrder > curLevelLessons.length) {
          const nextIdx = LEVEL_ORDER.indexOf(curLevel) + 1
          if (nextIdx >= LEVEL_ORDER.length) break
          curOrder        -= curLevelLessons.length
          curLevel         = LEVEL_ORDER[nextIdx]
          curLevelLessons  = await getLevelLessons(curLevel)
        }
      }

      const ll    = curLevelLessons.find(l => l.lesson_order === curOrder)
      const title = ll?.lesson_name
        ?? (isIELTS ? `IELTS Lesson ${curOrder}` : `Lesson ${curOrder}`)

      newRows.push({
        teacher_username: group.teacher_username,
        day:              group.day,
        class_time:       group.class_time,
        lesson_date:      date,
        lesson_number:    curOrder,
        title,
      })
      curOrder++
    }

    if (newRows.length) await supabase.from('lessons').insert(newRows)

    // Re-sequence all lessons from start_date to fix numbering of future lessons
    await resequenceGroupLessons(group, holiday.start_date, startOrder)
  }
}

// ── HOLIDAY FORM MODAL ────────────────────────────────────────────────────────
function HolidayForm({ holiday, teachers, groups, onSave, onClose }) {
  const [title,    setTitle]    = useState(holiday?.title      || '')
  const [type,     setType]     = useState(holiday?.type       || 'public')
  const [start,    setStart]    = useState(holiday?.start_date || '')
  const [end,      setEnd]      = useState(holiday?.end_date   || '')
  const [scope,    setScope]    = useState(holiday?.scope      || 'all')
  const [teacherU, setTeacherU] = useState(holiday?.teacher_username || '')
  const [groupId,  setGroupId]  = useState(holiday?.group_id   || '')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const filteredGroups = teacherU
    ? groups.filter(g => g.teacher_username === teacherU)
    : groups

  const valid = title.trim() && start && end && end >= start
    && (scope === 'all' || (scope === 'teacher' && teacherU) || (scope === 'group' && groupId))

  const handle = async () => {
    if (!valid) { setError('Please fill in all required fields.'); return }
    setSaving(true); setError('')
    try { await onSave({ title: title.trim(), type, start_date: start, end_date: end, scope, teacher_username: scope === 'teacher' ? teacherU : null, group_id: scope === 'group' ? groupId : null }) }
    catch { setError('Something went wrong. Please try again.') }
    setSaving(false)
  }

  const inputStyle = { width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid #e4e8e7', fontSize: '14px', outline: 'none', color: D, fontFamily: "'DM Sans',sans-serif", boxSizing: 'border-box', background: 'white' }
  const labelStyle = { fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '24px' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
          <h2 style={{ fontSize: '20px', fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: '800', color: D }}>
            {holiday ? 'Edit Holiday' : 'Add Holiday'}
          </h2>
          <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#f0f2f1', border: 'none', cursor: 'pointer', fontSize: '16px' }}>✕</button>
        </div>

        {/* Type selector */}
        <label style={labelStyle}>Type</label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {HOLIDAY_TYPES.map(t => (
            <button key={t.key} onClick={() => setType(t.key)}
              style={{ flex: 1, padding: '10px 8px', borderRadius: '10px', border: `1.5px solid ${type === t.key ? t.color : '#e4e8e7'}`, background: type === t.key ? `${t.color}12` : 'white', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
              <div style={{ fontSize: '18px', marginBottom: '4px' }}>{t.emoji}</div>
              <div style={{ fontSize: '11px', fontWeight: '700', color: type === t.key ? t.color : '#64748b' }}>{t.label}</div>
            </button>
          ))}
        </div>

        {/* Title */}
        <label style={labelStyle}>Title *</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder='e.g. Eid al-Fitr, New Year, Teacher ill…'
          style={{ ...inputStyle, marginBottom: '16px' }} />

        {/* Dates */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={labelStyle}>Start Date *</label>
            <input type="date" value={start} onChange={e => { setStart(e.target.value); if (end && e.target.value > end) setEnd(e.target.value) }}
              style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>End Date *</label>
            <input type="date" value={end} min={start} onChange={e => setEnd(e.target.value)}
              style={inputStyle} />
          </div>
        </div>

        {/* Duration hint */}
        {start && end && (
          <div style={{ background: '#f0faf7', borderRadius: '8px', padding: '8px 12px', marginBottom: '16px', fontSize: '12px', color: G, fontWeight: '600' }}>
            {start === end ? '1 day' : `${Math.round((new Date(end) - new Date(start)) / 86400000) + 1} days`} — {new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} to {new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}

        {/* Scope */}
        <label style={labelStyle}>Applies to *</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          {[
            { val: 'all',     label: 'All groups',              sub: 'Entire center — all teachers and groups' },
            { val: 'teacher', label: "One teacher's groups",    sub: 'All groups of a specific teacher (e.g. teacher is ill)' },
            { val: 'group',   label: 'One specific group',      sub: 'A single class only' },
          ].map(opt => (
            <button key={opt.val} onClick={() => { setScope(opt.val); setTeacherU(''); setGroupId('') }}
              style={{ padding: '12px 14px', borderRadius: '10px', border: `1.5px solid ${scope === opt.val ? G : '#e4e8e7'}`, background: scope === opt.val ? `${G}08` : 'white', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.15s' }}>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${scope === opt.val ? G : '#cbd5e1'}`, background: scope === opt.val ? G : 'white', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {scope === opt.val && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'white' }} />}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: '600', color: scope === opt.val ? G : D }}>{opt.label}</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{opt.sub}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Teacher selector */}
        {scope === 'teacher' && (
          <>
            <label style={labelStyle}>Teacher *</label>
            <select value={teacherU} onChange={e => { setTeacherU(e.target.value); setGroupId('') }}
              style={{ ...inputStyle, marginBottom: '16px' }}>
              <option value="">Select teacher…</option>
              {teachers.map(t => <option key={t.username} value={t.username}>{t.full_name}</option>)}
            </select>
          </>
        )}

        {/* Group selector */}
        {scope === 'group' && (
          <>
            <label style={labelStyle}>Teacher</label>
            <select value={teacherU} onChange={e => { setTeacherU(e.target.value); setGroupId('') }}
              style={{ ...inputStyle, marginBottom: '10px' }}>
              <option value="">All teachers</option>
              {teachers.map(t => <option key={t.username} value={t.username}>{t.full_name}</option>)}
            </select>
            <label style={labelStyle}>Group *</label>
            <select value={groupId} onChange={e => setGroupId(e.target.value)}
              style={{ ...inputStyle, marginBottom: '16px' }}>
              <option value="">Select group…</option>
              {filteredGroups.map(g => (
                <option key={g.id} value={g.id}>
                  {g.level} · {g.day === 'odd' ? 'Mon/Wed/Fri' : 'Tue/Thu/Sat'} · {g.class_time}
                </option>
              ))}
            </select>
          </>
        )}

        {error && <p style={{ fontSize: '13px', color: '#dc2626', marginBottom: '12px', fontWeight: '500' }}>⚠️ {error}</p>}

        {/* Warning */}
        <div style={{ background: '#fff8e6', border: '1px solid #fbbf24', borderRadius: '10px', padding: '10px 14px', marginBottom: '20px', fontSize: '12px', color: '#92400e' }}>
          ⚠️ This will delete lesson rows in the holiday range and shift all future lessons forward. This may take a few seconds.
        </div>

        <button onClick={handle} disabled={!valid || saving}
          style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: valid ? G : '#e4e8e7', color: 'white', fontSize: '15px', fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: '700', cursor: valid ? 'pointer' : 'default', transition: 'all 0.2s' }}>
          {saving ? '⏳ Processing…' : holiday ? '✓ Save Changes' : '✓ Create Holiday'}
        </button>
      </div>
    </div>
  )
}

// ── HOLIDAY CARD ─────────────────────────────────────────────────────────────
function HolidayCard({ holiday, teachers, groups, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false)
  const [confirm,  setConfirm]  = useState(false)
  const today    = new Date().toISOString().slice(0, 10)
  const isActive = holiday.start_date <= today && today <= holiday.end_date
  const isPast   = holiday.end_date < today
  const typeInfo = HOLIDAY_TYPES.find(t => t.key === holiday.type) || HOLIDAY_TYPES[2]

  const scopeLabel = (() => {
    if (holiday.scope === 'all') return 'All groups'
    if (holiday.scope === 'teacher') {
      const t = teachers.find(t => t.username === holiday.teacher_username)
      return t ? `${t.full_name}'s groups` : 'One teacher'
    }
    const g = groups.find(g => g.id === holiday.group_id)
    return g ? `${g.level} · ${g.day === 'odd' ? 'Mon/Wed/Fri' : 'Tue/Thu/Sat'} · ${g.class_time}` : 'One group'
  })()

  const days = Math.round((new Date(holiday.end_date) - new Date(holiday.start_date)) / 86400000) + 1

  const handleDelete = async () => {
    setDeleting(true)
    await removeHoliday(holiday)
    await supabase.from('holidays').delete().eq('id', holiday.id)
    onDelete()
    setDeleting(false)
    setConfirm(false)
  }

  return (
    <div style={{ background: 'white', borderRadius: '16px', border: `1px solid ${isActive ? G + '40' : '#f0f2f1'}`, overflow: 'hidden', boxShadow: isActive ? `0 0 0 2px ${G}20` : '0 2px 8px rgba(0,0,0,0.05)', opacity: isPast ? 0.65 : 1 }}>
      {/* Colored top strip */}
      <div style={{ height: '4px', background: isPast ? '#e4e8e7' : isActive ? G : typeInfo.color }} />

      <div style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: isPast ? '#f0f2f1' : `${typeInfo.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
              {typeInfo.emoji}
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: D, fontFamily: "'Plus Jakarta Sans',sans-serif", marginBottom: '2px' }}>{holiday.title}</div>
              <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <span>📅 {new Date(holiday.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {new Date(holiday.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                <span>· {days} day{days > 1 ? 's' : ''}</span>
                <span>· {scopeLabel}</span>
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px', background: isActive ? `${G}18` : isPast ? '#f0f2f1' : '#fef3e2', color: isActive ? G : isPast ? '#94a3b8' : '#a05a00' }}>
              {isActive ? '● Active' : isPast ? 'Past' : '○ Upcoming'}
            </span>
          </div>
        </div>

        {/* Actions */}
        {!isPast && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px', borderTop: '1px solid #f5f5f5', paddingTop: '12px' }}>
            <button onClick={onEdit}
              style={{ padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #e4e8e7', background: 'white', color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              ✎ Edit
            </button>
            <button onClick={() => setConfirm(true)}
              style={{ padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #fca5a5', background: 'white', color: '#dc2626', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>
              🗑 Delete
            </button>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {confirm && (
        <div style={{ padding: '16px 20px', background: '#fff5f5', borderTop: '1px solid #fecaca' }}>
          <p style={{ fontSize: '13px', color: '#dc2626', fontWeight: '600', marginBottom: '10px' }}>
            ⚠️ This will restore all shifted lessons. Are you sure?
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setConfirm(false)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1.5px solid #e4e8e7', background: 'white', color: '#64748b', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleDelete} disabled={deleting}
              style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#dc2626', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
              {deleting ? 'Restoring…' : 'Yes, delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MAIN SECTION ─────────────────────────────────────────────────────────────
export default function HolidaysSection() {
  const [holidays,  setHolidays]  = useState([])
  const [teachers,  setTeachers]  = useState([])
  const [groups,    setGroups]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [editItem,  setEditItem]  = useState(null)   // holiday being edited

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: h }, { data: t }, { data: g }] = await Promise.all([
      supabase.from('holidays').select('*').order('start_date', { ascending: false }),
      supabase.from('teachers').select('username, full_name').order('full_name'),
      supabase.from('groups').select('*').order('class_time'),
    ])
    setHolidays(h || [])
    setTeachers(t || [])
    setGroups(g   || [])
    setLoading(false)
  }

  // Save = create or update
  const handleSave = async (formData) => {
    if (editItem) {
      // Undo old holiday first, then apply new one
      await removeHoliday(editItem)
      await supabase.from('holidays').update(formData).eq('id', editItem.id)
      const updated = { ...editItem, ...formData }
      await applyHoliday(updated)
    } else {
      const { data } = await supabase.from('holidays').insert(formData).select().single()
      if (data) await applyHoliday(data)
    }
    setShowForm(false)
    setEditItem(null)
    await fetchAll()
  }

  // Partition holidays into sections
  const today     = new Date().toISOString().slice(0, 10)
  const active    = holidays.filter(h => h.start_date <= today && today <= h.end_date)
  const upcoming  = holidays.filter(h => h.start_date  > today)
  const past      = holidays.filter(h => h.end_date    < today)

  const sectionLabel = {
    fontSize: '11px', fontWeight: '700', color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px',
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: `3px solid #e4e8e7`, borderTop: `3px solid ${G}`, animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ maxWidth: '720px', fontFamily: "'DM Sans',sans-serif" }}>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <p style={{ fontSize: '14px', color: '#64748b', marginTop: '2px' }}>
            {holidays.length === 0 ? 'No holidays recorded yet.' : `${upcoming.length} upcoming · ${active.length} active · ${past.length} past`}
          </p>
        </div>
        <button onClick={() => { setEditItem(null); setShowForm(true) }}
          style={{ padding: '12px 20px', borderRadius: '12px', border: 'none', background: G, color: 'white', fontSize: '14px', fontFamily: "'Plus Jakarta Sans',sans-serif", fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(0,148,114,0.3)' }}>
          + Add Holiday
        </button>
      </div>

      {/* Active */}
      {active.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <p style={{ ...sectionLabel, color: G }}>● Active now</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {active.map(h => (
              <HolidayCard key={h.id} holiday={h} teachers={teachers} groups={groups}
                onEdit={() => { setEditItem(h); setShowForm(true) }}
                onDelete={fetchAll} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <p style={sectionLabel}>Upcoming</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[...upcoming].reverse().map(h => (
              <HolidayCard key={h.id} holiday={h} teachers={teachers} groups={groups}
                onEdit={() => { setEditItem(h); setShowForm(true) }}
                onDelete={fetchAll} />
            ))}
          </div>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <p style={sectionLabel}>Past</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {past.slice(0, 5).map(h => (
              <HolidayCard key={h.id} holiday={h} teachers={teachers} groups={groups}
                onEdit={() => {}} onDelete={fetchAll} />
            ))}
            {past.length > 5 && (
              <p style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '8px' }}>+ {past.length - 5} more past holidays</p>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {holidays.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 24px', background: 'white', borderRadius: '16px', border: '1px solid #f0f2f1' }}>
          <div style={{ fontSize: '52px', marginBottom: '14px' }}>🗓</div>
          <div style={{ fontSize: '18px', fontWeight: '700', color: D, fontFamily: "'Plus Jakarta Sans',sans-serif", marginBottom: '6px' }}>No holidays yet</div>
          <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '24px' }}>Add a holiday and all affected lessons will be shifted automatically.</div>
          <button onClick={() => setShowForm(true)}
            style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', background: G, color: 'white', fontSize: '14px', fontWeight: '700', cursor: 'pointer', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
            + Add First Holiday
          </button>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <HolidayForm
          holiday={editItem}
          teachers={teachers}
          groups={groups}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null) }}
        />
      )}
    </div>
  )
}