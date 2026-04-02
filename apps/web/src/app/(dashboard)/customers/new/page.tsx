'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCreateCustomer } from '@/hooks/useCustomers'

export default function NewCustomerPage() {
  const router = useRouter()
  const { mutate: create, isPending } = useCreateCustomer()

  const [form, setForm] = useState({
    name: '', kana: '', phone: '', email: '', address: '', notes: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    create(form, { onSuccess: (c) => router.push(`/customers/${c.id}`) })
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">新規顧客登録</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        {[
          { name: 'name', label: '氏名', required: true },
          { name: 'kana', label: 'フリガナ' },
          { name: 'phone', label: '電話番号', type: 'tel' },
          { name: 'email', label: 'メールアドレス', type: 'email' },
          { name: 'address', label: '住所' },
        ].map((f) => (
          <div key={f.name}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {f.label}{f.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type={f.type ?? 'text'}
              name={f.name}
              value={(form as any)[f.name]}
              onChange={handleChange}
              required={f.required}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">備考</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50">
            戻る
          </button>
          <button type="submit" disabled={isPending} className="flex-1 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {isPending ? '登録中...' : '登録'}
          </button>
        </div>
      </form>
    </div>
  )
}
