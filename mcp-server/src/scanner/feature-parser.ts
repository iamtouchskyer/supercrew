import yaml from 'js-yaml'
import type { Feature, SupercrewStatus, Priority } from '../types.js'

export function parseMetaYaml(content: string, featureId: string): Partial<Feature> {
  const data = yaml.load(content) as Record<string, any>
  return {
    id: data.id ?? featureId,
    title: data.title ?? '',
    status: (data.status ?? 'planning') as SupercrewStatus,
    owner: data.owner ?? null,
    priority: data.priority as Priority ?? null,
    teams: data.teams ?? [],
    tags: data.tags ?? [],
    blocked_by: data.blocked_by ?? [],
    target_release: data.target_release ?? null,
    created_at: data.created ?? new Date().toISOString(),
    updated_at: data.updated ?? new Date().toISOString(),
    meta_yaml: content,
  }
}
