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
    console.log('[ClassForm] form submit fired, name=', JSON.stringify(name))
    if (!name.trim()) {
      setError('El nombre es requerido')
      console.log('[ClassForm] validation failed: empty name')
      return
    }
    if (name.trim().length < 2) {
      setError('Mínimo 2 caracteres')
      console.log('[ClassForm] validation failed: too short')
      return
    }
    setLoading(true)
    try {
      console.log('[ClassForm] calling onSubmit...')
      await onSubmit(name.trim(), color)
      console.log('[ClassForm] onSubmit ok, closing modal')
      setName('')
      setError('')
      onClose()
    } catch (err) {
      console.error('[ClassForm] onSubmit threw:', err)
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
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
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
                className="w-7 h-7 rounded-full transition-all duration-150 focus:outline-none"
                style={{
                  backgroundColor: c,
                  outline: color === c ? `2px solid ${c}` : '2px solid transparent',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            type="submit"
            loading={loading}
            className="flex-1"
            onTouchStart={() => console.log('[ClassForm] submit button touchstart')}
            onTouchEnd={() => console.log('[ClassForm] submit button touchend')}
            onClick={() => console.log('[ClassForm] submit button click')}
          >
            {editing ? 'Guardar cambios' : 'Crear clase'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
