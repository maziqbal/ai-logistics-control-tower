import { useState } from 'react';
import { Boxes, Menu } from 'lucide-react';

import { Sidebar } from './components/layout/Sidebar';
import { FleetManagementPage } from './components/dispatch/FleetManagementPage';
import { OperationsOverviewPage } from './pages/OperationsOverviewPage';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activePage, setActivePage] = useState('Overview');

  function handleNavigate(page: string) {
    setActivePage(page);
    setSidebarOpen(false);
  }

  return (
    <div className="flex min-h-screen bg-[#f3f6fa]">
      <div className="sticky top-0 hidden h-screen shrink-0 lg:block">
        <Sidebar
          activePage={activePage}
          onNavigate={handleNavigate}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation overlay"
          />

          <div className="relative h-full">
            <Sidebar
              activePage={activePage}
              onNavigate={handleNavigate}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-17 items-center justify-between border-b border-slate-200 bg-white px-5 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={21} />
            </button>

            <div>
              <p className="text-[11px] text-slate-400">Workspace / {activePage}</p>
              <h1 className="text-sm font-bold text-[#14243b]">
                {activePage === 'Overview' ? 'Operations Dashboard' : activePage}
              </h1>
            </div>
          </div>

          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#17263d] text-xs font-bold text-white">
            CT
          </div>
        </header>

        <main className="mx-auto w-full max-w-400 flex-1 px-5 py-6 lg:px-8">
          {activePage === 'Overview' ? (
            <OperationsOverviewPage />
          ) : activePage === 'Drivers' ? (
            <FleetManagementPage />
          ) : (
            <section className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <Boxes size={23} />
              </div>

              <h2 className="text-xl font-bold text-[#14243b]">{activePage}</h2>
              <p className="mt-3 text-sm text-slate-500">
                This workspace will be implemented in a future ticket.
              </p>
            </section>
          )}
        </main>

        <footer className="border-t border-slate-200 px-8 py-4 text-center text-xs text-slate-400">
          AI Logistics Control Tower · Dispatcher Workspace
        </footer>
      </div>
    </div>
  );
}

export default App;
