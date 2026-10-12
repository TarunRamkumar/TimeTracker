'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  BarChart3,
  Settings,
  Clock,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Calendar', href: '/calendar', icon: Calendar },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <aside
      className={`shrink-0 border-r border-slate-200 bg-white/95 backdrop-blur transition-[width] duration-200 dark:border-slate-800 dark:bg-slate-950/90 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="border-b border-slate-200 p-4 dark:border-slate-800">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between gap-3'}`}>
            <div className={`flex min-w-0 items-center ${collapsed ? 'justify-center' : 'gap-2'}`}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 shadow-sm shadow-blue-500/25">
                <Clock className="h-5 w-5 text-white" />
              </div>
              {!collapsed ? (
                <span className="truncate text-lg font-bold text-slate-950 dark:text-slate-50">
                  TimeTracker
                </span>
              ) : null}
            </div>
            {!collapsed ? (
              <button
                type="button"
                onClick={onToggle}
                aria-label="Collapse sidebar"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-950 dark:hover:text-white"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {collapsed ? (
            <button
              type="button"
              onClick={onToggle}
              aria-label="Expand sidebar"
              className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-950 dark:hover:text-white"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 space-y-1 py-6 ${collapsed ? 'px-3' : 'px-4'}`}>
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.name : undefined}
                aria-label={item.name}
                className={`flex rounded-xl py-2.5 transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium shadow-sm shadow-blue-100/60 dark:bg-blue-500/15 dark:text-blue-200 dark:shadow-none'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white'
                } ${collapsed ? 'justify-center px-0' : 'items-center gap-3 px-4'}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed ? <span className="truncate">{item.name}</span> : null}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={collapsed ? 'Toggle theme' : undefined}
            className={`flex rounded-2xl border border-slate-200 bg-slate-50 text-left text-sm text-slate-700 shadow-sm shadow-slate-200/50 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-950 ${
              collapsed ? 'w-full items-center justify-center px-0 py-3' : 'w-full items-center justify-between px-4 py-3'
            }`}
          >
            {!collapsed ? (
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">Theme</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Switch between light and dark
                </p>
              </div>
            ) : null}
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {isDark ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
              {!collapsed ? (isDark ? 'Dark' : 'Light') : null}
            </span>
          </button>

          {!collapsed ? (
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">© 2026 TimeTracker</p>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
