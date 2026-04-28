import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { CLASS_COLORS } from '@/types/class.types'
import type { ObjectClass } from '@/types/class.types'

interface ClassFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (name: string, color: string) => Promise<void>
  editing?: ObjectClass
}

export default function ClassForm({ open, onClose, onSubmit, editing }: ClassFormProps) {
  const [name, setName] = useState(editing?.name ?? '')
  const [color, setColor] = useState(editing?.color ?? CLASS_COLORS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('El nombre es requerido')
      return
    }
    if (name.trim().length < 2) {
      setError('Mínimo 2 caracteres')
      return
    }
    setLoading(true)
    try {
      await onSubmit(name.trim(), color)
      setName('')
      setError('')
      onClose()
    } catch (error) {
      console.error('Error saving class:', error)
      setError('Error al guardar. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Editar clase' : 'Nueva clase'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">Nombre del objeto</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError('') }}
            placeholder="ej: Botella, Caja, Silla..."
            enterKeyHint="done"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
          />
          {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-2">Color del overlay</label>
          <div className="flex flex-wrap gap-2">
            {CLASS_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-8 h-8 rounded-full transition-all duration-150 focus:outline-none touch-manipulation"
                style={{
                  backgroundColor: c,
                  outline: color === c ? `2px solid ${c}` : '2px solid transparent',
                  outlineOffset: '3px',
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" loading={loading} className="flex-1">
            {editing ? 'Guardar cambios' : 'Crear clase'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
