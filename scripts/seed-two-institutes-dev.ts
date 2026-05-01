/**
 * Dev-only: two tenants (SGAM, Samata) with admin, head coach, assistant, coach, branch, batch, students, attendance.
 * Idempotent gate: skips if pf-sgam-admin@mallatrack.test already exists.
 *
 * Usage: npm run seed:two-institutes:dev
 * Refuses when NODE_ENV === "production".
 */
import "dotenv/config";

import bcrypt from "bcryptjs";
import { ROLE_ADMIN, ROLE_ASSISTANT_COACH, ROLE_HEAD_COACH } from "../lib/roles";
import { prisma } from "../lib/prisma";
import { getIndiaTodayCalendarYmd } from "../lib/datetime-india";

const PASSWORD = "DevSeed123!";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("seed-two-institutes-dev: refused in production.");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set.");
  }

  const gateEmail = "pf-sgam-admin@mallatrack.test".toLowerCase();
  const existing = await prisma.user.findUnique({
    where: { email: gateEmail },
    select: { id: true },
  });
  if (existing) {
    console.log("seed:two-institutes:dev — already applied (gate user exists).");
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const todayYmd = getIndiaTodayCalendarYmd();

  async function seedTenant(
    label: string,
    emails: {
      admin: string;
      head: string;
      assistant: string;
    },
  ) {
    const institute = await prisma.institute.create({
      data: { name: label },
    });
    const branch = await prisma.branch.create({
      data: { name: `${label} — Main`, instituteId: institute.id },
    });
    const coach = await prisma.coach.create({
      data: {
        fullName: `${label} Head Coach (record)`,
        status: "ACTIVE",
        instituteId: institute.id,
      },
    });
    const batch = await prisma.batch.create({
      data: {
        name: `${label} Batch A`,
        status: "ACTIVE",
        branchId: branch.id,
        instituteId: institute.id,
        coachId: coach.id,
      },
    });

    await prisma.user.create({
      data: {
        email: emails.admin,
        passwordHash,
        role: ROLE_ADMIN,
        instituteId: institute.id,
        branchId: null,
      },
    });
    await prisma.user.create({
      data: {
        email: emails.head,
        passwordHash,
        role: ROLE_HEAD_COACH,
        instituteId: institute.id,
        branchId: branch.id,
      },
    });
    const asstUser = await prisma.user.create({
      data: {
        email: emails.assistant,
        passwordHash,
        role: ROLE_ASSISTANT_COACH,
        instituteId: institute.id,
        branchId: null,
      },
    });

    await prisma.batchAssistant.create({
      data: { batchId: batch.id, userId: asstUser.id },
    });

    const studentInBatch = await prisma.student.create({
      data: {
        fullName: `${label} Student (in batch)`,
        dob: "2012-01-15",
        gender: "Male",
        status: "ACTIVE",
        instituteId: institute.id,
        batchId: batch.id,
      },
    });
    await prisma.student.create({
      data: {
        fullName: `${label} Student (unassigned)`,
        dob: "2013-06-01",
        gender: "Female",
        status: "ACTIVE",
        instituteId: institute.id,
        batchId: null,
      },
    });

    await prisma.attendance.create({
      data: {
        studentId: studentInBatch.id,
        batchId: batch.id,
        instituteId: institute.id,
        date: todayYmd,
        status: "PRESENT",
        submittedByUserId: asstUser.id,
        submittedAt: new Date(),
        editCount: 0,
      },
    });
  }

  await seedTenant("SGAM", {
    admin: gateEmail,
    head: "pf-sgam-head@mallatrack.test",
    assistant: "pf-sgam-asst@mallatrack.test",
  });

  await seedTenant("Samata", {
    admin: "pf-samata-admin@mallatrack.test",
    head: "pf-samata-head@mallatrack.test",
    assistant: "pf-samata-asst@mallatrack.test",
  });

  console.log("seed:two-institutes:dev — done");
  console.log(`  Password for all seed users: ${PASSWORD}`);
  console.log("  SGAM admin:    pf-sgam-admin@mallatrack.test");
  console.log("  Samata admin: pf-samata-admin@mallatrack.test");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
