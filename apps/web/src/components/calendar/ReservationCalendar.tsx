'use client'
import { useRef, useState, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import jaLocale from '@fullcalendar/core/locales/ja'
import { useReservations, useUpdateReservation } from '@/hooks/useReservations'
import { STATUS_COLORS } from '@/lib/utils'
import { ReservationFormModal } from './ReservationFormModal'
import type { Reservation } from '@/types'

export function ReservationCalendar() {
  const calendarRef = useRef<any>(null)
  const [modalState, setModalState] = useState<{
    open: boolean
    defaultStart?: Date
    defaultEnd?: Date
    reservationId?: string
  }>({ open: false })

  const [dateRange, setDateRange] = useState(() => {
    const start = new Date()
    start.setDate(1)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)
    return { start, end }
  })

  const { data: reservations = [] } = useReservations(dateRange)
  const { mutate: updateReservation } = useUpdateReservation()

  const events = reservations.map((r) => ({
    id: r.id,
    title: `${r.customer.name} / ${r.vehicle.plateNumber}`,
    start: r.startAt,
    end: r.endAt,
    backgroundColor: STATUS_COLORS[r.status],
    borderColor: STATUS_COLORS[r.status],
    extendedProps: { reservation: r as Reservation },
  }))

  const handleEventDrop = useCallback(({ event }: any) => {
    updateReservation({
      id: event.id,
      startAt: event.start,
      endAt: event.end,
    })
  }, [updateReservation])

  const handleSelect = useCallback(({ start, end }: any) => {
    setModalState({ open: true, defaultStart: start, defaultEnd: end })
  }, [])

  const handleEventClick = useCallback(({ event }: any) => {
    setModalState({ open: true, reservationId: event.id })
  }, [])

  return (
    <>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale={jaLocale}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        slotMinTime="08:00:00"
        slotMaxTime="20:00:00"
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        events={events}
        editable
        droppable
        selectable
        selectMirror
        dayMaxEvents={3}
        nowIndicator
        eventDrop={handleEventDrop}
        select={handleSelect}
        eventClick={handleEventClick}
        datesSet={({ start, end }) => setDateRange({ start, end })}
        height="100%"
        eventContent={(arg) => {
          const r = arg.event.extendedProps.reservation as Reservation
          return (
            <div className="text-xs p-0.5 overflow-hidden">
              <div className="font-semibold truncate flex items-center gap-1">
                {r.isWalkIn && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-300 flex-shrink-0" title="飛び込み" />
                )}
                {r.status === 'PENDING' && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-300 flex-shrink-0" title="承認待ち" />
                )}
                {r.customer.name}
              </div>
              <div className="truncate opacity-80">{r.vehicle.plateNumber}</div>
            </div>
          )
        }}
      />

      {modalState.open && (
        <ReservationFormModal
          defaultStart={modalState.defaultStart}
          defaultEnd={modalState.defaultEnd}
          reservationId={modalState.reservationId}
          onClose={() => setModalState({ open: false })}
        />
      )}
    </>
  )
}
