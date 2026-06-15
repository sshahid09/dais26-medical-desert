import { createBrowserRouter, RouterProvider, NavLink, Outlet } from 'react-router';
import { useState, useEffect } from 'react';
import { Button, Sheet, SheetContent, SheetHeader, SheetTitle, useIsMobile } from '@databricks/appkit-ui/react';
import { Menu, Activity } from 'lucide-react';
import { MapPage } from './pages/MapPage';
import { DistrictsPage } from './pages/DistrictsPage';
import { ComparePage } from './pages/ComparePage';
import { AboutPage } from './pages/AboutPage';
import { useCompare } from './lib/compareStore';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
    isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
  }`;

type NavLinkClassFn = (props: { isActive: boolean }) => string;

function NavLinks({ className, linkClass, onClick }: { className?: string; linkClass: NavLinkClassFn; onClick?: () => void }) {
  const { keys } = useCompare();
  return (
    <nav className={className}>
      <NavLink to="/" end className={linkClass} onClick={onClick}>Map</NavLink>
      <NavLink to="/districts" className={linkClass} onClick={onClick}>Districts</NavLink>
      <NavLink to="/compare" className={linkClass} onClick={onClick}>
        Compare{keys.length > 0 && <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{keys.length}</span>}
      </NavLink>
      <NavLink to="/about" className={linkClass} onClick={onClick}>Methodology</NavLink>
    </nav>
  );
}

function Layout() {
  const isMobile = useIsMobile();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  useEffect(() => { if (!isMobile) setMobileNavOpen(false); }, [isMobile]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-card px-4 md:px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <h1 className="text-base font-bold text-foreground">Medical Desert Planner</h1>
            <p className="hidden sm:block text-[11px] text-muted-foreground">India · where to act, why, and how much to trust it</p>
          </div>
        </div>
        <NavLinks className="hidden md:flex gap-1 ml-4" linkClass={navLinkClass} />
        <div className="ml-auto md:hidden">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <Button variant="ghost" size="icon" onClick={() => setMobileNavOpen(true)}>
              <Menu className="h-5 w-5" />
              <span className="sr-only">Open navigation</span>
            </Button>
            <SheetContent side="left">
              <SheetHeader><SheetTitle>Navigation</SheetTitle></SheetHeader>
              <NavLinks className="flex flex-col gap-1 mt-4" linkClass={mobileNavLinkClass} onClick={() => setMobileNavOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6 max-w-[1400px] w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <MapPage /> },
      { path: '/districts', element: <DistrictsPage /> },
      { path: '/compare', element: <ComparePage /> },
      { path: '/about', element: <AboutPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
