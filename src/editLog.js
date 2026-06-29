import { supabase } from './supabase'

// Shared edit-logger. Sections call this on high-value actions so the CEO sees
// them in Notifications. Reads the current session for the actor. Best-effort:
// never throws into the caller. CEO actions are not logged (no need to notify
// the CEO about the CEO's own work).
export async function logEdit({ action, target_table, target_id = null, summary }) {
  try {
    const sess = JSON.parse(localStorage.getItem('slc_session') || 'null')
    if (!sess || sess.role === 'ceo') return
    await supabase.from('edit_log').insert({
      actor_username: sess.username,
      actor_role: sess.role,
      action,
      target_table,
      target_id: target_id != null ? String(target_id) : null,
      summary,
    })
  } catch {}
}