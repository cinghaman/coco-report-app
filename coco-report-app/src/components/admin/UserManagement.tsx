'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Venue, UserRole } from '@/lib/supabase'

interface UserManagementProps {
  user: User
}

interface UserWithAuth extends User {
  email_confirmed_at?: string
  last_sign_in_at?: string
}

export default function UserManagement({ user }: UserManagementProps) {
  const [users, setUsers] = useState<UserWithAuth[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithAuth | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state for adding new user
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    display_name: '',
    role: 'staff' as UserRole,
    venue_ids: [] as string[]
  })

  // Form state for editing user
  const [editUser, setEditUser] = useState({
    display_name: '',
    role: 'staff' as UserRole,
    venue_ids: [] as string[],
    password: ''
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      if (!supabase) {
        throw new Error('Supabase client not configured')
      }

      // Fetch venues
      const { data: venuesData, error: venuesError } = await supabase
        .from('venues')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (venuesError) throw venuesError
      setVenues(venuesData || [])

      // Fetch users via API
      const usersResponse = await fetch('/api/admin/users')
      if (!usersResponse.ok) {
        throw new Error('Failed to fetch users')
      }
      const usersData = await usersResponse.json()
      setUsers(usersData)
    } catch (error) {
      console.error('Error fetching data:', error)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create user')
      }

      setSuccess('User created successfully')
      setNewUser({ email: '', password: '', display_name: '', role: 'staff', venue_ids: [] })
      setShowAddForm(false)
      fetchData()
    } catch (error: unknown) {
      console.error('Error creating user:', error)
      setError(error instanceof Error ? error.message : 'Failed to create user')
    }
  }

  const handleEditUser = (userToEdit: UserWithAuth) => {
    setEditingUser(userToEdit)
    setEditUser({
      display_name: userToEdit.display_name || '',
      role: userToEdit.role,
      venue_ids: userToEdit.venue_ids || [],
      password: ''
    })
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setError(null)
    setSuccess(null)

    try {
      const updateData: Record<string, unknown> = {
        userId: editingUser.id,
        display_name: editUser.display_name,
        role: editUser.role,
        venue_ids: editUser.venue_ids
      }

      // Only include password if it's provided
      if (editUser.password) {
        updateData.password = editUser.password
      }

      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update user')
      }

      setSuccess('User updated successfully')
      setEditingUser(null)
      setEditUser({ display_name: '', role: 'staff', venue_ids: [], password: '' })
      fetchData()
    } catch (error: unknown) {
      console.error('Error updating user:', error)
      setError(error instanceof Error ? error.message : 'Failed to update user')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/users?userId=${userId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete user')
      }

      setSuccess('User deleted successfully')
      fetchData()
    } catch (error: unknown) {
      console.error('Error deleting user:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete user')
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800'
      case 'staff': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        </div>
      )}

      {/* Add User Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Users</h3>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
        >
          Add User
        </button>
      </div>

      {/* Add User Form */}
      {showAddForm && (
        <div className="bg-white shadow rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Add New User</h4>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email *
                </label>
                <input
                  type="email"
                  id="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900 placeholder-gray-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password *
                </label>
                <input
                  type="password"
                  id="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900 placeholder-gray-500"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="display_name" className="block text-sm font-medium text-gray-700">
                  Display Name *
                </label>
                <input
                  type="text"
                  id="display_name"
                  value={newUser.display_name}
                  onChange={(e) => setNewUser({ ...newUser, display_name: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900 placeholder-gray-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                  Role *
                </label>
                <select
                  id="role"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as 'admin' | 'staff' })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            {newUser.role === 'staff' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Venue Access
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {venues.map((venue) => (
                    <label key={venue.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newUser.venue_ids.includes(venue.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewUser({ ...newUser, venue_ids: [...newUser.venue_ids, venue.id] })
                          } else {
                            setNewUser({ ...newUser, venue_ids: newUser.venue_ids.filter(id => id !== venue.id) })
                          }
                        }}
                        className="rounded border-gray-300 text-emerald-600 shadow-sm focus:border-emerald-300 focus:ring focus:ring-emerald-200 focus:ring-opacity-50"
                      />
                      <span className="ml-2 text-sm text-gray-700">{venue.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                Create User
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit User Form */}
      {editingUser && (
        <div className="bg-white shadow rounded-lg p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Edit User: {editingUser.email}</h4>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="edit_display_name" className="block text-sm font-medium text-gray-700">
                  Display Name *
                </label>
                <input
                  type="text"
                  id="edit_display_name"
                  value={editUser.display_name}
                  onChange={(e) => setEditUser({ ...editUser, display_name: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900 placeholder-gray-500"
                  required
                />
              </div>
              <div>
                <label htmlFor="edit_role" className="block text-sm font-medium text-gray-700">
                  Role *
                </label>
                <select
                  id="edit_role"
                  value={editUser.role}
                  onChange={(e) => setEditUser({ ...editUser, role: e.target.value as 'admin' | 'staff' })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="edit_password" className="block text-sm font-medium text-gray-700">
                New Password (leave blank to keep current)
              </label>
              <input
                type="password"
                id="edit_password"
                value={editUser.password}
                onChange={(e) => setEditUser({ ...editUser, password: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm text-gray-900 placeholder-gray-500"
                minLength={6}
                placeholder="Leave blank to keep current password"
              />
            </div>

            {editUser.role === 'staff' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Venue Access
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {venues.map((venue) => (
                    <label key={venue.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editUser.venue_ids.includes(venue.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditUser({ ...editUser, venue_ids: [...editUser.venue_ids, venue.id] })
                          } else {
                            setEditUser({ ...editUser, venue_ids: editUser.venue_ids.filter(id => id !== venue.id) })
                          }
                        }}
                        className="rounded border-gray-300 text-emerald-600 shadow-sm focus:border-emerald-300 focus:ring focus:ring-emerald-200 focus:ring-opacity-50"
                      />
                      <span className="ml-2 text-sm text-gray-700">{venue.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null)
                  setEditUser({ display_name: '', role: 'staff', venue_ids: [], password: '' })
                }}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500"
              >
                Update User
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {users.map((userItem) => (
            <li key={userItem.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-emerald-500 flex items-center justify-center">
                        <span className="text-white text-sm font-medium">
                          {userItem.display_name?.charAt(0) || userItem.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">
                        {userItem.display_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {userItem.email}
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(userItem.role)}`}>
                          {userItem.role}
                        </span>
                        {userItem.role === 'staff' && (
                          <span className="text-xs text-gray-500">
                            {userItem.venue_ids.length} venue(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-xs text-gray-500">
                        Last sign in: {formatDate(userItem.last_sign_in_at)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Confirmed: {userItem.email_confirmed_at ? 'Yes' : 'No'}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEditUser(userItem)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit user"
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteUser(userItem.id)}
                        disabled={userItem.id === user.id} // Don't allow deleting self
                        className="text-red-600 hover:text-red-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                        title={userItem.id === user.id ? "Cannot delete your own account" : "Delete user"}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
