import { useEffect, useState } from 'react'
import { subscribe, dismiss, type Toast } from '../lib/toast'

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])
  useEffect(() => subscribe(setToasts), [])

  if (!toasts.length) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(t => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`cursor-pointer rounded-lg px-4 py-3 text-sm shadow-lg ${
            t.type === 'error'
              ? 'bg-red-900/90 text-red-100'
              : 'bg-green-900/90 text-green-100'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
