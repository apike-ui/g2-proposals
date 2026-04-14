'use client'

import { useEffect, useState } from 'react'

interface User {
  id: string
  username: string
  display_name?: string
  role: 'admin' | 'user'
  created_at?: string
}

interface Me {
  userId: string
  username: string
  displayName: string
  role: string
}

type TabType = 'profile' | 'users'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('profile')
  const [me, setMe] = useState<Me | null>(null)

  // Profile form
  const [profileForm, setProfileForm] = useState({ displayName: '', currentPassword: '', newPassword: '', confirmPassword: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [profileError, setProfileError] = useState('')

  // Users management
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [userForm, setUserForm] = useState({ username: '', displayName: '', password: '', role: 'user' as 'admin' | 'user' })
  const [userSaving, setUserSaving] = useState(false)
  const [userError, setUserError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (data.userId) {
        setMe(data)
        setProfileForm(f => ({ ...f, displayName: data.displayName || data.username }))
      }
    })
  }, [])

  async function loadUsers() {
    setUsersLoading(true)
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setUsers(data.users || [])
    setUsersLoading(false)
  }

  useEffect(() => {
    if (activeTab === 'users') loadUsers()
  }, [activeTab])

  async function saveProfile() {
    setProfileSaving(true)
    setProfileMsg('')
    setProfileError('')

    if (profileForm.newPassword && profileForm.newPassword !== profileForm.confirmPassword) {
      setProfileError('New passwords do not match')
      setProfileSaving(false)
      return
    }

    const payload: Record<string, string> = { displayName: profileForm.displayName }
    if (profileForm.newPassword) {
      payload.currentPassword = profileForm.currentPassword
      payload.newPassword = profileForm.newPassword
    }

    const res = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (res.ok) {
      setProfileMsg('Profile updated successfully')
      setProfileForm(f => ({ ...f, currentPassword: '', newPassword: '', confirmPassword: '' }))
      if (data.displayName) setMe(m => m ? { ...m, displayName: data.displayName } : m)
    } else {
      setProfileError(data.error || 'Save failed')
    }
    setProfileSaving(false)
    setTimeout(() => setProfileMsg(''), 4000)
  }

  function openCreateUser() {
    setEditingUser(null)
    setUserForm({ username: '', displayName: '', password: '', role: 'user' })
    setUserError('')
    setShowUserModal(true)
  }

  function openEditUser(user: User) {
    setEditingUser(user)
    setUserForm({ username: user.username, displayName: user.display_name || '', password: '', role: user.role })
    setUserError('')
    setShowUserModal(true)
  }

  async function saveUser() {
    if (!userForm.username.trim()) { setUserError('Username is required'); return }
    if (!editingUser && !userForm.password) { setUserError('Password is required for new users'); return }

    setUserSaving(true)
    setUserError('')

    const url = editingUser ? `/api/admin/users/${editingUser.id}` : '/api/admin/users'
    const method = editingUser ? 'PUT' : 'POST'
    const payload: Record<string, string> = {
      username: userForm.username,
      displayName: userForm.displayName,
      role: userForm.role,
    }
    if (userForm.password) payload.password = userForm.password

    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()

    if (!res.ok) { setUserError(data.error || 'Save failed'); setUserSaving(false); return }
    setShowUserModal(false)
    loadUsers()
    setUserSaving(false)
  }

  async function deleteUser(id: string) {
    setDeleteError('')
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== id))
      setDeleteConfirm(null)
    } else {
      setDeleteError(data.error || 'Delete failed')
      setDeleteConfirm(null)
    }
  }

  const initials = (name: string) => name.slice(0, 2).toUpperCase()

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your profile and user accounts</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {([['profile', 'My Profile'], ['users', 'Manage Users']] as [TabType, string][]).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold text-xl">
              {me ? initials(me.displayName || me.username) : '…'}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-lg">{me?.displayName || me?.username}</p>
              <p className="text-sm text-gray-500">@{me?.username} · {me?.role === 'admin' ? 'Administrator' : 'User'}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Display Name</label>
              <input
                type="text"
                value={profileForm.displayName}
                onChange={e => setProfileForm(f => ({ ...f, displayName: e.target.value }))}
                className="input"
                placeholder="Your display name"
              />
            </div>

            <div className="pt-4 border-t border-gray-100">
              <p className="text-sm font-semibold text-gray-900 mb-3">Change Password</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
                  <input
                    type="password"
                    value={profileForm.currentPassword}
                    onChange={e => setProfileForm(f => ({ ...f, currentPassword: e.target.value }))}
                    className="input"
                    placeholder="Leave blank to keep current"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                    <input
                      type="password"
                      value={profileForm.newPassword}
                      onChange={e => setProfileForm(f => ({ ...f, newPassword: e.target.value }))}
                      className="input"
                      placeholder="Min 8 characters"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
                    <input
                      type="password"
                      value={profileForm.confirmPassword}
                      onChange={e => setProfileForm(f => ({ ...f, confirmPassword: e.target.value }))}
                      className="input"
                      placeholder="Repeat new password"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {profileError && <p className="mt-4 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{profileError}</p>}
          {profileMsg && <p className="mt-4 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">{profileMsg}</p>}

          <div className="flex justify-end mt-6">
            <button onClick={saveProfile} disabled={profileSaving} className="btn-primary">
              {profileSaving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={openCreateUser} className="btn-primary">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Add User
            </button>
          </div>

          {deleteError && <p className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{deleteError}</p>}

          {usersLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
              {users.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No users found</div>
              ) : users.map(user => (
                <div key={user.id} className="flex items-center gap-4 p-4">
                  <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                    {initials(user.display_name || user.username)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{user.display_name || user.username}</p>
                    <p className="text-sm text-gray-400">@{user.username}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    user.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {user.role}
                  </span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEditUser(user)} className="text-gray-400 hover:text-blue-600 p-1 rounded">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    {user.id !== me?.userId && (
                      deleteConfirm === user.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => deleteUser(user.id)} className="text-xs text-red-600 font-medium">Delete</button>
                          <button onClick={() => setDeleteConfirm(null)} className="text-xs text-gray-400">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(user.id)} className="text-gray-400 hover:text-red-500 p-1 rounded">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* User modal */}
          {showUserModal && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-gray-900">{editingUser ? 'Edit User' : 'Add User'}</h2>
                  <button onClick={() => setShowUserModal(false)} className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                  {userError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{userError}</p>}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
                    <input
                      type="text"
                      value={userForm.username}
                      onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))}
                      placeholder="jsmith"
                      className="input"
                      disabled={!!editingUser}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Display Name</label>
                    <input
                      type="text"
                      value={userForm.displayName}
                      onChange={e => setUserForm(f => ({ ...f, displayName: e.target.value }))}
                      placeholder="John Smith"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {editingUser ? 'New Password (leave blank to keep)' : 'Password'}
                    </label>
                    <input
                      type="password"
                      value={userForm.password}
                      onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Min 8 characters"
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                    <select value={userForm.role} onChange={e => setUserForm(f => ({ ...f, role: e.target.value as 'admin' | 'user' }))} className="input">
                      <option value="user">User — can create and view quotes</option>
                      <option value="admin">Admin — full access</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
                  <button onClick={() => setShowUserModal(false)} className="btn-secondary">Cancel</button>
                  <button onClick={saveUser} disabled={userSaving} className="btn-primary">
                    {userSaving ? 'Saving…' : editingUser ? 'Update User' : 'Create User'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
