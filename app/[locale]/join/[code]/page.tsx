import { CircleCheck, Lock, SearchX, Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { homeFor } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { joinAsCurrentStudent } from "./actions";
import { RegisterForm } from "./register-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("join");
  return { title: t("title") };
}

/** Student registration by class invite code (/join/SOZ7A1). */
export default async function JoinPage({ params }: PageProps<"/[locale]/join/[code]">) {
  const { code } = await params;
  const t = await getTranslations();
  const klass = await db.schoolClass.findFirst({
    where: { inviteCode: decodeURIComponent(code).toUpperCase(), archivedAt: null },
    select: {
      id: true,
      name: true,
      inviteCode: true,
      school: { select: { name: true } },
      teacher: { select: { firstName: true, lastName: true } },
    },
  });
  const user = await getCurrentUser();

  let body: React.ReactNode;
  if (!(await getSetting("registration.studentsByInviteCode"))) {
    body = (
      <div className="grid justify-items-center gap-3 py-6 text-center">
        <span className="grid size-14 place-items-center rounded-lg bg-sun-100 text-sun-700">
          <Lock className="size-7" aria-hidden />
        </span>
        <h1 className="text-xl font-extrabold">{t("join.closedTitle")}</h1>
        <p className="text-muted">{t("join.closedBody")}</p>
        <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
          {t("common.login")}
        </Link>
      </div>
    );
  } else if (!klass) {
    body = (
      <div className="grid justify-items-center gap-3 py-6 text-center">
        <span className="grid size-14 place-items-center rounded-lg bg-coral-100 text-coral-700">
          <SearchX className="size-7" aria-hidden />
        </span>
        <h1 className="text-xl font-extrabold">{t("join.invalidTitle")}</h1>
        <p className="text-muted">{t("join.invalidBody")}</p>
        <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
          {t("common.login")}
        </Link>
      </div>
    );
  } else {
    const header = (
      <div className="grid gap-2">
        <h1 className="text-2xl font-extrabold">{t("join.title")}</h1>
        <p className="flex items-center gap-2 font-bold text-ink-700">
          <Users className="size-5 text-primary" aria-hidden />
          {t("join.classInfo", { className: klass.name, school: klass.school.name })}
        </p>
        <p className="text-sm text-muted">
          {t("join.teacher", { name: `${klass.teacher.firstName} ${klass.teacher.lastName}` })}
        </p>
      </div>
    );

    if (!user) {
      body = (
        <>
          {header}
          <p className="text-muted">{t("join.subtitle")}</p>
          <RegisterForm code={klass.inviteCode} />
          <p className="text-center text-sm text-muted">
            {t("join.haveAccount")}{" "}
            <Link href="/login" className="font-bold text-primary-edge">
              {t("common.login")}
            </Link>
          </p>
        </>
      );
    } else if (user.role !== "STUDENT") {
      body = (
        <>
          {header}
          <p className="rounded-md bg-sun-100 px-3 py-2.5 text-sm font-semibold">{t("join.otherRole")}</p>
          <Link href={homeFor(user.role)} className={buttonVariants({ variant: "ghost" })}>
            {t("common.openCabinet")}
          </Link>
        </>
      );
    } else {
      const member = await db.classMember.findUnique({
        where: { classId_studentId: { classId: klass.id, studentId: user.id } },
      });
      body = (
        <>
          {header}
          {member ? (
            <>
              <p className="flex items-center gap-2 font-bold text-grass-700">
                <CircleCheck className="size-5" aria-hidden />
                {t("join.alreadyMember")}
              </p>
              <Link href="/student" className={buttonVariants()}>
                {t("common.openCabinet")}
              </Link>
            </>
          ) : (
            <form action={joinAsCurrentStudent.bind(null, klass.inviteCode)}>
              <Button type="submit" size="lg" variant="accent" className="w-full">
                {t("join.joinAsMe", { name: user.firstName })}
              </Button>
            </form>
          )}
        </>
      );
    }
  }

  return (
    <main id="main" className="sky-gradient grid min-h-dvh place-items-center px-4 py-10">
      <div className="grid w-full max-w-[480px] gap-5">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-fg no-underline">
            <Logo name={t("brand.name")} />
          </Link>
          <LocaleSwitcher />
        </div>
        <Card className="grid gap-5 p-6">{body}</Card>
      </div>
    </main>
  );
}
