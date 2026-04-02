'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useCustomers } from '@/hooks/useCustomers'

export default function CustomersPage() {
  const [q, setQ] = useState('')
  const { data: customers = [], isLoading } = useCustomers(q || undefined)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">顧客管理</h1>
        <Link href="/customers/new" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          + 新規顧客
        </Link>
      </div>

      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="名前・電話番号・メールで検索"
        className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
      />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">顧客が見つかりません</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['氏名', '電話番号', 'メール', '車両数', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {c.name}
                    {c.kana && <span className="ml-2 text-xs text-gray-400">{c.kana}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.phone ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.email ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.vehicles?.length ?? 0}台</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/customers/${c.id}`} className="text-blue-600 hover:underline text-xs">
                      詳細
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
