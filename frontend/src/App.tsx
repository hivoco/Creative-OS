import { Navigate, Route, Routes, useParams } from 'react-router-dom'

import { Toaster } from '@/components/ui/sonner'

import { RequireAuth } from '@/components/RequireAuth'
import { RequireAdmin } from '@/components/RequireAdmin'
import { LoginPage } from '@/pages/LoginPage'
import { ToolPickerPage } from '@/pages/ToolPickerPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { VideoPage } from '@/pages/VideoPage'
import { EditorPage } from '@/pages/EditorPage'
import { BrandsAdminPage } from '@/pages/admin/BrandsAdminPage'
import { BrandDetailPage } from '@/pages/admin/BrandDetailPage'

// Remount the editor on version switch so transient state resets cleanly.
function EditorRoute() {
  const { versionId } = useParams()
  return <EditorPage key={versionId} />
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <ToolPickerPage />
            </RequireAuth>
          }
        />
        <Route
          path="/templates"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/video"
          element={
            <RequireAuth>
              <VideoPage />
            </RequireAuth>
          }
        />
        <Route
          path="/editor/:versionId"
          element={
            <RequireAuth>
              <EditorRoute />
            </RequireAuth>
          }
        />
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <BrandsAdminPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/brands/:brandId"
          element={
            <RequireAdmin>
              <BrandDetailPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </>
  )
}
