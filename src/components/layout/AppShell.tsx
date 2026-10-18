import * as React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { Topbar } from './Topbar'

export function AppShell() {
  const location = useLocation()

  /* Remonte en haut de page à chaque changement de route.
     (ScrollRestoration de React Router 7 exige un data router, non utilisé ici.) */
  React.useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return (
    <div className="min-h-dvh bg-surface">
      <Sidebar />
      <div className="lg:ps-64">
        <Topbar />
        <main className="mx-auto w-full max-w-7xl px-3 pb-28 pt-5 sm:px-5 lg:pb-10">
          <Outlet />
        </main>
        <footer className="no-print mx-auto w-full max-w-7xl px-3 pb-24 pt-2 text-center text-[11px] leading-relaxed text-anthracite-400 sm:px-5 lg:pb-8">
          Patrimoine.ma — outil de suivi, pas un conseil en investissement. Application en lecture
          seule : aucune passation d’ordre réel. Données différées / à titre indicatif.
        </footer>
      </div>
      <BottomNav />
    </div>
  )
}
