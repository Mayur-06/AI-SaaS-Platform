import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  BrainCircuit,
  CreditCard,
  Key,
  Settings,
  ShieldAlert,
  LogOut,
  Menu,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useBillingStore } from '../../store/billingStore';
import { orgService } from '../../services/orgService';
import { Avatar, AvatarFallback } from '../ui/Avatar';
import { Sheet, SheetTrigger, SheetContent } from '../ui/Sheet';

export const AppLayout = () => {
  const { user, organization, role, logout, setOrganization } = useAuthStore();
  const { currentPlan, fetchBillingData } = useBillingStore();
  const navigate = useNavigate();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    fetchBillingData();
    orgService
      .getOrg()
      .then((org) => {
        if (org) {
          setOrganization(org);
          try {
            localStorage.setItem('ai_saas_org', JSON.stringify(org));
          } catch {}
        }
      })
      .catch(() => {});
  }, [fetchBillingData, setOrganization]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const planName = currentPlan?.name || organization?.plan?.name || 'Free';

  const navItems = [];

  if (user?.is_staff) {
    navItems.push({ to: '/admin', label: 'Admin Console', icon: ShieldAlert });
  } else {
    navItems.push({ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard });
  }

  navItems.push(
    { to: '/ai', label: 'AI Query & RAG', icon: BrainCircuit },
    { to: '/billing', label: 'Billing & Usage', icon: CreditCard },
    { to: '/keys', label: 'API Keys', icon: Key },
    { to: '/settings', label: 'Org Settings', icon: Settings }
  );

  // Get user avatar initials
  const initials = (user?.email || 'U')
    .slice(0, 2)
    .toUpperCase();

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#292929] text-white">
      {/* Brand Header */}
      <div className="p-6 border-b border-white/10">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 no-underline group"
        >
          <span
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-2xl font-extrabold text-white tracking-tight"
          >
            Hapy<span className="text-[#b2c147]">●</span>
          </span>
        </Link>

        {/* Org & Context Info */}
        <div className="mt-4 pt-4 border-t border-white/5 space-y-1">
          {user?.is_staff ? (
            <>
              <div className="text-xs font-semibold text-gray-300">
                Superadmin Mode
              </div>
              <div className="text-[11px] text-purple-400 font-mono">
                Platform Admin
              </div>
            </>
          ) : organization ? (
            <>
              <div className="text-xs font-semibold text-gray-300 truncate">
                {organization.name}
              </div>
              <div className="text-[11px] text-gray-400 capitalize">
                {planName} Plan
              </div>
            </>
          ) : (
            <>
              <div className="text-xs font-semibold text-gray-300 truncate">
                My Organization
              </div>
              <div className="text-[11px] text-gray-400 capitalize">
                {planName} Plan
              </div>
            </>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileDrawerOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 no-underline ${
                  isActive
                    ? 'text-[#b2c147] bg-white/5 border-l-2 border-[#b2c147] pl-3'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer & Logout */}
      <div className="p-4 border-t border-white/10 bg-black/20">
        <div className="flex items-center gap-3 mb-3 px-1">
          {/* Avatar Component */}
          <Avatar className="h-8 w-8">
            <AvatarFallback variant="brand">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white truncate">
              {user?.email}
            </div>
            <div className="text-[10px] text-gray-400 capitalize">
              {role || (user?.is_staff ? 'Superadmin' : 'Member')}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#fbfbfb] text-[#292929]">
      
      {/* Mobile Top Navbar (Small screens only) */}
      <div className="md:hidden flex items-center justify-between px-4 h-16 bg-[#292929] text-white border-b border-white/10 sticky top-0 z-30">
        <Link to="/" className="flex items-center gap-1.5 no-underline">
          <span
            style={{ fontFamily: '"Cabinet Grotesk", Inter, sans-serif' }}
            className="text-xl font-bold text-white tracking-tight"
          >
            Hapy<span className="text-[#b2c147]">●</span>
          </span>
        </Link>
        {/* Mobile Context & Drawer Trigger */}
        <div className="flex items-center gap-2.5">
          {user?.is_staff ? (
            <div className="text-right max-w-[120px] sm:max-w-[160px] truncate">
              <div className="text-[11px] font-semibold text-purple-300 truncate leading-tight">
                Superadmin
              </div>
              <div className="text-[9px] text-purple-400 font-mono tracking-wider leading-tight">
                Platform Admin
              </div>
            </div>
          ) : organization ? (
            <div className="text-right max-w-[120px] sm:max-w-[160px] truncate">
              <div className="text-[11px] font-semibold text-gray-200 truncate leading-tight">
                {organization.name}
              </div>
              <div className="text-[9px] text-[#b2c147] uppercase font-mono tracking-wider leading-tight">
                {planName}
              </div>
            </div>
          ) : null}

          <Avatar className="h-7 w-7">
            <AvatarFallback variant="brand" className="text-[10px]">{initials}</AvatarFallback>
          </Avatar>

          <Sheet open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="p-2 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 focus:outline-none cursor-pointer"
                aria-label="Toggle navigation drawer"
              >
                <Menu size={22} />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SidebarContent />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop Persistent Sidebar (>= md screens) */}
      <aside className="hidden md:flex md:w-64 flex-col shrink-0 min-h-screen sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Main App Content Area */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        <Outlet />
      </main>

    </div>
  );
};
