import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchBoard } from '../api.js'
import type { Board } from '../types.js'

export const BOARD_KEY = ['board'] as const

const EMPTY_BOARD: Board = { tasks: [], sprints: [], people: [] }

export function useBoard() {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: BOARD_KEY,
    queryFn: fetchBoard,
    staleTime: 30_000,
  })

  // Subscribe to server-sent file-change events → invalidate board cache
  useEffect(() => {
    const es = new EventSource('/api/events')

    es.addEventListener('change', () => {
      queryClient.invalidateQueries({ queryKey: BOARD_KEY })
    })

    es.onerror = () => {
      // Silently reconnect — EventSource retries automatically
    }

    return () => es.close()
  }, [queryClient])

  const board = data ?? EMPTY_BOARD
  return {
    board,
    tasks: board.tasks,
    sprints: board.sprints,
    people: board.people,
    activeSprint: board.sprints.find(s => s.status === 'active') ?? null,
    isLoading,
    error,
  }
}
