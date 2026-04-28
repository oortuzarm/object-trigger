import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { listProjects, saveProject, deleteProject } from '@/features/storage/projectsStore'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/components/ui/Toast'
import type { Project } from '@/types/project.types'
import { generateId } from '@/utils/generateId'

export default function ProjectsPage() {
  const { classes, activeProjectName, setActiveProjectName } = useAppStore()
  const [projects, setProjects] = useState<Project[]>([])
  const [saving, setSaving] = useState(false)
  const [projectName, setProjectName] = useState(activeProjectName)

  const load = async () => setProjects(await listProjects())

  useEffect(() => { load() }, [])

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!projectName.trim()) return
    setSaving(true)
    try {
      const project: Project = {
        id: generateId(),
        name: projectName.trim(),
        classIds: classes.map((c) => c.id),
        classCount: classes.length,
        sampleCount: classes.reduce((a, c) => a + c.sampleCount, 0),
        hasModel: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      await saveProject(project)
      setActiveProjectName(projectName.trim())
      await load()
      toast.success('Proyecto guardado')
    } catch {
      toast.error('Error al guardar el proyecto')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteProject(id)
      await load()
      toast.success('Proyecto eliminado')
    } catch {
      toast.error('Error al eliminar el proyecto')
    }
  }

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-100">Proyectos</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Guarda snapshots de tu proyecto actual</p>
      </div>

      {/* Wrapped in form so Enter/Done on mobile keyboard submits */}
      <Card className="mb-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Guardar proyecto actual</h2>
        <form onSubmit={handleSave} className="flex gap-2">
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Nombre del proyecto..."
            enterKeyHint="done"
            className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500"
          />
          <Button type="submit" loading={saving} disabled={!projectName.trim()} className="flex-shrink-0">
            Guardar
          </Button>
        </form>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            { label: 'clases', value: classes.length },
            { label: 'muestras', value: classes.reduce((a, c) => a + c.sampleCount, 0) },
            { label: 'con assets', value: classes.filter((c) => c.asset).length },
          ].map((s) => (
            <div key={s.label} className="bg-gray-950 rounded-lg p-2">
              <div className="text-base font-bold font-mono text-gray-200">{s.value}</div>
              <div className="text-[10px] text-gray-600">{s.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <h2 className="text-sm font-semibold text-gray-400 mb-3">
        Proyectos guardados ({projects.length})
      </h2>

      {projects.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">◱</span>}
          title="Sin proyectos guardados"
          description="Guarda el estado actual de tu proyecto para poder volver a él más tarde."
        />
      ) : (
        <div className="space-y-2">
          {[...projects].sort((a, b) => b.updatedAt - a.updatedAt).map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-gray-900 border border-gray-800"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-200 truncate">{p.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {p.classCount} clases · {p.sampleCount} muestras · {formatDate(p.updatedAt)}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {p.hasModel && <Badge variant="success" className="hidden sm:inline-flex">Modelo</Badge>}
                <button
                  type="button"
                  onClick={() => handleDelete(p.id)}
                  className="w-9 h-9 flex items-center justify-center text-gray-600 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors touch-manipulation"
                  aria-label="Eliminar proyecto"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
