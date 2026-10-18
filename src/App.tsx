import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { TooltipProvider } from '@/components/ui/controls'
import { ToastProvider } from '@/components/ui/toast'
import { I18nProvider } from '@/i18n'
import { PreferencesProvider } from '@/state/preferences'
import { AuthProvider, useAuth } from '@/state/auth'
import { StoreProvider } from '@/state/store'
import { AppShell } from '@/components/layout/AppShell'

import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import OtpPage from '@/pages/auth/OtpPage'
import DashboardPage from '@/pages/DashboardPage'

/* Code-splitting : une entrée JS par écran (le tableau de bord reste eager) */
const ActionsPage = lazy(() => import('@/pages/actions/ActionsPage'))
const ActionDetailPage = lazy(() => import('@/pages/actions/ActionDetailPage'))
const OpcvmPage = lazy(() => import('@/pages/opcvm/OpcvmPage'))
const FundDetailPage = lazy(() => import('@/pages/opcvm/FundDetailPage'))
const OperationsPage = lazy(() => import('@/pages/operations/OperationsPage'))
const AnalysePage = lazy(() => import('@/pages/analyse/AnalysePage'))
const FiscalitePage = lazy(() => import('@/pages/fiscalite/FiscalitePage'))
const AlertesPage = lazy(() => import('@/pages/alertes/AlertesPage'))
const SimulationPage = lazy(() => import('@/pages/simulation/SimulationPage'))
const ProfilPage = lazy(() => import('@/pages/profil/ProfilPage'))

/** Squelette affiché pendant le chargement d'un écran */
function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" aria-busy="true">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        <p className="text-sm text-muted">Chargement…</p>
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <I18nProvider>
      <PreferencesProvider>
        <ToastProvider>
          <AuthProvider>
            <TooltipProvider delayDuration={120}>
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/otp" element={<OtpPage />} />

                  <Route
                    element={
                      <RequireAuth>
                        <StoreProvider>
                          <AppShell />
                        </StoreProvider>
                      </RequireAuth>
                    }
                  >
                    <Route
                      path="/"
                      element={
                        <Suspense fallback={<RouteFallback />}>
                          <DashboardPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/actions"
                      element={
                        <Suspense fallback={<RouteFallback />}>
                          <ActionsPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/actions/:id"
                      element={
                        <Suspense fallback={<RouteFallback />}>
                          <ActionDetailPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/opcvm"
                      element={
                        <Suspense fallback={<RouteFallback />}>
                          <OpcvmPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/opcvm/:id"
                      element={
                        <Suspense fallback={<RouteFallback />}>
                          <FundDetailPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/operations"
                      element={
                        <Suspense fallback={<RouteFallback />}>
                          <OperationsPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/analyse"
                      element={
                        <Suspense fallback={<RouteFallback />}>
                          <AnalysePage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/fiscalite"
                      element={
                        <Suspense fallback={<RouteFallback />}>
                          <FiscalitePage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/alertes"
                      element={
                        <Suspense fallback={<RouteFallback />}>
                          <AlertesPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/simulation"
                      element={
                        <Suspense fallback={<RouteFallback />}>
                          <SimulationPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/profil"
                      element={
                        <Suspense fallback={<RouteFallback />}>
                          <ProfilPage />
                        </Suspense>
                      }
                    />
                  </Route>

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </AuthProvider>
        </ToastProvider>
      </PreferencesProvider>
    </I18nProvider>
  )
}
