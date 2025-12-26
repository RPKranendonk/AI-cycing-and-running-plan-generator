// ============================================================================
// APP - MAIN ENTRY POINT
// React Router setup with Layout
// ============================================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { Toaster } from '@/components/ui/toaster'
import Layout from '@/components/layout'
import Dashboard from '@/pages/dashboard'
import Schedule from '@/pages/schedule'
import Progress from '@/pages/progress'
import Settings from '@/pages/settings'
import Onboarding from '@/pages/onboarding'
import './index.css'

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { athlete } = useStore()

  // If no athlete name, redirect to onboarding
  if (!athlete.name) {
    return <Navigate to="/onboarding" replace />
  }

  return <Layout>{children}</Layout>
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Onboarding - no layout */}
        <Route path="/onboarding" element={<Onboarding />} />

        {/* Protected routes with layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/schedule"
          element={
            <ProtectedRoute>
              <Schedule />
            </ProtectedRoute>
          }
        />
        <Route
          path="/progress"
          element={
            <ProtectedRoute>
              <Progress />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  )
}

export default App
