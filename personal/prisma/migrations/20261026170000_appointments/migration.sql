-- Millie's own appointments. The app never writes these to Google Calendar.
CREATE TYPE "AppointmentType" AS ENUM ('HAIR', 'AESTHETICS', 'WORK', 'MEETING', 'MEAL', 'PARTY', 'DINNER', 'TRAVEL', 'OTHER');

CREATE TYPE "AppointmentReminder" AS ENUM ('NONE', 'MORNING', 'DAY_BEFORE', 'BOTH');

CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "AppointmentType" NOT NULL DEFAULT 'OTHER',
    "startDay" DATE NOT NULL,
    "endDay" DATE NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT NOT NULL DEFAULT '',
    "endTime" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "reminder" "AppointmentReminder" NOT NULL DEFAULT 'NONE',
    "morningSentAt" TIMESTAMP(3),
    "dayBeforeSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Appointment_startDay_idx" ON "Appointment"("startDay");

CREATE INDEX "Appointment_endDay_idx" ON "Appointment"("endDay");
