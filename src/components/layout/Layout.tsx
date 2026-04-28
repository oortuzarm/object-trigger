import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useEffect } from 'react'
import { useAppStore } from '@/store/appStore'
import { getAllClasses } from '@/features/storage/classesStore'
import { loadModel } from '@/features/storage/modelsStore'

export default function Layout() {
  const { setClasses, setModelReady } = useAppStore()

  useEffect(() => {
    // Load classes first, then cross-validate stored model against actual class IDs.
    // If any class the model was trained on no longer exists, the model is stale
    // and modelStatus stays 'not_trained' (IDB cleanup happens on next deleteClass).
    getAllClasses().then((classes) => {
      setClasses(classes)
      loadModel().then((m) => {
        if (!m || m.classIds.length === 0) return
        const currentIds = new Set(classes.map((c) => c.id))
        const allPresent = m.classIds.every((id) => currentIds.has(id))
        if (allPresent && classes.length > 0) {
          setModelReady(m.classIds)
        }
      })
    })
  }, [])

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-gray-950">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar />
        {/* pb-24 reserves space for mobile bottom nav + iOS safe area home indicator; lg+ has no bottom nav */}
        <main className="flex-1 overflow-y-auto pb-24 lg:pb-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
