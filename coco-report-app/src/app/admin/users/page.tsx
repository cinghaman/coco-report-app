'use client'

import { useEffect, useState } from 'react'
import { createClientComponentClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

interface User {
    id: string
    email: string
    display_name: string | null
    role: string
    approved: boolean
    created_at: string
    approved_at: string | null
    approved_by: string | null
}

export default function UsersAdminPage() {
    const router = useRouter()
    const supabase = createClientComponentClient()
    const [users, setUsers] = useState<User[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('pending')
    const [processingUserId, setProcessingUserId] = useState<string | null>(null)

    useEffect(() => {
        checkAccess()
        fetchUsers()
    }, [])

    const checkAccess = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            router.push('/login')
            return
        }

        const { data: userProfile } = await supabase
            .from('users')
            .select('email')
            .eq('id', user.id)
            .single()

        const superAdminEmails = ['admin@thoughtbulb.dev', 'shetty.aneet@gmail.com']
        if (!userProfile || !superAdminEmails.includes(userProfile.email)) {
            router.push('/dashboard')
        }
    }

    const fetchUsers = async () => {
        setLoading(true)
        const response = await fetch('/api/users')
        if (response.ok) {
            const data = await response.json()
            setUsers(data.users || [])
        }
        setLoading(false)
    }

    const handleApprove = async (userId: string, approved: boolean) => {
        setProcessingUserId(userId)
        try {
            const response = await fetch('/api/users/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, approved }),
            })

            if (response.ok) {
                await fetchUsers()
            } else {
                const error = await response.json()
                alert(`Error: ${error.error}`)
            }
        } catch (error) {
            console.error('Error approving user:', error)
            alert('Failed to update user approval')
        } finally {
            setProcessingUserId(null)
        }
    }

    const filteredUsers = users.filter((user) => {
        if (filter === 'pending') return !user.approved
        if (filter === 'approved') return user.approved
        return true
    })

    const pendingCount = users.filter((u) => !u.approved).length

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
                    <p className="text-gray-600">Approve or manage user access to the system</p>
                </div>

                {/* Filter Tabs */}
                <div className="bg-white rounded-lg shadow mb-6">
                    <div className="border-b border-gray-200">
                        <nav className="flex -mb-px">
                            <button
                                onClick={() => setFilter('pending')}
                                className={`px-6 py-3 text-sm font-medium border-b-2 ${filter === 'pending'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                Pending ({pendingCount})
                            </button>
                            <button
                                onClick={() => setFilter('approved')}
                                className={`px-6 py-3 text-sm font-medium border-b-2 ${filter === 'approved'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                Approved
                            </button>
                            <button
                                onClick={() => setFilter('all')}
                                className={`px-6 py-3 text-sm font-medium border-b-2 ${filter === 'all'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }`}
                            >
                                All Users
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Loading users...</div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No {filter === 'pending' ? 'pending' : filter === 'approved' ? 'approved' : ''} users found
                        </div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        User
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Role
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Created
                                    </th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredUsers.map((user) => (
                                    <tr key={user.id}>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {user.display_name || 'No name'}
                                                    </div>
                                                    <div className="text-sm text-gray-500">{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {user.approved ? (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                    Approved
                                                </span>
                                            ) : (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                    Pending
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(user.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {!user.approved ? (
                                                <button
                                                    onClick={() => handleApprove(user.id, true)}
                                                    disabled={processingUserId === user.id}
                                                    className="text-green-600 hover:text-green-900 disabled:opacity-50 mr-4"
                                                >
                                                    {processingUserId === user.id ? 'Processing...' : 'Approve'}
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => handleApprove(user.id, false)}
                                                    disabled={processingUserId === user.id}
                                                    className="text-red-600 hover:text-red-900 disabled:opacity-50"
                                                >
                                                    {processingUserId === user.id ? 'Processing...' : 'Revoke'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}
