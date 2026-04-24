import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import ClassCard from './ClassCard'
import ClassForm from './ClassForm'
import { useClasses } from '@/hooks/useClasses'
import type { ObjectClass } from '@/types/class.types'

export default function ClassesPage() {
  const { classes, createClass, updateClass, deleteClass } = useClasses()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ObjectClass | undefined>()
  const [deleting, setDeleting] = useState<ObjectClass | undefined>()
  const [deleteLoading, setDeleteLoading] = useState(false)

  const handleCreate = async (name: string, color: string) => {
    await createClass(name, color)
  }

  const handleEdit = async (name: string, color: string) => {
    if (!editing) return
    await updateClass({ ...editing, name, color })
    setEditing(undefined)
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteLoading(true)
    await deleteClass(deleting.id)
    setDeleteLoading(false)
    setDeleting(undefined)
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Clases</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Define los objetos que quieres reconocer
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} size="sm">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">Nueva</span> clase
        </Button>
      </div>

      {classes.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">◈</span>}
          title="Sin clases todavía"
          description="Crea al menos 2 clases para poder entrenar un modelo de reconocimiento."
          action={{ label: 'Crear primera clase', onClick: () => setShowForm(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {classes.map((cls) => (
            <ClassCard
              key={cls.id}
              cls={cls}
              onEdit={() => setEditing(cls)}
              onDelete={() => setDeleting(cls)}
            />
          ))}
          {/* Add new card */}
          <button
            onClick={() => setShowForm(true)}
            className="rounded-2xl border-2 border-dashed border-gray-800 hover:border-brand-600/50 hover:bg-brand-950/10 active:bg-brand-950/20 transition-all duration-150 min-h-[140px] sm:min-h-[180px] flex flex-col items-center justify-center gap-2 text-gray-600 hover:text-brand-400"
          >
            <svg className="w-7 h-7 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-sm font-medium">Nueva clase</span>
          </button>
        </div>
      )}

      <ClassForm open={showForm} onClose={() => setShowForm(false)} onSubmit={handleCreate} />

      {editing && (
        <ClassForm
          open={!!editing}
          onClose={() => setEditing(undefined)}
          onSubmit={handleEdit}
          editing={editing}
        />
      )}

      <Modal open={!!deleting} onClose={() => setDeleting(undefined)} title="Eliminar clase" size="sm">
        <p className="text-sm text-gray-400 mb-5">
          Se eliminarán la clase{' '}
          <span className="font-semibold text-gray-200">"{deleting?.name}"</span> y{' '}
          <span className="font-semibold text-gray-200">todas sus muestras</span>. Esta acción no se puede
          deshacer.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" onClick={() => setDeleting(undefined)} className="flex-1">
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleteLoading} className="flex-1">
            Eliminar
          </Button>
        </div>
      </Modal>
    </div>
  )
}
