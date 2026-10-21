import { supabase } from '../supabaseClient'

async function unwrap(promise) {
  const { data, error } = await promise
  if (error) throw new Error(error.message)
  return data
}

const SUB_WITH_SCHOLAR =
  '*, scholars(id, student_id, full_name, email, award_status, program_id, programs(*))'

export const api = {
  // reads (row level security decides what each role can see)
  profile: (uid) => unwrap(supabase.from('profiles').select('*').eq('id', uid).single()),
  myScholar: () => unwrap(supabase.from('scholars').select('*, programs(*)').limit(1).maybeSingle()),
  mySubmissions: () => unwrap(supabase.from('submissions').select('*').order('submitted_at', { ascending: false })),
  allSubmissions: () => unwrap(supabase.from('submissions').select(SUB_WITH_SCHOLAR).order('submitted_at', { ascending: false })),
  scholars: () => unwrap(supabase.from('scholars').select('*, programs(*)').order('student_id')),
  programs: () => unwrap(supabase.from('programs').select('*').order('name')),
  logs: (limit = 400) =>
    unwrap(supabase.from('audit_log').select('*, scholars(student_id, full_name)').order('created_at', { ascending: false }).limit(limit)),

  // writes (all go through database functions that enforce the business rules)
  submit: (f) =>
    unwrap(supabase.rpc('submit_grades', {
      p_year: f.year, p_semester: Number(f.semester), p_gwa: Number(f.gwa), p_units: Number(f.units),
      p_failed: Number(f.failed), p_inc: Number(f.inc), p_drop: Number(f.drop), p_evidence: f.evidence,
    })),
  resubmit: (id, f) =>
    unwrap(supabase.rpc('resubmit_grades', {
      p_id: id, p_gwa: Number(f.gwa), p_units: Number(f.units), p_failed: Number(f.failed),
      p_inc: Number(f.inc), p_drop: Number(f.drop), p_evidence: f.evidence,
    })),
  verify: (id, status, reason) => unwrap(supabase.rpc('verify_submission', { p_id: id, p_status: status, p_reason: reason || null })),
  evaluate: (id) => unwrap(supabase.rpc('evaluate_submission', { p_id: id })),
  decide: (id, decision, note) => unwrap(supabase.rpc('decide_renewal', { p_id: id, p_decision: decision, p_note: note || null })),
  registerScholar: (f) =>
    unwrap(supabase.rpc('register_scholar', { p_student_id: f.studentId, p_full_name: f.fullName, p_email: f.email || null, p_program_id: f.programId })),
  assignProgram: (scholarId, programId) => unwrap(supabase.rpc('assign_program', { p_scholar_id: scholarId, p_program_id: programId })),
  updateProgram: (p) =>
    unwrap(supabase.rpc('update_program', {
      p_id: p.id, p_max_gwa: Number(p.max_gwa), p_min_units: Number(p.min_units), p_max_failed: Number(p.max_failed),
      p_max_incomplete: Number(p.max_incomplete), p_max_dropped: Number(p.max_dropped), p_deadline: p.deadline,
    })),
}
