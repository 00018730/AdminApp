import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const G    = '#009472'
const DARK = '#002b2a'

const LEVELS = ['Elementary','Pre-Intermediate','Intermediate','Upper-Intermediate']
const UNITS  = [1,2,3,4,5,6,7,8,9]

const SECTIONS = [
  { id:'grammar',        label:'Grammar' },
  { id:'vocabulary',     label:'Vocabulary' },
  { id:'use_of_english', label:'Use of English' },
  { id:'listening',      label:'Listening' },
  { id:'reading',        label:'Reading' },
  { id:'writing',        label:'Writing' },
]

const QUESTION_TYPES = {
  grammar: [
    { id:'fill_blank',     label:'Fill in the blank (verb form)' },
    { id:'dialogue_fill',  label:'Dialogue fill (numbered blanks in conversation)' },
    { id:'word_bank',      label:'Fill from word bank' },
    { id:'find_mistake',   label:'Find the mistake / rewrite' },
    { id:'rewrite',        label:'Rewrite sentence (word given)' },
    { id:'match_halves',   label:'Match sentence halves' },
    { id:'tick_correct',   label:'Tick correct / fix wrong' },
    { id:'fill_one_word',  label:'Fill one word (no bank)' },
  ],
  vocabulary: [
    { id:'word_bank',         label:'Fill from word bank' },
    { id:'circle_word',       label:'Circle correct word (2 options)' },
    { id:'find_mistake',      label:'Find the mistake' },
    { id:'match_quote',       label:'Match quote to word' },
    { id:'fill_blank',        label:'Fill in the blank' },
    { id:'match_halves',      label:'Match sentence halves' },
    { id:'word_spell_match',  label:'Spell word from dashes + match to adjective' },
  ],
  use_of_english: [
    { id:'mcq_abc',      label:'Multiple choice A/B/C (text passage)' },
    { id:'fill_one_word',label:'Fill one word per gap (dialogue)' },
    { id:'find_mistake', label:'Find mistakes in dialogue' },
  ],
  listening: [
    { id:'listening_match', label:'Match speakers to statements' },
    { id:'listening_mcq',   label:'Multiple choice A/B/C' },
    { id:'true_false',      label:'True / False (with audio)' },
  ],
  reading: [
    { id:'true_false',    label:'True / False' },
    { id:'reading_gap',   label:'Match sentences to gaps' },
    { id:'reading_match', label:'Match texts to statements' },
  ],
  writing: [
    { id:'writing', label:'Essay / Email prompt' },
  ],
}

const TYPE_MARKS = {
  fill_blank:1, word_bank:1, find_mistake:1, rewrite:1, match_halves:1,
  tick_correct:1, fill_one_word:1, circle_word:1, match_quote:1,
  mcq_abc:1, listening_match:1, listening_mcq:1, true_false:1,
  reading_gap:1, reading_match:1, writing:10,
  dialogue_fill:1, word_spell_match:2,
}

// ── SMALL UI HELPERS ──────────────────────────────────────────────────────────
function Badge({ children, color = G }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', padding:'3px 10px', borderRadius:'20px',
      background:`${color}15`, color, fontSize:'11px', fontWeight:'700', letterSpacing:'0.03em' }}>
      {children}
    </span>
  )
}

function Btn({ children, onClick, variant='primary', disabled=false, small=false }) {
  const base = { border:'none', borderRadius:'10px', fontFamily:"'DM Sans',sans-serif",
    fontWeight:'700', cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.45 : 1, transition:'all 0.15s',
    padding: small ? '7px 14px' : '11px 20px',
    fontSize: small ? '12px' : '14px' }
  const styles = {
    primary:  { ...base, background:G, color:'white' },
    secondary:{ ...base, background:'#f0f2f1', color:DARK },
    danger:   { ...base, background:'#fef2f2', color:'#dc2626' },
    ghost:    { ...base, background:'transparent', color:G, border:`1.5px solid ${G}30` },
  }
  return <button onClick={disabled ? undefined : onClick} style={styles[variant]}>{children}</button>
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:'14px' }}>
      <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#64748b',
        textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px' }}>{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, multiline=false, rows=2 }) {
  const s = { width:'100%', padding:'10px 13px', borderRadius:'10px',
    border:'1.5px solid #e4e8e7', fontSize:'14px', color:DARK, outline:'none',
    fontFamily:"'DM Sans',sans-serif", boxSizing:'border-box', resize:'vertical',
    background:'white', lineHeight:1.5 }
  return multiline
    ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={s} />
    : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={s} />
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width:'100%', padding:'10px 13px', borderRadius:'10px', border:'1.5px solid #e4e8e7',
        fontSize:'14px', color:DARK, outline:'none', fontFamily:"'DM Sans',sans-serif",
        background:'white', cursor:'pointer', boxSizing:'border-box' }}>
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  )
}

// ── QUESTION EDITORS ──────────────────────────────────────────────────────────

// Generic question row wrapper
function QRow({ num, onRemove, children }) {
  return (
    <div style={{ background:'#f8fafb', borderRadius:'12px', padding:'14px 16px',
      border:'1px solid #f0f2f1', marginBottom:'10px', position:'relative' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
        <span style={{ fontSize:'12px', fontWeight:'700', color:'#94a3b8' }}>#{num}</span>
        <button onClick={onRemove} style={{ background:'none', border:'none', cursor:'pointer',
          color:'#ef4444', fontSize:'18px', lineHeight:1, padding:'0 4px' }}>×</button>
      </div>
      {children}
    </div>
  )
}

function FillBlankEditor({ q, onChange }) {
  return (
    <>
      <Field label="Sentence (use ___ for blank)">
        <Input value={q.question_text||''} onChange={v => onChange({...q, question_text:v})}
          placeholder="e.g. You always ___ (arrive) at school early." />
      </Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
        <Field label="Correct answer">
          <Input value={q.correct||''} onChange={v => onChange({...q, correct:v})}
            placeholder="e.g. are arriving" />
        </Field>
        <Field label="Hint (shown in brackets)">
          <Input value={q.hint||''} onChange={v => onChange({...q, hint:v})}
            placeholder="e.g. arrive" />
        </Field>
      </div>
    </>
  )
}

function WordBankEditor({ q, onChange, bankWords, onBankChange }) {
  return (
    <>
      {bankWords !== undefined && (
        <Field label="Word bank (comma-separated)">
          <Input value={bankWords} onChange={onBankChange}
            placeholder="e.g. do, know, make, play, rain, try, visit" />
        </Field>
      )}
      <Field label="Sentence (use ___ for blank)">
        <Input value={q.question_text||''} onChange={v => onChange({...q, question_text:v})}
          placeholder="e.g. What ___ you do at the moment?" />
      </Field>
      <Field label="Correct answer">
        <Input value={q.correct||''} onChange={v => onChange({...q, correct:v})}
          placeholder="e.g. are" />
      </Field>
    </>
  )
}

function CircleWordEditor({ q, onChange }) {
  return (
    <>
      <Field label="Sentence (use ___ for blank position)">
        <Input value={q.question_text||''} onChange={v => onChange({...q, question_text:v})}
          placeholder="e.g. There are loads of ___ at the sale." />
      </Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
        <Field label="Option A">
          <Input value={q.option_a||''} onChange={v => onChange({...q, option_a:v})}
            placeholder="e.g. bargains" />
        </Field>
        <Field label="Option B">
          <Input value={q.option_b||''} onChange={v => onChange({...q, option_b:v})}
            placeholder="e.g. price tags" />
        </Field>
      </div>
      <Field label="Correct (A or B)">
        <Select value={q.correct||'A'} onChange={v => onChange({...q, correct:v})}
          options={[{value:'A',label:'Option A'},{value:'B',label:'Option B'}]} />
      </Field>
    </>
  )
}

function McqAbcEditor({ q, onChange }) {
  return (
    <>
      <Field label="Question / gap context">
        <Input value={q.question_text||''} onChange={v => onChange({...q, question_text:v})}
          placeholder="e.g. Gap number or short context" />
      </Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
        <Field label="A">
          <Input value={q.option_a||''} onChange={v => onChange({...q, option_a:v})} placeholder="Option A" />
        </Field>
        <Field label="B">
          <Input value={q.option_b||''} onChange={v => onChange({...q, option_b:v})} placeholder="Option B" />
        </Field>
        <Field label="C">
          <Input value={q.option_c||''} onChange={v => onChange({...q, option_c:v})} placeholder="Option C" />
        </Field>
      </div>
      <Field label="Correct answer">
        <Select value={q.correct||'A'} onChange={v => onChange({...q, correct:v})}
          options={[{value:'A',label:'A'},{value:'B',label:'B'},{value:'C',label:'C'}]} />
      </Field>
    </>
  )
}

function FindMistakeEditor({ q, onChange }) {
  return (
    <>
      <Field label="Sentence with mistake">
        <Input value={q.question_text||''} onChange={v => onChange({...q, question_text:v})}
          placeholder="e.g. Are you believing me?" />
      </Field>
      <Field label="Correct rewrite / correction">
        <Input value={q.correct||''} onChange={v => onChange({...q, correct:v})}
          placeholder="e.g. Do you believe me?" />
      </Field>
    </>
  )
}

function RewriteEditor({ q, onChange }) {
  return (
    <>
      <Field label="Original sentences (one per line)">
        <Input value={q.question_text||''} onChange={v => onChange({...q, question_text:v})}
          multiline rows={3} placeholder="e.g. Tina left her credit card at home. She wanted to buy a dress. (but)" />
      </Field>
      <Field label="Accepted answer (for AI reference)">
        <Input value={q.correct||''} onChange={v => onChange({...q, correct:v})}
          placeholder="e.g. Tina had left her credit card at home, but she wanted to buy a dress." />
      </Field>
    </>
  )
}

function MatchHalvesEditor({ q, onChange }) {
  // correct stored as JSON: {"left":"...","right":"...","letter":"A"}
  let parsed = { left:'', right:'', letter:'' }
  try { parsed = JSON.parse(q.correct||'{}') } catch {}
  const update = (k, v) => onChange({...q, correct: JSON.stringify({...parsed, [k]:v})})

  return (
    <>
      <Field label="Left half (sentence beginning)">
        <Input value={q.question_text||''} onChange={v => onChange({...q, question_text:v})}
          placeholder="e.g. If I lived in Australia," />
      </Field>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'10px' }}>
        <Field label="Right half (matching end)">
          <Input value={parsed.right||''} onChange={v => update('right', v)}
            placeholder="e.g. I would go surfing every day." />
        </Field>
        <Field label="Match letter">
          <Input value={parsed.letter||''} onChange={v => update('letter', v)}
            placeholder="e.g. I" />
        </Field>
      </div>
    </>
  )
}

function TrueFalseEditor({ q, onChange }) {
  return (
    <>
      <Field label="Statement">
        <Input value={q.question_text||''} onChange={v => onChange({...q, question_text:v})}
          placeholder="e.g. CalAid is a charity for people who have left their homes." />
      </Field>
      <Field label="Correct answer">
        <Select value={q.correct||'T'} onChange={v => onChange({...q, correct:v})}
          options={[{value:'T',label:'True (T)'},{value:'F',label:'False (F)'}]} />
      </Field>
    </>
  )
}

function ListeningMatchEditor({ q, onChange }) {
  // correct = speaker number, question_text = statement text, hint = letter (A-E)
  return (
    <>
      <Field label="Statement letter (A, B, C, D, or E)">
        <Input value={q.hint||''} onChange={v => onChange({...q, hint:v})}
          placeholder="e.g. A" />
      </Field>
      <Field label="Statement text">
        <Input value={q.question_text||''} onChange={v => onChange({...q, question_text:v})}
          placeholder="e.g. would prefer not to work for too many years." />
      </Field>
      <Field label="Correct speaker number">
        <Input value={q.correct||''} onChange={v => onChange({...q, correct:v})}
          placeholder="e.g. 3" />
      </Field>
    </>
  )
}

function ReadingGapEditor({ q, onChange }) {
  // question_text = sentence, hint = gap number, correct = letter
  return (
    <>
      <Field label="Sentence (option to place in gap)">
        <Input value={q.question_text||''} onChange={v => onChange({...q, question_text:v})}
          placeholder="e.g. At the same time, more people had freezers." />
      </Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
        <Field label="Option letter">
          <Input value={q.hint||''} onChange={v => onChange({...q, hint:v})}
            placeholder="e.g. E" />
        </Field>
        <Field label="Correct gap number">
          <Input value={q.correct||''} onChange={v => onChange({...q, correct:v})}
            placeholder="e.g. 2" />
        </Field>
      </div>
    </>
  )
}

function ReadingMatchEditor({ q, onChange }) {
  // question_text = statement, correct = text letter (A/B/C/D)
  return (
    <>
      <Field label="Statement">
        <Input value={q.question_text||''} onChange={v => onChange({...q, question_text:v})}
          placeholder="e.g. easy ways to make things." />
      </Field>
      <Field label="Correct text (A, B, C, D…)">
        <Input value={q.correct||''} onChange={v => onChange({...q, correct:v})}
          placeholder="e.g. B" />
      </Field>
    </>
  )
}

function MatchQuoteEditor({ q, onChange }) {
  return (
    <>
      <Field label="Quote">
        <Input value={q.question_text||''} onChange={v => onChange({...q, question_text:v})}
          placeholder="e.g. Can you give me one of those to put my head on?" />
      </Field>
      <Field label="Correct word / answer">
        <Input value={q.correct||''} onChange={v => onChange({...q, correct:v})}
          placeholder="e.g. pillow" />
      </Field>
    </>
  )
}

function FillOneWordEditor({ q, onChange }) {
  return (
    <>
      <Field label="Sentence (use ___ for blank, number it)">
        <Input value={q.question_text||''} onChange={v => onChange({...q, question_text:v})}
          placeholder="e.g. Photo A is of a houseboat, 1___ photo B shows a flat." />
      </Field>
      <Field label="Correct word">
        <Input value={q.correct||''} onChange={v => onChange({...q, correct:v})}
          placeholder="e.g. while" />
      </Field>
    </>
  )
}

function TickCorrectEditor({ q, onChange }) {
  return (
    <>
      <Field label="Sentence">
        <Input value={q.question_text||''} onChange={v => onChange({...q, question_text:v})}
          placeholder="e.g. We finished our homework more quickly than we expected." />
      </Field>
      <Field label="Is this sentence correct?">
        <Select value={q.hint||'correct'} onChange={v => onChange({...q, hint:v})}
          options={[{value:'correct',label:'✓ Correct'},{value:'wrong',label:'✗ Wrong'}]} />
      </Field>
      {q.hint === 'wrong' && (
        <Field label="Corrected version">
          <Input value={q.correct||''} onChange={v => onChange({...q, correct:v})}
            placeholder="e.g. It'll cost us less money to buy the concert tickets online." />
        </Field>
      )}
    </>
  )
}

function WritingEditor({ q, onChange }) {
  return (
    <>
      <Field label="Writing prompt / instructions">
        <Input value={q.question_text||''} onChange={v => onChange({...q, question_text:v})}
          multiline rows={5}
          placeholder="e.g. Write an email to a friend describing your visit to a historic house. Include:&#10;• When it was built and who lived there&#10;• Describe the location and size&#10;• Describe two interesting rooms" />
      </Field>
    </>
  )
}

// ── DIALOGUE FILL EDITOR ─────────────────────────────────────────────────────
// Counts ___ occurrences in the sentence and auto-generates that many answer fields
function DialogueFillEditor({ q, onChange }) {
  let answers = []
  try { answers = JSON.parse(q.correct || '[]') } catch {}
  const isNewDialogue = q.option_b === 'true'

  // Count blanks in the current sentence
  const blankCount = (q.question_text || '').split('___').length - 1

  // When sentence changes, resize answers array to match blank count
  const handleSentenceChange = (v) => {
    const count = v.split('___').length - 1
    const current = [...answers]
    let next
    if (count > current.length) {
      next = [...current, ...Array(count - current.length).fill('')]
    } else {
      next = current.slice(0, count)
    }
    onChange({ ...q, question_text: v, correct: JSON.stringify(next) })
  }

  const updateAnswer = (i, val) => {
    const next = [...answers]; next[i] = val
    onChange({ ...q, correct: JSON.stringify(next) })
  }

  return (
    <>
      {/* New dialogue toggle */}
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px',
        padding:'8px 12px', background: isNewDialogue ? '#f0faf7' : '#f8fafb',
        borderRadius:'8px', border:`1.5px solid ${isNewDialogue ? G : '#e4e8e7'}`,
        cursor:'pointer' }}
        onClick={() => onChange({...q, option_b: isNewDialogue ? 'false' : 'true'})}>
        <div style={{ width:'18px', height:'18px', borderRadius:'4px', flexShrink:0,
          background: isNewDialogue ? G : 'white',
          border: `2px solid ${isNewDialogue ? G : '#cbd5e1'}`,
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          {isNewDialogue && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
        </div>
        <span style={{ fontSize:'12px', fontWeight:'700', color: isNewDialogue ? G : '#64748b' }}>
          New dialogue — show separator line above this line
        </span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'60px 1fr', gap:'10px' }}>
        <Field label="Speaker">
          <Input value={q.hint||''} onChange={v => onChange({...q, hint:v})} placeholder="A / B" />
        </Field>
        <Field label="Line (use 1___, 2___, … for blanks; verb hint in brackets)">
          <Input value={q.question_text||''} onChange={handleSentenceChange}
            placeholder="e.g. 1___ (you / use) your smartphone in English lessons?" />
        </Field>
      </div>

      {/* Auto-generated answer fields — one per ___ in the sentence */}
      {blankCount > 0 && (
        <div style={{ marginTop:'10px' }}>
          <label style={{ display:'block', fontSize:'11px', fontWeight:'700', color:'#64748b',
            textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>
            Correct answers — {blankCount} blank{blankCount !== 1 ? 's' : ''} detected
          </label>
          {Array.from({ length: blankCount }).map((_, i) => (
            <div key={i} style={{ display:'flex', gap:'10px', marginBottom:'8px', alignItems:'center' }}>
              <div style={{ width:'28px', height:'28px', borderRadius:'50%', flexShrink:0,
                background:`${G}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:'11px', fontWeight:'800', color:G }}>{i+1}</span>
              </div>
              <input
                value={answers[i] || ''}
                onChange={e => updateAnswer(i, e.target.value)}
                placeholder={`Answer for blank ${i+1}`}
                style={{ flex:1, padding:'9px 13px', borderRadius:'9px',
                  border:`1.5px solid ${answers[i] ? G+'60' : '#e4e8e7'}`,
                  fontSize:'13px', color:DARK, outline:'none',
                  fontFamily:"'DM Sans',sans-serif",
                  background: answers[i] ? '#f0faf7' : 'white',
                  transition:'border 0.15s, background 0.15s' }} />
            </div>
          ))}
        </div>
      )}

      {blankCount === 0 && q.question_text && (
        <div style={{ marginTop:'8px', fontSize:'12px', color:'#f59e0b', fontWeight:'600' }}>
          No blanks detected — add ___ to the sentence above
        </div>
      )}
    </>
  )
}

// ── WORD SPELL MATCH EDITOR ───────────────────────────────────────────────────
function WordSpellMatchEditor({ q, onChange, adjList, onAdjListChange }) {
  let parsed = { word:'', adjective:'' }
  try { parsed = JSON.parse(q.correct || '{}') } catch {}
  const update = (k, v) => onChange({ ...q, correct: JSON.stringify({ ...parsed, [k]: v }) })
  return (
    <>
      <Field label="Description (what the student reads)">
        <Input value={q.question_text||''} onChange={v => onChange({...q, question_text:v})}
          placeholder="e.g. mum's mother" />
      </Field>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
        <Field label="Correct word to spell">
          <Input value={parsed.word||''} onChange={v => update('word', v)}
            placeholder="e.g. grandmother" />
        </Field>
        <Field label="Correct adjective to match">
          <Input value={parsed.adjective||''} onChange={v => update('adjective', v)}
            placeholder="e.g. hard-working" />
        </Field>
      </div>
      {adjList !== undefined && (
        <Field label="Adjective bank (comma-separated, shown above all questions)">
          <Input value={adjList} onChange={onAdjListChange}
            placeholder="e.g. creative, friendly, hard-working, patient, sensible" />
        </Field>
      )}
    </>
  )
}

function QuestionEditor({ type, q, onChange, bankWords, onBankChange, adjList, onAdjListChange }) {
  switch(type) {
    case 'fill_blank':       return <FillBlankEditor q={q} onChange={onChange} />
    case 'dialogue_fill':    return <DialogueFillEditor q={q} onChange={onChange} />
    case 'word_bank':        return <WordBankEditor q={q} onChange={onChange} bankWords={bankWords} onBankChange={onBankChange} />
    case 'circle_word':      return <CircleWordEditor q={q} onChange={onChange} />
    case 'mcq_abc':          return <McqAbcEditor q={q} onChange={onChange} />
    case 'find_mistake':     return <FindMistakeEditor q={q} onChange={onChange} />
    case 'rewrite':          return <RewriteEditor q={q} onChange={onChange} />
    case 'match_halves':     return <MatchHalvesEditor q={q} onChange={onChange} />
    case 'true_false':       return <TrueFalseEditor q={q} onChange={onChange} />
    case 'listening_match':  return <ListeningMatchEditor q={q} onChange={onChange} />
    case 'listening_mcq':    return <McqAbcEditor q={q} onChange={onChange} />
    case 'reading_gap':      return <ReadingGapEditor q={q} onChange={onChange} />
    case 'reading_match':    return <ReadingMatchEditor q={q} onChange={onChange} />
    case 'match_quote':      return <MatchQuoteEditor q={q} onChange={onChange} />
    case 'fill_one_word':    return <FillOneWordEditor q={q} onChange={onChange} />
    case 'tick_correct':     return <TickCorrectEditor q={q} onChange={onChange} />
    case 'word_spell_match': return <WordSpellMatchEditor q={q} onChange={onChange} adjList={adjList} onAdjListChange={onAdjListChange} />
    case 'writing':          return <WritingEditor q={q} onChange={onChange} />
    default:                 return null
  }
}

// ── EXERCISE BUILDER MODAL ────────────────────────────────────────────────────
function ExerciseModal({ testId, exerciseNum, sectionId, onSave, onClose, existing }) {
  const [section,  setSection]  = useState(existing?.section       || sectionId || 'grammar')
  const [qtype,    setQtype]    = useState(existing?.question_type || '')
  const [instr,    setInstr]    = useState(existing?.instruction   || '')
  const [marks,    setMarks]    = useState(existing?.marks         || 1)
  const [passage,  setPassage]  = useState(existing?.passage       || '')
  const [audioUrl, setAudioUrl] = useState(existing?.audio_url     || '')
  const [bankWords,setBankWords]= useState('')
  const [adjList,  setAdjList]  = useState('')
  const [questions,setQuestions]= useState([])
  const [saving,   setSaving]   = useState(false)
  const [loadingQ, setLoadingQ] = useState(false)

  const needsPassage = ['mcq_abc','fill_one_word','find_mistake','true_false','reading_gap','reading_match'].includes(qtype)
  const needsAudio   = ['listening_match','listening_mcq'].includes(qtype)
  const needsBank    = qtype === 'word_bank'
  const needsAdjList = qtype === 'word_spell_match'
  const needsDialogue = qtype === 'dialogue_fill'
  const isWriting    = qtype === 'writing'

  useEffect(() => {
    if (existing?.id) {
      setLoadingQ(true)
      supabase.from('progress_test_questions').select('*')
        .eq('exercise_id', existing.id).order('order_num')
        .then(({ data }) => {
          if (data?.length) {
            setQuestions(data)
            // extract bank words from first question hint if word_bank
            if (existing.question_type === 'word_bank' && data[0]?.option_a) {
              setBankWords(data[0].option_a)
            }
            if (existing.question_type === 'word_spell_match' && data[0]?.option_a) {
              setAdjList(data[0].option_a)
            }
          }
          setLoadingQ(false)
        })
    }
  }, [existing?.id])

  const addQuestion = () => {
    setQuestions(qs => [...qs, {
      id: `new_${Date.now()}`, order_num: qs.length + 1,
      question_text:'', option_a:'', option_b:'', option_c:'',
      correct:'', hint:''
    }])
  }

  const updateQuestion = (idx, updated) => {
    setQuestions(qs => qs.map((q,i) => i===idx ? updated : q))
  }

  const removeQuestion = (idx) => {
    setQuestions(qs => qs.filter((_,i) => i!==idx).map((q,i) => ({...q, order_num:i+1})))
  }

  const save = async () => {
    if (!qtype) return
    setSaving(true)
    try {
      let exId = existing?.id
      const exPayload = {
        test_id: testId, section, exercise_num: exerciseNum,
        question_type: qtype, instruction: instr,
        marks: isWriting ? marks
          : needsDialogue ? questions.reduce((s,q) => { try { return s + JSON.parse(q.correct||'[]').length } catch { return s } }, 0)
          : needsAdjList  ? questions.length * 2
          : questions.length * (TYPE_MARKS[qtype]||1),
        passage: needsPassage ? passage : null,
        audio_url: needsAudio ? audioUrl : null,
      }

      if (exId) {
        await supabase.from('progress_test_exercises').update(exPayload).eq('id', exId)
        await supabase.from('progress_test_questions').delete().eq('exercise_id', exId)
      } else {
        const { data } = await supabase.from('progress_test_exercises').insert(exPayload).select().single()
        exId = data.id
      }

      // Insert questions (for writing, just one row with the prompt)
      const rows = isWriting
        ? [{ exercise_id:exId, order_num:1, question_text:questions[0]?.question_text||'', correct:'', hint:'', option_a:'', option_b:'', option_c:'' }]
        : questions.map((q, i) => ({
            exercise_id: exId, order_num: i+1,
            question_text: q.question_text||'',
            option_a: needsBank ? bankWords : needsAdjList ? adjList : (q.option_a||''),
            option_b: q.option_b||'',
            option_c: q.option_c||'',
            correct:  q.correct||'',
            hint:     q.hint||'',
          }))

      if (rows.length > 0) {
        await supabase.from('progress_test_questions').insert(rows)
      }

      onSave()
    } catch(e) {
      console.error(e)
    }
    setSaving(false)
  }

  const types = QUESTION_TYPES[section] || []

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex',
      alignItems:'flex-start', justifyContent:'center', zIndex:200, overflowY:'auto', padding:'32px 16px' }}>
      <div style={{ background:'white', borderRadius:'20px', width:'100%', maxWidth:'680px',
        boxShadow:'0 24px 80px rgba(0,0,0,0.2)', fontFamily:"'DM Sans',sans-serif" }}>

        {/* Header */}
        <div style={{ padding:'24px 28px 20px', borderBottom:'1px solid #f0f2f1',
          display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:'18px', fontFamily:"'Plus Jakarta Sans',sans-serif",
              fontWeight:'800', color:DARK }}>
              {existing ? 'Edit Exercise' : 'New Exercise'}
            </div>
            <div style={{ fontSize:'12px', color:'#94a3b8', marginTop:'2px' }}>
              Exercise #{exerciseNum}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer',
            fontSize:'22px', color:'#94a3b8', lineHeight:1 }}>×</button>
        </div>

        <div style={{ padding:'24px 28px' }}>
          {/* Section + type */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px', marginBottom:'4px' }}>
            <Field label="Section">
              <Select value={section} onChange={v => { setSection(v); setQtype('') }}
                options={SECTIONS.map(s => ({ value:s.id, label:s.label }))} />
            </Field>
            <Field label="Question type">
              <Select value={qtype} onChange={setQtype}
                options={[{ value:'', label:'— Select type —' }, ...types.map(t => ({ value:t.id, label:t.label }))]} />
            </Field>
          </div>

          <Field label="Instruction (shown to student)">
            <Input value={instr} onChange={setInstr}
              placeholder="e.g. Complete the sentences using the correct form of the verb in brackets." />
          </Field>

          {/* Passage */}
          {needsPassage && (
            <Field label="Text / Passage / Dialogue">
              <Input value={passage} onChange={setPassage} multiline rows={6}
                placeholder="Paste the reading text, dialogue, or passage here…" />
            </Field>
          )}

          {/* Audio */}
          {needsAudio && (
            <Field label="Audio file URL (from Supabase Storage)">
              <Input value={audioUrl} onChange={setAudioUrl}
                placeholder="https://…supabase.co/storage/v1/object/public/audio/track7.wav" />
            </Field>
          )}

          {/* Writing marks */}
          {isWriting && (
            <Field label="Max marks">
              <input type="number" value={marks} onChange={e => setMarks(Number(e.target.value))}
                style={{ width:'100px', padding:'10px 13px', borderRadius:'10px',
                  border:'1.5px solid #e4e8e7', fontSize:'14px', color:DARK, outline:'none' }} />
            </Field>
          )}

          {/* Word bank (shared across all questions) */}
          {needsBank && qtype && (
            <Field label="Word bank (comma-separated, shown above questions)">
              <Input value={bankWords} onChange={setBankWords}
                placeholder="e.g. do, know, make, play, rain, try, visit" />
            </Field>
          )}

          {/* Questions */}
          {qtype && !isWriting && (
            <div style={{ marginTop:'16px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                <span style={{ fontSize:'13px', fontWeight:'700', color:DARK }}>
                  Questions <Badge>{questions.length}</Badge>
                </span>
                <Btn small onClick={addQuestion} variant="ghost">+ Add question</Btn>
              </div>

              {loadingQ ? (
                <div style={{ textAlign:'center', padding:'20px', color:'#94a3b8', fontSize:'13px' }}>Loading…</div>
              ) : questions.length === 0 ? (
                <div style={{ textAlign:'center', padding:'24px', background:'#f8fafb',
                  borderRadius:'12px', color:'#94a3b8', fontSize:'13px', border:'1.5px dashed #e4e8e7' }}>
                  No questions yet — click "+ Add question" to start
                </div>
              ) : (
                questions.map((q, i) => (
                  <QRow key={q.id||i} num={i+1} onRemove={() => removeQuestion(i)}>
                    <QuestionEditor
                      type={qtype} q={q}
                      onChange={updated => updateQuestion(i, updated)}
                      bankWords={needsBank ? bankWords : undefined}
                      onBankChange={needsBank ? setBankWords : undefined}
                      adjList={needsAdjList ? adjList : undefined}
                      onAdjListChange={needsAdjList ? setAdjList : undefined}
                    />
                  </QRow>
                ))
              )}
            </div>
          )}

          {/* Writing prompt */}
          {qtype === 'writing' && (
            <div style={{ marginTop:'16px' }}>
              <WritingEditor
                q={questions[0] || { question_text:'' }}
                onChange={updated => setQuestions([updated])}
              />
            </div>
          )}

          {/* Summary */}
          {qtype && (
            <div style={{ background:`${G}08`, borderRadius:'10px', padding:'12px 16px',
              marginTop:'16px', fontSize:'13px', color:'#64748b' }}>
              {isWriting
                ? `This exercise is worth ${marks} marks (AI graded).`
                : needsDialogue
                ? `${questions.length} dialogue line${questions.length!==1?'s':''} — marks auto-calculated from total blanks`
                : needsAdjList
                ? `${questions.length} item${questions.length!==1?'s':''} × 2 marks (1 spelling + 1 matching) = ${questions.length * 2} marks`
                : `${questions.length} question${questions.length!==1?'s':''} × ${TYPE_MARKS[qtype]||1} mark = ${questions.length * (TYPE_MARKS[qtype]||1)} marks`
              }
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:'16px 28px 24px', display:'flex', justifyContent:'flex-end', gap:'10px',
          borderTop:'1px solid #f0f2f1' }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn onClick={save} disabled={saving || !qtype}>
            {saving ? 'Saving…' : existing ? 'Update Exercise' : 'Save Exercise'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

// ── EXERCISE CARD ─────────────────────────────────────────────────────────────
function ExerciseCard({ ex, qCount, onEdit, onDelete }) {
  const sectionColors = {
    grammar:'#6366f1', vocabulary:'#f59e0b', use_of_english:'#ec4899',
    listening:'#3b82f6', reading:'#10b981', writing:'#f97316',
  }
  const color = sectionColors[ex.section] || G

  const typeLabel = Object.values(QUESTION_TYPES).flat().find(t => t.id === ex.question_type)?.label || ex.question_type

  return (
    <div style={{ background:'white', borderRadius:'14px', padding:'18px 20px',
      border:'1.5px solid #f0f2f1', display:'flex', alignItems:'flex-start',
      gap:'14px', boxShadow:'0 2px 6px rgba(0,0,0,0.04)' }}>
      <div style={{ width:'40px', height:'40px', borderRadius:'10px', flexShrink:0,
        background:`${color}15`, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <span style={{ fontSize:'12px', fontWeight:'800', color }}>{ex.exercise_num}</span>
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px', flexWrap:'wrap' }}>
          <Badge color={color}>{SECTIONS.find(s => s.id===ex.section)?.label || ex.section}</Badge>
          <span style={{ fontSize:'12px', color:'#64748b', fontWeight:'500' }}>{typeLabel}</span>
        </div>
        {ex.instruction && (
          <p style={{ fontSize:'13px', color:'#374151', lineHeight:1.5, margin:'4px 0 6px',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {ex.instruction}
          </p>
        )}
        <div style={{ display:'flex', gap:'12px', fontSize:'12px', color:'#94a3b8' }}>
          <span>{qCount} question{qCount!==1?'s':''}</span>
          <span>·</span>
          <span>{ex.marks} mark{ex.marks!==1?'s':''}</span>
        </div>
      </div>
      <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
        <Btn small variant="secondary" onClick={onEdit}>Edit</Btn>
        <Btn small variant="danger" onClick={onDelete}>Delete</Btn>
      </div>
    </div>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function ProgressTestAdmin() {
  const [level,      setLevel]      = useState('')
  const [unit,       setUnit]       = useState('')
  const [test,       setTest]       = useState(null)   // progress_tests row
  const [exercises,  setExercises]  = useState([])
  const [qCounts,    setQCounts]    = useState({})     // exerciseId -> count
  const [loading,    setLoading]    = useState(false)
  const [showModal,  setShowModal]  = useState(false)
  const [editingEx,  setEditingEx]  = useState(null)
  const [deleting,   setDeleting]   = useState(null)

  const totalMarks = exercises.reduce((s, ex) => s + (ex.marks||0), 0)

  const loadTest = async () => {
    if (!level || !unit) return
    setLoading(true)
    // Get or create test
    let { data: existing } = await supabase.from('progress_tests')
      .select('*').eq('level', level).eq('unit', unit).maybeSingle()

    if (!existing) {
      const { data: created } = await supabase.from('progress_tests')
        .insert({ level, unit: parseInt(unit) }).select().single()
      existing = created
    }
    setTest(existing)

    // Load exercises
    const { data: exRows } = await supabase.from('progress_test_exercises')
      .select('*').eq('test_id', existing.id).order('exercise_num')
    setExercises(exRows || [])

    // Count questions per exercise
    if (exRows?.length) {
      const counts = {}
      await Promise.all(exRows.map(async ex => {
        const { count } = await supabase.from('progress_test_questions')
          .select('*', { count:'exact', head:true }).eq('exercise_id', ex.id)
        counts[ex.id] = count || 0
      }))
      setQCounts(counts)
    }
    setLoading(false)
  }

  const deleteExercise = async (ex) => {
    setDeleting(ex.id)
    await supabase.from('progress_test_exercises').delete().eq('id', ex.id)
    setExercises(prev => prev.filter(e => e.id !== ex.id))
    setDeleting(null)
  }

  const handleSaved = async () => {
    setShowModal(false)
    setEditingEx(null)
    await loadTest()
  }

  const nextExerciseNum = exercises.length + 1

  // Section summaries
  const sectionSummary = SECTIONS.map(s => ({
    ...s,
    count: exercises.filter(e => e.section === s.id).length,
    marks: exercises.filter(e => e.section === s.id).reduce((a,e) => a+(e.marks||0), 0),
  }))

  return (
    <div style={{ padding:'28px 32px', fontFamily:"'DM Sans',sans-serif", maxWidth:'900px' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>

      {/* Page title */}
      <div style={{ marginBottom:'28px' }}>
        <h2 style={{ fontSize:'24px', fontFamily:"'Plus Jakarta Sans',sans-serif",
          fontWeight:'800', color:DARK, letterSpacing:'-0.3px', marginBottom:'4px' }}>
          Progress Tests
        </h2>
        <p style={{ fontSize:'14px', color:'#64748b' }}>
          Build and manage unit progress tests for each level
        </p>
      </div>

      {/* Level + Unit selector */}
      <div style={{ background:'white', borderRadius:'16px', padding:'22px 24px',
        border:'1.5px solid #f0f2f1', marginBottom:'24px',
        boxShadow:'0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize:'13px', fontWeight:'700', color:'#94a3b8',
          textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'14px' }}>
          Select Test
        </div>
        <div style={{ display:'flex', gap:'14px', alignItems:'flex-end', flexWrap:'wrap' }}>
          <div style={{ flex:'0 0 220px' }}>
            <Field label="Level">
              <Select value={level} onChange={v => { setLevel(v); setUnit(''); setTest(null); setExercises([]) }}
                options={[{ value:'', label:'— Choose level —' }, ...LEVELS.map(l => ({ value:l, label:l }))]} />
            </Field>
          </div>
          <div style={{ flex:'0 0 140px' }}>
            <Field label="Unit">
              <Select value={unit} onChange={v => { setUnit(v); setTest(null); setExercises([]) }}
                options={[{ value:'', label:'—' }, ...UNITS.map(u => ({ value:String(u), label:`Unit ${u}` }))]} />
            </Field>
          </div>
          <div style={{ marginBottom:'14px' }}>
            <Btn onClick={loadTest} disabled={!level || !unit || loading}>
              {loading ? 'Loading…' : 'Open Test →'}
            </Btn>
          </div>
        </div>
      </div>

      {/* Test builder */}
      {test && !loading && (
        <>
          {/* Test header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
            marginBottom:'18px', flexWrap:'wrap', gap:'10px' }}>
            <div>
              <h3 style={{ fontSize:'18px', fontFamily:"'Plus Jakarta Sans',sans-serif",
                fontWeight:'800', color:DARK, marginBottom:'2px' }}>
                {level} — Unit {unit} Progress Test
              </h3>
              <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                <span style={{ fontSize:'13px', color:'#64748b' }}>
                  {exercises.length} exercise{exercises.length!==1?'s':''}
                </span>
                <span style={{ color:'#e4e8e7' }}>·</span>
                <span style={{ fontSize:'13px', color:'#64748b' }}>
                  Total: <strong style={{ color:DARK }}>{totalMarks}</strong> marks
                </span>
                {totalMarks === 70 && (
                  <Badge color={G}>✓ 70 / 70</Badge>
                )}
              </div>
            </div>
            <Btn onClick={() => { setEditingEx(null); setShowModal(true) }}>
              + Add Exercise
            </Btn>
          </div>

          {/* Section overview */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',
            gap:'10px', marginBottom:'24px' }}>
            {sectionSummary.map(s => {
              const colors = { grammar:'#6366f1', vocabulary:'#f59e0b', use_of_english:'#ec4899',
                listening:'#3b82f6', reading:'#10b981', writing:'#f97316' }
              const c = colors[s.id] || G
              return (
                <div key={s.id} style={{ background:'white', borderRadius:'12px', padding:'14px 16px',
                  border:`1.5px solid ${s.count > 0 ? c+'30' : '#f0f2f1'}`,
                  boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize:'11px', fontWeight:'700', color: s.count > 0 ? c : '#94a3b8',
                    textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:'6px' }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize:'20px', fontWeight:'800', color: s.count > 0 ? DARK : '#cbd5e1',
                    fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                    {s.marks}
                  </div>
                  <div style={{ fontSize:'11px', color:'#94a3b8', marginTop:'2px' }}>
                    {s.count} exercise{s.count!==1?'s':''}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Exercise list */}
          {exercises.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 24px', background:'white',
              borderRadius:'16px', border:'1.5px dashed #e4e8e7' }}>
              <div style={{ fontSize:'40px', marginBottom:'12px' }}>📝</div>
              <div style={{ fontSize:'16px', fontWeight:'700', color:DARK, marginBottom:'6px',
                fontFamily:"'Plus Jakarta Sans',sans-serif" }}>No exercises yet</div>
              <div style={{ fontSize:'13px', color:'#94a3b8', marginBottom:'20px' }}>
                Click "+ Add Exercise" to start building this test
              </div>
              <Btn onClick={() => setShowModal(true)}>+ Add First Exercise</Btn>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {exercises.map(ex => (
                <ExerciseCard
                  key={ex.id}
                  ex={ex}
                  qCount={qCounts[ex.id] || 0}
                  onEdit={() => { setEditingEx(ex); setShowModal(true) }}
                  onDelete={() => deleteExercise(ex)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Exercise modal */}
      {showModal && test && (
        <ExerciseModal
          testId={test.id}
          exerciseNum={editingEx ? editingEx.exercise_num : nextExerciseNum}
          sectionId={editingEx?.section || 'grammar'}
          existing={editingEx}
          onSave={handleSaved}
          onClose={() => { setShowModal(false); setEditingEx(null) }}
        />
      )}
    </div>
  )
}