'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarDays, Users, Car, Wrench, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

const nav: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard',    label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/reservations', label: '予約カレンダー', icon: CalendarDays },
  { href: '/customers',    label: '顧客管理',       icon: Users },
  { href: '/vehicles',     label: '車両管理',       icon: Car },
  { href: '/mechanics',    label: '整備士',         icon: Wrench },
  { href: '/settings',     label: '設定',           icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div className="p-5 border-b border-gray-100">
        <h1 className="text-sm font-bold text-gray-900">整備予約管理</h1>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition',
                active
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
