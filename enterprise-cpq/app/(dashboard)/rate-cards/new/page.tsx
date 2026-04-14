'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NewRateCardPage() {
  const router = useRouter()

  useEffect(() => {
    async function create() {
      try {
        const res = await fetch('/api/rate-cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Untitled Rate Card' }),
        })
        const data = await res.json()
        if (data.rateCard?.id) {
          router.replace(`/rate-cards/${data.rateCard.id}`)
        } else {
          router.replace('/proposals')
        }
      } catch {
        router.replace('/proposals')
      }
    }
    create()
  }, [router])

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full mx-auto mb-3"
          style={{ borderColor: '#FF492C', borderTopColor: 'transparent' }} />
        <p className="text-gray-500 text-sm">Creating rate card...</p>
      </div>
    </div>
  )
}
