"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/guards";
import { policyError } from "@/lib/certificates/rules";
import { issueIfEligible } from "@/lib/certificates/service";
import { db } from "@/lib/db";
import { assertTeachesClass } from "@/lib/teacher/access";

export type PolicyResult = { ok?: boolean; issued?: number; error?: "invalid" | "order" | "range" } | undefined;

const num = z.coerce.number().finite();
const schema = z.object({
  bronzeMin: num,
  silverMin: num,
  goldMin: num,
  platinumMin: num,
  minBuildingLevel: z.coerce.number().int(),
});

/** Students of the class who now meet the requirements get their certificate (or a higher tier). */
async function issueForClass(classId: string) {
  const members = await db.classMember.findMany({ where: { classId }, select: { studentId: true } });
  let issued = 0;
  for (const m of members) if (await issueIfEligible(m.studentId)) issued++;
  return issued;
}

/** Class certificate thresholds (spec §2.2, §7: the teacher sets the tier limits). */
export async function saveCertificatePolicy(
  classId: string,
  _prev: PolicyResult,
  formData: FormData,
): Promise<PolicyResult> {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await assertTeachesClass(user, classId);

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const error = policyError(parsed.data);
  if (error) return { error };

  await db.certificatePolicy.upsert({
    where: { classId },
    update: parsed.data,
    create: { classId, ...parsed.data },
  });
  await audit({
    actorId: user.id,
    action: "class.certificatePolicy.update",
    entity: "SchoolClass",
    entityId: classId,
    data: parsed.data,
  });
  const issued = await issueForClass(classId);
  revalidatePath("/[locale]/teacher/certificates", "page");
  return { ok: true, issued };
}

/** Back to the platform defaults set by the admin. */
export async function resetCertificatePolicy(classId: string) {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await assertTeachesClass(user, classId);
  await db.certificatePolicy.deleteMany({ where: { classId } });
  await audit({ actorId: user.id, action: "class.certificatePolicy.reset", entity: "SchoolClass", entityId: classId });
  await issueForClass(classId);
  revalidatePath("/[locale]/teacher/certificates", "page");
}
