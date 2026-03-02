import { kv } from '@vercel/kv'
import type { User, Project, UserRegistry } from './types.js'

export class KVRegistry implements UserRegistry {
  async findUser(githubId: number): Promise<User | null> {
    return kv.get<User>(`user:${githubId}`)
  }

  async saveUser(user: User): Promise<void> {
    await kv.set(`user:${user.github_id}`, user)
  }

  async addProject(githubId: number, info: Omit<Project, 'id' | 'added_at' | 'last_visited'>): Promise<Project> {
    const user = await this.findUser(githubId)
    if (!user) throw new Error('User not found')
    const project: Project = {
      ...info,
      id: `proj_${Date.now()}`,
      added_at: new Date().toISOString(),
      last_visited: new Date().toISOString(),
    }
    user.projects.push(project)
    await this.saveUser(user)
    return project
  }

  async removeProject(githubId: number, projectId: string): Promise<void> {
    const user = await this.findUser(githubId)
    if (!user) throw new Error('User not found')
    user.projects = user.projects.filter(p => p.id !== projectId)
    await this.saveUser(user)
  }

  async listProjects(githubId: number): Promise<Project[]> {
    const user = await this.findUser(githubId)
    return user?.projects ?? []
  }

  async touchProject(githubId: number, projectId: string): Promise<void> {
    const user = await this.findUser(githubId)
    if (!user) return
    const proj = user.projects.find(p => p.id === projectId)
    if (proj) {
      proj.last_visited = new Date().toISOString()
      await this.saveUser(user)
    }
  }
}
