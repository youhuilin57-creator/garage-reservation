'use client'
import Link from 'next/link'

const sections = [
  { href: '/settings/services', label: '整備メニュー管理', desc: '整備メニューの追加・編集・削除' },
  { href: '/settings/users', label: 'ユーザー管理', desc: 'スタッフアカウントの管理' },
  { href: '/settings/booking-page', label: 'セルフ予約ページ', desc: '顧客向け予約URLの発行・管理' },
]

export default function SettingsPage() {
  return (
    <div className="space-y-5 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900">設定</h1>
      <div className="space-y-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="block bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 transition"
          >
            <p className="font-semibold text-gray-900">{s.label}</p>
            <p className="text-sm text-gray-500 mt-1">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
