import {
  Boxes,
  CalendarDays,
  ChevronRight,
  CircleDot,
  LayoutDashboard,
  Map,
  Package,
  Route,
  Truck,
  X,
} from 'lucide-react';

type SidebarProps = {
  activePage: string;
  onNavigate: (page: string) => void;
  onClose: () => void;
};

const navigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Delivery Days', icon: CalendarDays },
  { label: 'Routes', icon: Route },
  { label: 'Live Tracking', icon: Map },
  { label: 'Drivers', icon: Truck },
  { label: 'Parcels', icon: Package },
];

export function Sidebar({ activePage, onNavigate, onClose }: SidebarProps) {
  return (
    <aside className="flex h-full w-60 flex-col bg-[#101d31] text-slate-300">
      <div className="flex h-19 items-center gap-3 border-b border-white/10 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500 text-white">
          <Boxes size={21} />
        </div>

        <div className="min-w-0">
          <div className="text-xs font-bold tracking-wide text-white">CONTROL TOWER</div>
          <div className="text-[10px] text-slate-400">Logistics Intelligence</div>
        </div>

        <button
          type="button"
          className="ml-auto lg:hidden"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
      </div>

      <div className="px-3 pt-6">
        <p className="mb-3 px-3 text-[10px] font-bold tracking-[0.18em] text-slate-500 uppercase">
          Workspace
        </p>

        <nav className="space-y-1" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon }) => {
            const active = activePage === label;

            return (
              <button
                key={label}
                type="button"
                onClick={() => onNavigate(label)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                  active
                    ? 'bg-teal-400/12 font-semibold text-teal-200 ring-1 ring-teal-400/20'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={17} />
                <span className="flex-1">{label}</span>
                {active && <ChevronRight size={15} />}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto px-4 pb-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-200">
            <CircleDot size={13} className="text-teal-400" />
            Dispatcher workspace
          </div>

          <p className="text-[11px] leading-relaxed text-slate-400">
            Manage delivery operations from one central workspace.
          </p>
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-white/10 pt-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
            CT
          </div>

          <div>
            <p className="text-xs font-semibold text-white">Dispatcher</p>
            <p className="mt-1 text-[10px] text-slate-400">Operations team</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
