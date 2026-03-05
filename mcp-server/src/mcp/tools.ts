import { z } from 'zod'
import type { FeatureStore } from '../store/feature-store.js'
import type { EventBus } from '../events/event-bus.js'
import type { SupercrewStatus } from '../types.js'

export function createTools(store: FeatureStore, eventBus: EventBus) {
  return {
    list_features: {
      description: '列出所有 features',
      inputSchema: {},
      handler: async () => {
        const features = store.listAll()
        return { content: [{ type: 'text' as const, text: JSON.stringify(features, null, 2) }] }
      },
    },

    get_feature: {
      description: '获取单个 feature 详情',
      inputSchema: {
        id: z.string().describe('Feature ID'),
      },
      handler: async ({ id }: { id: string }) => {
        const feature = store.get(id)
        if (!feature) {
          return { content: [{ type: 'text' as const, text: `Feature ${id} not found` }], isError: true }
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(feature, null, 2) }] }
      },
    },

    create_feature: {
      description: '创建新 feature',
      inputSchema: {
        id: z.string().describe('Feature ID (e.g., login-page)'),
        title: z.string().describe('Feature title'),
        priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
        owner: z.string().optional().describe('Owner username'),
      },
      handler: async (input: { id: string; title: string; priority?: string; owner?: string }) => {
        const feature = store.create({
          id: input.id,
          title: input.title,
          priority: input.priority as any,
          owner: input.owner,
        })
        eventBus.featureCreated(feature)
        return { content: [{ type: 'text' as const, text: `Created feature: ${feature.id}` }] }
      },
    },

    update_feature_status: {
      description: '更新 feature 状态',
      inputSchema: {
        id: z.string(),
        status: z.enum(['planning', 'designing', 'ready', 'active', 'blocked', 'done']),
      },
      handler: async ({ id, status }: { id: string; status: SupercrewStatus }) => {
        const feature = store.updateStatus(id, status)
        if (!feature) {
          return { content: [{ type: 'text' as const, text: `Feature ${id} not found` }], isError: true }
        }
        eventBus.featureUpdated(feature)
        return { content: [{ type: 'text' as const, text: `Updated ${id} status to ${status}` }] }
      },
    },

    log_progress: {
      description: '追加 feature log 记录',
      inputSchema: {
        id: z.string(),
        entry: z.string().describe('Progress entry to append'),
      },
      handler: async ({ id, entry }: { id: string; entry: string }) => {
        const feature = store.appendLog(id, entry)
        if (!feature) {
          return { content: [{ type: 'text' as const, text: `Feature ${id} not found` }], isError: true }
        }
        eventBus.featureUpdated(feature)
        return { content: [{ type: 'text' as const, text: `Added log entry to ${id}` }] }
      },
    },
  }
}
