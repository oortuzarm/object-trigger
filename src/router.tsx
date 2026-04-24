import { createBrowserRouter } from 'react-router-dom'
import Layout from '@/components/layout/Layout'
import Dashboard from '@/pages/Dashboard'
import ClassesPage from '@/pages/Classes/ClassesPage'
import CapturePage from '@/pages/Capture/CapturePage'
import DatasetPage from '@/pages/Dataset/DatasetPage'
import TrainingPage from '@/pages/Training/TrainingPage'
import ConfigurePage from '@/pages/Configure/ConfigurePage'
import InferencePage from '@/pages/Inference/InferencePage'
import ProjectsPage from '@/pages/Projects/ProjectsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'classes', element: <ClassesPage /> },
      { path: 'capture/:classId', element: <CapturePage /> },
      { path: 'dataset', element: <DatasetPage /> },
      { path: 'training', element: <TrainingPage /> },
      { path: 'configure', element: <ConfigurePage /> },
      { path: 'inference', element: <InferencePage /> },
      { path: 'projects', element: <ProjectsPage /> },
    ],
  },
])
