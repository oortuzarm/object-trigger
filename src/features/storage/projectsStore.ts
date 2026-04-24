import { getDB } from './db'
import type { Project } from '@/types/project.types'

export async function listProjects(): Promise<Project[]> {
  const db = await getDB()
  return db.getAll('projects')
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB()
  return db.get('projects', id)
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB()
  await db.put('projects', { ...project, updatedAt: Date.now() })
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('projects', id)
}
