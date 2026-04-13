'use client'
import { useState, useEffect } from 'react'

const TEAMS = ['Accounting', 'Deal Desk', 'Legal'] as const
const RULE_TYPES = [
  { value: 'max_discount', label: 'Max Discount %' },
  { value: 'max_deal_size', label: 'Max Deal Size ($)' },
  { value: 'min_deal_size', label: 'Min Deal Size ($)' },
  { value: 'approval_required', label: 'Approval Required Above ($)' },
  { value: 'required_field', label: 'Required Field' },
  { value: 'custom', label: 'Custom (AI Evaluated)' },
]
const TEAM_COLORS: Record<string, string> = {
  Accounting: 'badge-blue', 'Deal Desk': 'badge-yellow', Legal: 'badge-red',
}

interface Rule {
  id: string; title: string; description?: string; team: string
  rule_type: string; conditions: Record<string, unknown>; is_active: boolean; created_at: string
}

const emptyForm = { title: '', description: '', team: 'Accounting', ruleType: 'max_discount', conditions: { value: '', severity: 'warn', threshold: '', field: '' }, isActive: true }

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [teamFilter, setTeamFilter] = useState<string>('All')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Rule | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const r = await fetch('/api/rules')
    const d = await r.json()
    setRules(d.rules || [])
    setLoading(false)
  }

  function openCreate() {
    setEditing(null); setForm(emptyForm); setMsg(''); setShowModal(true)
  }
  function openEdit(r: Rule) {
    setEditing(r)
    const c = r.conditions as Record<string, unknown>
    setForm({ title: r.title, description: r.description || '', team: r.team, ruleType: r.rule_type,
      conditions: { value: String(c.value || ''), severity: String(c.severity || 'warn'), threshold: String(c.threshold || ''), field: String(c.field || '') },
      isActive: r.is_active })
    setMsg(''); setShowModal(true)
  }

  async function save() {
    if (!form.title) { setMsg('Title is required'); return }
    setSaving(true)
    const c: Record<string, unknown> = {}
    const t = form.ruleType
    if (t === 'max_discount' || t === 'min_deal_size' || t === 'max_deal_size') { c.value = Number(form.conditions.value); c.severity = form.conditions.severity }
    else if (t === 'approval_required') { c.threshold = Number(form.conditions.threshold) }
    else if (t === 'required_field') { c.field = form.conditions.field; c.severity = form.conditions.severity }
    else { c.description = form.description }
    const body = { title: form.title, description: form.description, team: form.team, ruleType: form.ruleType, conditions: c, isActive: form.isActive }
    const url = editing ? `/api/rules/${editing.id}` : '/api/rules'
    const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { setShowModal(false); load() } else { const d = await res.json(); setMsg(d.error || 'Save failed') }
    setSaving(false)
  }

  async function toggle(r: Rule) {
    await fetch(`/api/rules/${r.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: !r.is_active }) })
    load()
  }

  async function del(r: Rule) {
    if (!confirm(`Delete rule "${r.title}"?`)) return
    await fetch(`/api/rules/${r.id}`, { method: 'DELETE' })
    load()
  }

  const filtered = teamFilter === 'All' ? rules : rules.filter(r => r.team === teamFilter)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rules Engine</h1>
          <p className="text-gray-500 text-sm mt-0.5">Compliance constraints for Accounting, Deal Desk &amp; Legal</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Rule
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {['All', ...TEAMS].map(t => (
          <button key={t} onClick={() => setTeamFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${teamFilter === t ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? <p className="text-center text-gray-400 py-12">Loading...</p> : filtered.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
          <p>No rules yet. Create one to enforce deal constraints.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className={`card p-5 flex items-start gap-4 ${!r.is_active ? 'opacity-60' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={TEAM_COLORS[r.team] || 'badge-gray'}>{r.team}</span>
                  <span className="badge-gray text-xs">{RULE_TYPES.find(t => t.value === r.rule_type)?.label || r.rule_type}</span>
                  {!r.is_active && <span className="badge-gray text-xs">Inactive</span>}
                </div>
                <p className="font-medium text-gray-900">{r.title}</p>
                {r.description && <p className="text-sm text-gray-500 mt-0.5">{r.description}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  {r.rule_type === 'max_discount' && `Max discount: ${(r.conditions as Record<string,unknown>).value}% • ${(r.conditions as Record<string,unknown>).severity}`}
                  {r.rule_type === 'max_deal_size' && `Max deal: $${(r.conditions as Record<string,unknown>).value?.toLocaleString()}`}
                  {r.rule_type === 'min_deal_size' && `Min deal: $${(r.conditions as Record<string,unknown>).value?.toLocaleString()}`}
                  {r.rule_type === 'approval_required' && `Approval above: $${(r.conditions as Record<string,unknown>).threshold?.toLocaleString()}`}
                  {r.rule_type === 'required_field' && `Required field: ${(r.conditions as Record<string,unknown>).field}`}
                  {r.rule_type === 'custom' && 'AI-evaluated rule'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggle(r)} className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${r.is_active ? 'bg-blue-600' : 'bg-gray-200'}`}>
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${r.is_active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <button onClick={() => openEdit(r)} className="text-gray-500 hover:text-blue-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                <button onClick={() => del(r)} className="text-gray-500 hover:text-red-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <h2 className="font-semibold text-gray-900">{editing ? 'Edit Rule' : 'New Rule'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 space-y-4">
              {msg && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{msg}</div>}
              <div><label className="label">Rule Title *</label><input className="input-field" value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} placeholder="e.g. Max 20% discount without approval" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Team</label>
                  <select className="input-field" value={form.team} onChange={e => setForm(f => ({...f, team: e.target.value}))}>
                    {TEAMS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div><label className="label">Rule Type</label>
                  <select className="input-field" value={form.ruleType} onChange={e => setForm(f => ({...f, ruleType: e.target.value}))}>
                    {RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              {(form.ruleType === 'max_discount' || form.ruleType === 'min_deal_size' || form.ruleType === 'max_deal_size') && (
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">{form.ruleType === 'max_discount' ? 'Max Discount (%)' : 'Amount ($)'}</label><input type="number" className="input-field" value={form.conditions.value} onChange={e => setForm(f => ({...f, conditions: {...f.conditions, value: e.target.value}}))} /></div>
                  <div><label className="label">Severity</label>
                    <select className="input-field" value={form.conditions.severity} onChange={e => setForm(f => ({...f, conditions: {...f.conditions, severity: e.target.value}}))}>
                      <option value="warn">Warn (advisory)</option>
                      <option value="block">Block (prevents sending)</option>
                    </select>
                  </div>
                </div>
              )}
              {form.ruleType === 'approval_required' && (
                <div><label className="label">Require approval above ($)</label><input type="number" className="input-field" value={form.conditions.threshold} onChange={e => setForm(f => ({...f, conditions: {...f.conditions, threshold: e.target.value}}))} /></div>
              )}
              {form.ruleType === 'required_field' && (
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="label">Field name</label><input className="input-field" value={form.conditions.field} onChange={e => setForm(f => ({...f, conditions: {...f.conditions, field: e.target.value}}))} placeholder="e.g. customer_company" /></div>
                  <div><label className="label">Severity</label>
                    <select className="input-field" value={form.conditions.severity} onChange={e => setForm(f => ({...f, conditions: {...f.conditions, severity: e.target.value}}))}>
                      <option value="warn">Warn</option><option value="block">Block</option>
                    </select>
                  </div>
                </div>
              )}
              <div><label className="label">Description <span className="text-gray-400 text-xs">(optional — used for custom AI rules)</span></label><textarea className="input-field" rows={2} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} placeholder="Describe what this rule enforces..." /></div>
              <div className="flex items-center gap-3">
                <button onClick={() => setForm(f => ({...f, isActive: !f.isActive}))} className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${form.isActive ? 'bg-blue-600' : 'bg-gray-200'}`}>
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${form.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm text-gray-700">Rule is {form.isActive ? 'active' : 'inactive'}</span>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Rule'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
