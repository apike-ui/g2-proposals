'use client'

import { useEffect, useState, useCallback } from 'react'

interface Rule {
  id: string
  name: string
  team: string
  type: string
  condition: Record<string, unknown>
  active: boolean
  created_at?: string
}

const RULE_TYPES = [
  { value: 'max_discount', label: 'Max Discount %' },
  { value: 'max_deal_size', label: 'Max Deal Size ($)' },
  { value: 'min_deal_size', label: 'Min Deal Size ($)' },
  { value: 'approval_required', label: 'Approval Required Above ($)' },
  { value: 'required_field', label: 'Required Field' },
  { value: 'custom', label: 'Custom (AI-evaluated)' },
]

const TEAMS = ['All Teams', 'Accounting', 'Deal Desk', 'Legal', 'Sales', 'Finance']
const SEVERITY_OPTIONS = ['warn', 'block']

const defaultForm = {
  name: '',
  team: 'Deal Desk',
  type: 'max_discount',
  active: true,
  conditionValue: '',
  conditionThreshold: '',
  conditionField: 'company',
  conditionSeverity: 'warn',
  conditionDescription: '',
}

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [teamFilter, setTeamFilter] = useState('All Teams')
  const [showModal, setShowModal] = useState(false)
  const [editingRule, setEditingRule] = useState<Rule | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const fetchRules = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/rules')
    const data = await res.json()
    setRules(data.rules || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  function openCreate() {
    setEditingRule(null)
    setForm(defaultForm)
    setError('')
    setShowModal(true)
  }

  function openEdit(rule: Rule) {
    setEditingRule(rule)
    const c = rule.condition as Record<string, unknown>
    setForm({
      name: rule.name,
      team: rule.team,
      type: rule.type,
      active: rule.active,
      conditionValue: String(c.value ?? ''),
      conditionThreshold: String(c.threshold ?? ''),
      conditionField: String(c.field ?? 'company'),
      conditionSeverity: String(c.severity ?? 'warn'),
      conditionDescription: String(c.description ?? ''),
    })
    setError('')
    setShowModal(true)
  }

  function buildCondition() {
    const c: Record<string, unknown> = {}
    if (form.type === 'max_discount' || form.type === 'max_deal_size' || form.type === 'min_deal_size') {
      c.value = parseFloat(form.conditionValue) || 0
      c.severity = form.conditionSeverity
    } else if (form.type === 'approval_required') {
      c.threshold = parseFloat(form.conditionThreshold) || 0
    } else if (form.type === 'required_field') {
      c.field = form.conditionField
      c.severity = form.conditionSeverity
    } else if (form.type === 'custom') {
      c.description = form.conditionDescription
    }
    return c
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true)
    setError('')
    const payload = {
      name: form.name,
      team: form.team,
      type: form.type,
      active: form.active,
      condition: buildCondition(),
    }
    const url = editingRule ? `/api/rules/${editingRule.id}` : '/api/rules'
    const method = editingRule ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Save failed'); setSaving(false); return }
    setShowModal(false)
    fetchRules()
    setSaving(false)
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/rules/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setRules(prev => prev.filter(r => r.id !== id))
      setDeleteConfirm(null)
    }
  }

  async function toggleActive(rule: Rule) {
    const res = await fetch(`/api/rules/${rule.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rule, active: !rule.active }),
    })
    if (res.ok) setRules(prev => prev.map(r => r.id === rule.id ? { ...r, active: !r.active } : r))
  }

  const filtered = teamFilter === 'All Teams' ? rules : rules.filter(r => r.team === teamFilter)

  const teamColors: Record<string, string> = {
    Accounting: 'bg-purple-100 text-purple-700',
    'Deal Desk': 'bg-blue-100 text-blue-700',
    Legal: 'bg-amber-100 text-amber-700',
    Sales: 'bg-green-100 text-green-700',
    Finance: 'bg-rose-100 text-rose-700',
  }

  const typeLabel = (type: string) => RULE_TYPES.find(t => t.value === type)?.label || type

  function conditionSummary(rule: Rule) {
    const c = rule.condition as Record<string, unknown>
    if (rule.type === 'max_discount') return `Max ${c.value}% discount`
    if (rule.type === 'max_deal_size') return `Max $${Number(c.value).toLocaleString()} deal`
    if (rule.type === 'min_deal_size') return `Min $${Number(c.value).toLocaleString()} deal`
    if (rule.type === 'approval_required') return `Approval above $${Number(c.threshold).toLocaleString()}`
    if (rule.type === 'required_field') return `Required: ${c.field}`
    if (rule.type === 'custom') return String(c.description || '').slice(0, 60)
    return ''
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rules Engine</h1>
          <p className="text-gray-500 mt-1">Define approval and compliance rules for quotes</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Rule
        </button>
      </div>

      {/* Team filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TEAMS.map(team => (
          <button
            key={team}
            onClick={() => setTeamFilter(team)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
              teamFilter === team
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {team}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <p className="text-gray-400 text-lg mb-2">No rules yet</p>
          <p className="text-sm text-gray-400">Add a rule to enforce quote compliance</p>
          <button onClick={openCreate} className="btn-primary mt-4">Add First Rule</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(rule => (
            <div key={rule.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-gray-900">{rule.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${teamColors[rule.team] || 'bg-gray-100 text-gray-600'}`}>
                    {rule.team}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">
                    {typeLabel(rule.type)}
                  </span>
                  {(rule.condition as Record<string, unknown>).severity === 'block' && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-600 font-medium">BLOCK</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 truncate">{conditionSummary(rule)}</p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={() => toggleActive(rule)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${rule.active ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${rule.active ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-xs text-gray-400 w-12">{rule.active ? 'Active' : 'Off'}</span>
                <button onClick={() => openEdit(rule)} className="text-gray-400 hover:text-blue-600 p-1 rounded">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                {deleteConfirm === rule.id ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleDelete(rule.id)} className="text-xs text-red-600 font-medium">Confirm</button>
                    <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-400">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(rule.id)} className="text-gray-400 hover:text-red-500 p-1 rounded">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">{editingRule ? 'Edit Rule' : 'New Rule'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Rule Name</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. No discounts above 20%" className="input" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Team</label>
                  <select value={form.team} onChange={e => setForm(f => ({ ...f, team: e.target.value }))} className="input">
                    {TEAMS.filter(t => t !== 'All Teams').map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Rule Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="input">
                    {RULE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Condition fields */}
              {(form.type === 'max_discount' || form.type === 'max_deal_size' || form.type === 'min_deal_size') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {form.type === 'max_discount' ? 'Max Discount (%)' : form.type === 'max_deal_size' ? 'Max Amount ($)' : 'Min Amount ($)'}
                    </label>
                    <input
                      type="number"
                      value={form.conditionValue}
                      onChange={e => setForm(f => ({ ...f, conditionValue: e.target.value }))}
                      placeholder={form.type === 'max_discount' ? '20' : '50000'}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Severity</label>
                    <select value={form.conditionSeverity} onChange={e => setForm(f => ({ ...f, conditionSeverity: e.target.value }))} className="input">
                      {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s === 'block' ? 'Block (prevent submit)' : 'Warn (allow with warning)'}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {form.type === 'approval_required' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Approval Threshold ($)</label>
                  <input
                    type="number"
                    value={form.conditionThreshold}
                    onChange={e => setForm(f => ({ ...f, conditionThreshold: e.target.value }))}
                    placeholder="10000"
                    className="input"
                  />
                </div>
              )}

              {form.type === 'required_field' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Required Field</label>
                    <select value={form.conditionField} onChange={e => setForm(f => ({ ...f, conditionField: e.target.value }))} className="input">
                      <option value="company">Company Name</option>
                      <option value="email">Contact Email</option>
                      <option value="address">Billing Address</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Severity</label>
                    <select value={form.conditionSeverity} onChange={e => setForm(f => ({ ...f, conditionSeverity: e.target.value }))} className="input">
                      {SEVERITY_OPTIONS.map(s => <option key={s} value={s}>{s === 'block' ? 'Block' : 'Warn'}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {form.type === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Rule Description (AI will evaluate)</label>
                  <textarea
                    value={form.conditionDescription}
                    onChange={e => setForm(f => ({ ...f, conditionDescription: e.target.value }))}
                    placeholder="e.g. Flag any quote that contains more than 5 line items with a discount greater than 15%"
                    className="input"
                    rows={3}
                  />
                  <p className="text-xs text-gray-400 mt-1">Describe the rule in plain English. Claude will evaluate each quote against this description.</p>
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active-toggle"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <label htmlFor="active-toggle" className="text-sm text-gray-700">Rule is active</label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : editingRule ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
