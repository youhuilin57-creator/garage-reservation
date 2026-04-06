-- ─────────────────────────────────
-- Step 2: スキーマ変更（Enum値追加のCOMMIT後に実行）
-- ─────────────────────────────────

-- ARRIVED → CHECKED_IN データ移行
UPDATE "Reservation" SET "status" = 'CHECKED_IN' WHERE "status" = 'ARRIVED';
UPDATE "ReservationStatusLog" SET "toStatus" = 'CHECKED_IN' WHERE "toStatus" = 'ARRIVED';
UPDATE "ReservationStatusLog" SET "fromStatus" = 'CHECKED_IN' WHERE "fromStatus" = 'ARRIVED';

-- ─────────────────────────────────
-- Shop テーブル変更
-- ─────────────────────────────────

ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "slug" TEXT;
UPDATE "Shop" SET "slug" = "id" WHERE "slug" IS NULL;
ALTER TABLE "Shop" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Shop_slug_key" ON "Shop"("slug");

ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "openTime" TEXT NOT NULL DEFAULT '08:00';
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "closeTime" TEXT NOT NULL DEFAULT '20:00';
ALTER TABLE "Shop" ADD COLUMN IF NOT EXISTS "slotMin" INTEGER NOT NULL DEFAULT 30;

UPDATE "Shop" SET "openTime" = "businessHoursStart", "closeTime" = "businessHoursEnd"
  WHERE "businessHoursStart" IS NOT NULL;

ALTER TABLE "Shop" DROP COLUMN IF EXISTS "businessHoursStart";
ALTER TABLE "Shop" DROP COLUMN IF EXISTS "businessHoursEnd";

-- ─────────────────────────────────
-- Vehicle テーブル変更
-- ─────────────────────────────────

ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "modelCode" TEXT;
ALTER TABLE "Vehicle" ALTER COLUMN "year" DROP NOT NULL;

-- ─────────────────────────────────
-- Service テーブル変更
-- ─────────────────────────────────

ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "requiresApproval" BOOLEAN NOT NULL DEFAULT false;

-- ─────────────────────────────────
-- Reservation テーブル変更
-- ─────────────────────────────────

ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "isWalkIn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "freeWorkNote" TEXT;
ALTER TABLE "Reservation" DROP COLUMN IF EXISTS "totalAmount";

-- ─────────────────────────────────
-- Reminder テーブル変更
-- ─────────────────────────────────

ALTER TABLE "Reminder" ADD COLUMN IF NOT EXISTS "type" "ReminderType";
UPDATE "Reminder" SET "type" = 'BOOKING_CONFIRM' WHERE "type" IS NULL;
ALTER TABLE "Reminder" ALTER COLUMN "type" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Reminder_reservationId_idx" ON "Reminder"("reservationId");

-- ─────────────────────────────────
-- Invoice テーブル変更
-- ─────────────────────────────────

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "paymentMethod" "PaymentMethod";
CREATE INDEX IF NOT EXISTS "Invoice_status_idx" ON "Invoice"("status");

-- ─────────────────────────────────
-- MechanicWorkHour 新規追加
-- ─────────────────────────────────

CREATE TABLE IF NOT EXISTS "MechanicWorkHour" (
    "id" TEXT NOT NULL,
    "mechanicId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isWorkDay" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT,
    "endTime" TEXT,
    CONSTRAINT "MechanicWorkHour_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MechanicWorkHour_mechanicId_dayOfWeek_key"
  ON "MechanicWorkHour"("mechanicId", "dayOfWeek");

CREATE INDEX IF NOT EXISTS "MechanicWorkHour_mechanicId_idx"
  ON "MechanicWorkHour"("mechanicId");

ALTER TABLE "MechanicWorkHour"
  ADD CONSTRAINT "MechanicWorkHour_mechanicId_fkey"
  FOREIGN KEY ("mechanicId") REFERENCES "Mechanic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────
-- ShopClosedDay 新規追加
-- ─────────────────────────────────

CREATE TABLE IF NOT EXISTS "ShopClosedDay" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    CONSTRAINT "ShopClosedDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShopClosedDay_shopId_date_key"
  ON "ShopClosedDay"("shopId", "date");

CREATE INDEX IF NOT EXISTS "ShopClosedDay_shopId_date_idx"
  ON "ShopClosedDay"("shopId", "date");

ALTER TABLE "ShopClosedDay"
  ADD CONSTRAINT "ShopClosedDay_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────
-- ReservationPart 新規追加
-- ─────────────────────────────────

CREATE TABLE IF NOT EXISTS "ReservationPart" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "partNumber" TEXT,
    "name" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReservationPart_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReservationPart_reservationId_idx"
  ON "ReservationPart"("reservationId");

ALTER TABLE "ReservationPart"
  ADD CONSTRAINT "ReservationPart_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────
-- ServiceRecord 新規追加
-- ─────────────────────────────────

CREATE TABLE IF NOT EXISTS "ServiceRecord" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "mileageAtDelivery" INTEGER,
    "workSummary" TEXT,
    "nextRecommend" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceRecord_reservationId_key"
  ON "ServiceRecord"("reservationId");

ALTER TABLE "ServiceRecord"
  ADD CONSTRAINT "ServiceRecord_reservationId_fkey"
  FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────
-- NextServiceReminder 新規追加
-- ─────────────────────────────────

CREATE TABLE IF NOT EXISTS "NextServiceReminder" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "type" "NextServiceType" NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "reminderAt" TIMESTAMP(3)[] NOT NULL DEFAULT ARRAY[]::TIMESTAMP(3)[],
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NextServiceReminder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NextServiceReminder_shopId_idx"
  ON "NextServiceReminder"("shopId");

CREATE INDEX IF NOT EXISTS "NextServiceReminder_vehicleId_idx"
  ON "NextServiceReminder"("vehicleId");

CREATE INDEX IF NOT EXISTS "NextServiceReminder_dueDate_idx"
  ON "NextServiceReminder"("dueDate");

ALTER TABLE "NextServiceReminder"
  ADD CONSTRAINT "NextServiceReminder_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NextServiceReminder"
  ADD CONSTRAINT "NextServiceReminder_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
