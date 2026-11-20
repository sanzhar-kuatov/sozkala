import "server-only";
import type { Prisma } from "@/generated/prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Creates a new student's city: 8 empty lots (level 0), spec §13 step 1
 * "logs in and sees an empty plot". Used by registration and (later) by
 * teacher/admin account creation.
 */
export async function createCityForStudent(tx: Tx, studentId: string, name: string) {
  const buildings = await tx.buildingType.findMany({ select: { id: true } });
  return tx.city.create({
    data: {
      studentId,
      name,
      buildings: { create: buildings.map((b) => ({ buildingTypeId: b.id, level: 0 })) },
    },
  });
}

export const CITY_NAME_MAX = 40;
