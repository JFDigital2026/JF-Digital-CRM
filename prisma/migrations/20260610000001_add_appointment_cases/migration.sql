-- CreateTable
CREATE TABLE "AppointmentCase" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "fathomLink" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentAttendee" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,

    CONSTRAINT "AppointmentAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppointmentCase_companyId_idx" ON "AppointmentCase"("companyId");

-- CreateIndex
CREATE INDEX "AppointmentAttendee_caseId_idx" ON "AppointmentAttendee"("caseId");

-- AddForeignKey
ALTER TABLE "AppointmentCase" ADD CONSTRAINT "AppointmentCase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentAttendee" ADD CONSTRAINT "AppointmentAttendee_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "AppointmentCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
