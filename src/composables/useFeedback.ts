import { ref } from 'vue'

type ToastType = 'info' | 'success' | 'error'

type LogLevel = 'info' | 'success' | 'error'

interface Toast {
  id: string
  message: string
  type: ToastType
  createdAt: number
}

interface LogEntry {
  id: string
  level: LogLevel
  message: string
  timestamp: number
}

const toasts = ref<Toast[]>([])
const logs = ref<LogEntry[]>([])

function createId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function showToast(message: string, type: ToastType = 'info', duration = 2500) {
  const id = createId()
  const toast: Toast = { id, message, type, createdAt: Date.now() }
  toasts.value = [...toasts.value, toast]
  if (typeof window !== 'undefined') {
    window.setTimeout(() => dismissToast(id), duration)
  }
}

function dismissToast(id: string) {
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

function pushLog(level: LogLevel, message: string) {
  const entry: LogEntry = { id: createId(), level, message, timestamp: Date.now() }
  logs.value = [entry, ...logs.value].slice(0, 30)
}

export function useFeedback() {
  return {
    toasts,
    logs,
    showToast,
    dismissToast,
    pushLog,
  }
}
