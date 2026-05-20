'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot, Phone, Users, Package, BarChart3, Settings, Megaphone, LogOut, Menu, X
} from 'lucide-react';
import { cn } from '@/lib/utils/index';
import { useUIStore } from '@/lib/stores/ui';
import { getSupabaseClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const navItems = [
  { href: '/agents', label: 'Agentes', icon: Bot },
  { href: '/campaigns', label: 'Campañas', icon: Megaphone },
  { href: '/calls', label: 'Llamadas', icon: Phone },
  { href: '/prospects', label: 'Prospectos', icon: Users },
  { href: '/products', label: 'Productos', icon: Package },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/settings', label: 'Configuración', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 h-full w-64 bg-[#17120b] text-white z-30 flex flex-col transition-transform duration-300',
          !sidebarOpen && '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h1 className="font-heading text-xl font-bold text-white">Orkesta</h1>
            <p className="text-xs text-white/50 mt-0.5">Voice Platform</p>
          </div>
          <button
            className="lg:hidden text-white/60 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}

export function TopBar({ title }: { title?: string }) {
  const { setSidebarOpen } = useUIStore();

  return (
    <header className="h-16 border-b bg-white flex items-center gap-4 px-6">
      <button
        className="lg:hidden text-muted-foreground hover:text-foreground"
        onClick={() => setSidebarOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </button>
      {title && <h2 className="font-heading font-semibold text-lg">{title}</h2>}
    </header>
  );
}
