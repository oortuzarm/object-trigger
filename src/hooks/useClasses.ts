import { useCallback } from 'react'
import { useAppStore } from '@/store/appStore'
import {
  getAllClasses,
  saveClass,
  deleteClass as deleteClassDB,
} from '@/features/storage/classesStore'
import { deleteSamplesByClass } from '@/features/storage/samplesStore'
import { deleteAssetBlob } from '@/features/storage/assetsStore'
import type { ObjectClass } from '@/types/class.types'
import { createObjectClass, CLASS_COLORS } from '@/types/class.types'
import { toast } from '@/components/ui/Toast'

export function useClasses() {
  const { classes, setClasses, upsertClass, removeClass } = useAppStore()

  const refresh = useCallback(async () => {
    const all = await getAllClasses()
    setClasses(all)
  }, [setClasses])

  const createClass = useCallback(
    async (name: string, color?: string) => {
      const cls = createObjectClass(name.trim(), color)
      await saveClass(cls)
      upsertClass(cls)
      toast.success(`Clase "${cls.name}" creada`)
      return cls
    },
    [upsertClass]
  )

  const updateClass = useCallback(
    async (updated: ObjectClass) => {
      await saveClass(updated)
      upsertClass(updated)
    },
    [upsertClass]
  )

  const deleteClass = useCallback(
    async (id: string) => {
      const cls = classes.find((c) => c.id === id)
      // delete asset blob if exists
      if (cls?.asset && 'blobId' in (cls.asset.config as unknown as Record<string, unknown>)) {
        const blobId = (cls.asset.config as unknown as { blobId: string }).blobId
        await deleteAssetBlob(blobId)
      }
      await deleteSamplesByClass(id)
      await deleteClassDB(id)
      removeClass(id)
      toast.success(`Clase "${cls?.name}" eliminada`)
    },
    [classes, removeClass]
  )

  const getColorForIndex = (index: number) =>
    CLASS_COLORS[index % CLASS_COLORS.length]

  return {
    classes,
    refresh,
    createClass,
    updateClass,
    deleteClass,
    getColorForIndex,
  }
}
