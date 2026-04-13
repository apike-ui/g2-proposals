'use client'
import { useState, useEffect } from 'react'

interface User { id: string; username: string; display_name: string; role: string; created_at: string }

export default function SettingsPage() {
  const [tab, setTab] = useState<'profile' | 'users'>('profile')
  const [profile, setProfile] = useState({ displayName: '', username: '', currentPassword: '', newPassword: '' })
  const [profileMsg, setProfileMsg] = useState({ text: '', ok: true })
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [uForm, setUForm] = useState({ username: '', displayName: '', password: '', role: 'user' })
  const [uMsg, setUMsg] = useState({ text: '', ok: true })
  const [savingU, setSavingU] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      if (d.username) setProfile(p => ({ ...p, displayName: d.displayName || '', username: d.username }))
    })
    loadUsers()
  }, [])

  async function loadUsers() {
    const r = await fetch('/api/admin/users')
    const d = await r.json()
    setUsers(d.users || [])
  }

  async function saveProfile() {
    setSaving(true); setProfileMsg({ text: '', ok: true })
    const res = await fetch('/api/admin/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profile),
    })
    const d = await res.json()
    setProfileMsg(res.ok ? { text: 'Profile saved', ok: true } : { text: d.error || 'Save failed', ok: false })
    if (res.ok) setProfile(p => ({ ...p, currentPassword: '', newPassword: '' }))
    setSaving(false)
  }

  function openCreate() {
    setEditUser(null); setUForm({ username: '', displayName: '', password: '', role: 'user' })
    setUMsg({ text: '', ok: true }); setShowModal(true)
  }
  function openEdit(u: User) {
    setEditUser(u); setUForm({ username: u.username, displayName: u.display_name, password: '', role: u.role })
    setUMsg({ text: '', ok: true }); setShowModal(true)
  }
  async function saveUser() {
    setSavingU(true); setUMsg({ text: '', ok: true })
    const url = editUser ? `/api/admin/users/${editUser.id}` : '/api/admin/users'
    const res = await fetch(url, { method: editUser ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(uForm) })
    const d = await res.json()
    if (res.ok) { setShowModal(false); loadUsers() }
    else setUMsg({ text: d.error || 'Save failed', ok: false })
    setSavingU(false)
  }
  async function delUser(id: string, name: string) {
    if (!confirm(`Delete user "${name}"?`)) return
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    loadUsers()
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      <div className="flex border-b border-gray-200 mb-6">
        {(['profile', 'users'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'profile' ? 'My Profile' : 'Manage Users'}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="card p-6 max-w-md">
          {profileMsg.text && <div className={`mb-4 p-3 rounded-lg text-sm ${profileMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{profileMsg.text}</div>}
          <div className="space-y-4">
            <div><label className="label">Display Name</label><input className="input-field" value={profile.displayName} onChange={e => setProfile(p => ({...p, displayName: e.target.value}))} /></div>
            <div><label className="label">Username</label><input className="input-field" value={profile.username} onChange={e => setProfile(p => ({...p, username: e.target.value}))} /></div>
            <hr className="border-gray-100" />
            <div><label className="label">Current Password <span className="text-red-500">*</span></label><input type="password" className="input-field" value={profile.currentPassword} onChange={e => setProfile(p => ({...p, currentPassword: e.target.value}))} placeholder="Required to save changes" /></div>
            <div><label className="label">New Password <span className="text-gray-400 text-xs">(leave blank to keep)</span></label><input type="password" className="input-field" value={profile.newPassword} onChange={e => setProfile(p => ({...p, newPassword: e.target.value}))} /></div>
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={saveProfile} disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      )}

      {tab === 'users' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">{users.length} user{users.length !== 1 ? 's' : ''}</p>
            <button onClick={openCreate} className="btn-primary btn-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Add User
            </button>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr><th className="table-header">Username</th><th className="table-header">Display Name</th><th className="table-header">Role</th><th className="table-header">Created</th><th className="table-header">Actions</th></tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={5} className="table-cell text-center py-8 text-gray-400">No users yet</td></tr>
                ) : users.map(u => (
                  <tr key={u.id} className="table-row">
                    <td className="table-cell font-mono text-sm">{u.username}</td>
                    <td className="table-cell">{u.display_name || '—'}</td>
                    <td className="table-cell"><span className={u.role === 'admin' ? 'badge-blue' : 'badge-gray'}>{u.role}</span></td>
                    <td className="table-cell text-gray-500 text-sm">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="table-cell">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(u)} className="text-gray-500 hover:text-blue-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                        <button onClick={() => delUser(u.id, u.username)} className="text-gray-500 hover:text-red-600"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editUser ? 'Edit User' : 'New User'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 space-y-4">
              {uMsg.text && <div className={`p-3 rounded-lg text-sm ${uMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{uMsg.text}</div>}
              <div><label className="label">Username *</label><input className="input-field" value={uForm.username} onChange={e => setUForm(f => ({...f, username: e.target.value}))} disabled={!!editUser} /></div>
              <div><label className="label">Display Name</label><input className="input-field" value={uForm.displayName} onChange={e => setUForm(f => ({...f, displayName: e.target.value}))} /></div>
              <div><label className="label">{editUser ? 'New Password (blank = no change)' : 'Password *'}</label><input type="password" className="input-field" value={uForm.password} onChange={e => setUForm(f => ({...f, password: e.target.value}))} /></div>
              <div><label className="label">Role</label>
                <select className="input-field" value={uForm.role} onChange={e => setUForm(f => ({...f, role: e.target.value}))}>
                  <option value="user">User — Quotes only</option>
                  <option value="admin">Administrator — Full access</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveUser} disabled={savingU} className="btn-primary">{savingU ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
