export type UserRole = 'ADMIN' | 'RECEPTIONIST' | 'MECHANIC'

export type ReservationStatus =
  | 'RESERVED'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'DELIVERED'
  | 'CANCELLED'

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  shopId: string
  shopName?: string
}

export interface Customer {
  id: string
  name: string
  kana?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  vehicles?: Vehicle[]
}

export interface Vehicle {
  id: string
  customerId: string
  customer?: Customer
  plateNumber: string
  make: string
  model: string
  year: number
  color?: string
  inspectionDate?: string
  nextServiceDate?: string
  lastMileage?: number
}

export interface Mechanic {
  id: string
  name: string
  color?: string
  isActive: boolean
}

export interface Service {
  id: string
  name: string
  description?: string
  durationMin: number
  basePrice?: number
}

export interface ReservationServiceItem {
  id: string
  service: Service
  price?: number
}

export interface Reservation {
  id: string
  customerId: string
  customer: Customer
  vehicleId: string
  vehicle: Vehicle
  mechanicId?: string
  mechanic?: Mechanic
  startAt: string
  endAt: string
  status: ReservationStatus
  notes?: string
  internalNotes?: string
  mileageAtService?: number
  totalAmount?: number
  services: ReservationServiceItem[]
}

export interface InvoiceItem {
  id: string
  name: string
  quantity: number
  unitPrice: number
  amount: number
}

export interface Invoice {
  id: string
  invoiceNumber: string
  status: InvoiceStatus
  issueDate: string
  subtotal: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  items: InvoiceItem[]
  reservation?: Reservation
}

export interface DashboardToday {
  date: string
  totalReservations: number
  byStatus: Record<ReservationStatus, number>
  inShopVehicles: number
  estimatedRevenue: number
  mechanicUtilization: {
    mechanicId: string
    name: string
    color?: string
    utilizationRate: number
    reservationCount: number
  }[]
  reservations: Reservation[]
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages?: number
}
