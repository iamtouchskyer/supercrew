import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-100">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <p className="text-neutral-400">{this.state.error?.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded bg-neutral-800 px-4 py-2 hover:bg-neutral-700"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
