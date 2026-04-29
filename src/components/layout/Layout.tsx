import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { getAllClasses } from '@/features/storage/classesStore'
import { loadModel } from '@/features/storage/modelsStore'
import { getEmbeddingCountsMap } from '@/features/embeddings/embeddingStore'

export default function Layout() {
  const { setClasses, setModelReady, setEmbeddingCounts } = useAppStore()

  useEffect(() => {
    getAllClasses().then((classes) => {
      setClasses(classes)

      // Classifier validation
      loadModel().then((m) => {
        if (!m || m.classIds.length === 0) return
        const currentIds = new Set(classes.map((c) => c.id))
        const allPresent = m.classIds.every((id) => currentIds.has(id))
        if (allPresent && classes.length > 0) setModelReady(m.classIds)
      })

      // Embedding counts (used by Training page and sidebar)
      getEmbeddingCountsMap().then((counts) => {
        setEmbeddingCounts(counts)
      })
    })
  }, [])

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gray-950">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto pb-24 lg:pb-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
