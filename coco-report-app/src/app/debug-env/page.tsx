'use client'

import { useEffect, useState } from 'react'

export default function DebugEnvPage() {
    const [envInfo, setEnvInfo] = useState<any>(null)

    useEffect(() => {
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''

        setEnvInfo({
            url: supabaseUrl,
            anonKeyPrefix: anonKey.substring(0, 15) + '...',
            anonKeyLength: anonKey.length,
            isSecret: anonKey.startsWith('sb_secret') || anonKey.includes('service_role')
        })

        console.log('Debug Env:', {
            url: supabaseUrl,
            anonKey: anonKey, // Full key in console for user to check
        })
    }, [])

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Environment Debug</h1>
            {envInfo && (
                <pre className="bg-gray-100 p-4 rounded">
                    {JSON.stringify(envInfo, null, 2)}
                </pre>
            )}
            <p className="mt-4 text-sm text-gray-600">
                Check the browser console for the full key.
            </p>
        </div>
    )
}
