export type UserRole = 'ADMIN' | 'RECEPTIONIST' | 'MECHANIC'

export type ReservationStatus =
  | 'PENDING'
  | 'RESERVED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'WAITING_FOR_PARTS'
  | 'COMPLETED'
  | 'DELIVERED'
  | 'CANCELLED'

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED'
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER'
export type NextServiceType = 'SHAKEN' | 'PERIODIC' | 'OIL_CHANGE' | 'TIRE_ROTATION' | 'OTHER'

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
  modelCode?: string
  year?: number
  color?: string
  inspectionDate?: string
  lastMileage?: number
  notes?: string
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
  requiresApproval: boolean
}

export interface ReservationServiceItem {
  id: string
  service: Service
  price?: number
}

export interface ReservationPart {
  id: string
  reservationId: string
  partNumber?: string
  name: string
  unitPrice: number
  quantity: number
  notes?: string
  createdAt: string
}

export interface ServiceRecord {
  id: string
  reservationId: string
  mileageAtDelivery?: number
  workSummary?: string
  nextRecommend?: string
  createdByUserId?: string
  createdAt: string
  updatedAt: string
}

export interface NextServiceReminder {
  id: string
  shopId: string
  vehicleId: string
  vehicle?: Vehicle & { customer?: Customer }
  type: NextServiceType
  title: string
  dueDate: string
  reminderAt: string[]
  isSent: boolean
  isCompleted: boolean
  notes?: string
  createdAt: string
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
  isWalkIn: boolean
  notes?: string
  internalNotes?: string
  freeWorkNote?: string
  mileageAtService?: number
  services: ReservationServiceItem[]
  parts?: ReservationPart[]
  serviceRecord?: ServiceRecord
  invoice?: Invoice
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
  paymentMethod?: PaymentMethod
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
  pendingApprovals: number
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
