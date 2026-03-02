type Toast = { id: number; message: string; type: 'error' | 'success' }
type Listener = (toasts: Toast[]) => void

let toasts: Toast[] = []
let nextId = 0
const listeners = new Set<Listener>()

function emit() { listeners.forEach(fn => fn([...toasts])) }

export function toast(message: string, type: 'error' | 'success' = 'error') {
  const id = nextId++
  toasts = [...toasts, { id, message, type }]
  emit()
  setTimeout(() => dismiss(id), 4000)
}

export function dismiss(id: number) {
  toasts = toasts.filter(t => t.id !== id)
  emit()
}

export function subscribe(fn: Listener) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export type { Toast }
