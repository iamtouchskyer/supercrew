import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchBoard } from '../api.js'
import type { FeatureBoard } from '../types.js'

export const BOARD_KEY = ['board'] as const

const EMPTY_BOARD: FeatureBoard = {
  features: [],
  featuresByStatus: {
    planning: [], designing: [], ready: [], active: [], blocked: [], done: [],
  },
}

export function useBoard() {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: BOARD_KEY,
    queryFn: fetchBoard,
    staleTime: 30_000,
  })

  // Poll for data refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: BOARD_KEY })
    }, 30_000)
    return () => clearInterval(interval)
  }, [queryClient])

  const board = data ?? EMPTY_BOARD
  return {
    board,
    features: board.features,
    featuresByStatus: board.featuresByStatus,
    isLoading,
    error,
  }
}
