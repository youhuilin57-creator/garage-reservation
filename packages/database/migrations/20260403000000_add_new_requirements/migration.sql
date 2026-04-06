-- ─────────────────────────────────
-- Step 1: Enum 値の追加のみ（USE前にCOMMIT必須）
-- ─────────────────────────────────

ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'CHECKED_IN';
ALTER TYPE "ReservationStatus" ADD VALUE IF NOT EXISTS 'WAITING_FOR_PARTS';

ALTER TYPE "ReminderStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

CREATE TYPE "ReminderType" AS ENUM (
  'BOOKING_CONFIRM',
  'REMINDER_DAY_BEFORE',
  'REMINDER_MORNING',
  'REMINDER_1H_BEFORE',
  'WORK_COMPLETED',
  'NEXT_SERVICE'
);

CREATE TYPE "NextServiceType" AS ENUM (
  'SHAKEN',
  'PERIODIC',
  'OIL_CHANGE',
  'TIRE_ROTATION',
  'OTHER'
);

CREATE TYPE "PaymentMethod" AS ENUM (
  'CASH',
  'CARD',
  'TRANSFER',
  'OTHER'
);
