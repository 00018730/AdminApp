import { useState, useEffect } from 'react'
import { supabase } from './supabase'

const G  = '#009472'
const D  = '#002b2a'

const IELTS_LEVELS = ['IELTS Foundation', 'IELTS Proficiency']
const BUCKET = 'homework-images'

export default function EssayImageAdmin() {
  const [level,     setLevel]     = useState('IELTS Foundation')
  const [templates, setTemplates] = useState([])
  const [loading,   setLoading]   = useState(false)
  const [uploading, setUploading] = useState(null)  // lesson_order being uploaded
  const [preview,   setPreview]   = useState(null)  // { order, url }

  useEffect(() => { fetchTemplates() }, [level])

  const fetchTemplates = async () => {
    setLoading(true)
    const { data } = await supabase.from('homework_templates')
      .select('lesson_order, essay_title, essay_image_url')
      .eq('level', level)
      .order('lesson_order')
    setTemplates(data || [])
    setLoading(false)
  }

  const uploadImage = async (order, file) => {
    if (!file) return
    setUploading(order)
    const ext  = file.name.split('.').pop()
    const path = `${level.replace(/\s+/g,'-').toLowerCase()}/lesson-${order}.${ext}`
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
    if (upErr) { alert('Upload failed: ' + upErr.message); setUploading(null); return }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
    await supabase.from('homework_templates')
      .update({ essay_image_url: publicUrl })
      .eq('level', level).eq('lesson_order', order)

    // Also update any already-created homework rows for this lesson
    await supabase.from('homework')
      .update({ image_url: publicUrl })
      .eq('lesson_order', order)

    setUploading(null)
    fetchTemplates()
  }

  const removeImage = async (order) => {
    if (!confirm('Remove image from this lesson?')) return
    await supabase.from('homework_templates')
      .update({ essay_image_url: null })
      .eq('level', level).eq('lesson_order', order)
    fetchTemplates()
  }

  return (
    <div style={{ padding:'28px 32px', fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ marginBottom:'24px' }}>
        <h2 style={{ fontSize:'20px', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:'800', color:D, marginBottom:'4px' }}>
          Essay Images
        </h2>
        <p style={{ fontSize:'13px', color:'#94a3b8' }}>
          Attach IELTS Task 1 chart images to homework templates. Students will see the chart above their writing task.
        </p>
      </div>

      {/* Level tabs */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'24px', background:'#f0f2f1', borderRadius:'12px', padding:'4px', width:'fit-content' }}>
        {IELTS_LEVELS.map(l => (
          <button key={l} onClick={() => setLevel(l)}
            style={{ padding:'8px 20px', borderRadius:'8px', border:'none', background: level===l ? 'white' : 'transparent', color: level===l ? D : '#94a3b8', fontSize:'13px', fontWeight: level===l ? '700' : '500', cursor:'pointer', transition:'all 0.15s', boxShadow: level===l ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Storage reminder */}
      <div style={{ background:'#fef3c7', border:'1px solid #fde68a', borderRadius:'10px', padding:'10px 14px', marginBottom:'20px', fontSize:'12px', color:'#92400e' }}>
        ⚠️ Make sure the <strong>homework-images</strong> bucket exists in Supabase Storage and is set to <strong>Public</strong>.
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:'60px', color:'#94a3b8' }}>Loading…</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', maxWidth:'720px' }}>
          {templates.map(t => (
            <div key={t.lesson_order} style={{ background:'white', borderRadius:'14px', padding:'16px', display:'flex', alignItems:'center', gap:'16px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', border: t.essay_image_url ? `1.5px solid ${G}30` : '1px solid #f0f2f1' }}>

              {/* Lesson info */}
              <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:`${G}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'800', color:G, flexShrink:0, fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                {t.lesson_order}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'14px', fontWeight:'700', color:D, fontFamily:"'Plus Jakarta Sans',sans-serif", marginBottom:'2px' }}>{t.essay_title || `Lesson ${t.lesson_order}`}</div>
                {t.essay_image_url
                  ? <div style={{ fontSize:'11px', color:G, fontWeight:'600' }}>✓ Image attached</div>
                  : <div style={{ fontSize:'11px', color:'#94a3b8' }}>No image</div>
                }
              </div>

              {/* Thumbnail */}
              {t.essay_image_url && (
                <img src={t.essay_image_url} alt="chart"
                  onClick={() => setPreview({ order: t.lesson_order, url: t.essay_image_url })}
                  style={{ width:'64px', height:'48px', objectFit:'cover', borderRadius:'8px', border:'1px solid #e4e8e7', cursor:'pointer', flexShrink:0 }} />
              )}

              {/* Actions */}
              <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
                <label style={{ padding:'8px 14px', borderRadius:'8px', border:`1.5px solid ${G}`, color:G, fontSize:'12px', fontWeight:'700', cursor:'pointer', whiteSpace:'nowrap' }}>
                  {uploading === t.lesson_order ? 'Uploading…' : t.essay_image_url ? 'Replace' : '+ Upload'}
                  <input type="file" accept="image/*" style={{ display:'none' }}
                    onChange={e => { if (e.target.files[0]) uploadImage(t.lesson_order, e.target.files[0]); e.target.value = '' }}
                    disabled={uploading === t.lesson_order} />
                </label>
                {t.essay_image_url && (
                  <button onClick={() => removeImage(t.lesson_order)}
                    style={{ padding:'8px 12px', borderRadius:'8px', border:'1.5px solid #fca5a5', color:'#ef4444', fontSize:'12px', fontWeight:'700', background:'white', cursor:'pointer' }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image preview modal */}
      {preview && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:200, padding:'24px' }}
          onClick={() => setPreview(null)}>
          <div style={{ background:'white', borderRadius:'16px', padding:'16px', maxWidth:'720px', width:'100%' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
              <span style={{ fontSize:'14px', fontWeight:'700', color:D }}>Lesson {preview.order} — Chart Preview</span>
              <button onClick={() => setPreview(null)} style={{ background:'#f0f2f1', border:'none', borderRadius:'8px', width:'32px', height:'32px', cursor:'pointer', fontSize:'16px' }}>✕</button>
            </div>
            <img src={preview.url} alt="chart" style={{ width:'100%', borderRadius:'10px', maxHeight:'480px', objectFit:'contain' }} />
          </div>
        </div>
      )}
    </div>
  )
}