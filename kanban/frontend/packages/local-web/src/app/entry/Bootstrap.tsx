import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { ErrorBoundary } from '../../components/ErrorBoundary'
import { Toaster } from '../../components/Toaster'
import { toast } from '../../lib/toast'
import '@web/styles/index.css'
import '@web/styles/reactbits.css'
import '@web/i18n'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
    mutations: {
      onError: (error: Error) => {
        toast(error.message, 'error')
      },
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
      <Toaster />
    </ErrorBoundary>
  </React.StrictMode>
)
