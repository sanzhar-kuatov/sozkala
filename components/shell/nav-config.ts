import {
  Award,
  Bell,
  Building2,
  ChartColumn,
  ChartLine,
  ClipboardCheck,
  ClipboardList,
  DatabaseBackup,
  Eye,
  GraduationCap,
  House,
  Landmark,
  LayoutDashboard,
  School,
  ScrollText,
  ShieldCheck,
  Settings,
  Tags,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

export const roles = ["student", "teacher", "parent", "admin"] as const;
export type Role = (typeof roles)[number];

/** Icon that represents each role (landing page, login, avatars). */
export const roleIcon: Record<Role, LucideIcon> = {
  student: Building2,
  teacher: ClipboardCheck,
  parent: Eye,
  admin: ShieldCheck,
};

export type NavItem = {
  /** Path without locale, e.g. "/student/rewards". */
  href: string;
  /** Key inside `nav.<role>` in messages/*.json. */
  key: string;
  icon: LucideIcon;
};

export const navByRole: Record<Role, NavItem[]> = {
  student: [
    { href: "/student", key: "city", icon: Building2 },
    { href: "/student/rewards", key: "rewards", icon: Trophy },
    { href: "/student/history", key: "history", icon: ChartLine },
    { href: "/student/certificate", key: "certificate", icon: GraduationCap },
  ],
  teacher: [
    { href: "/teacher", key: "dashboard", icon: LayoutDashboard },
    { href: "/teacher/classes", key: "classes", icon: Users },
    { href: "/teacher/topics", key: "topics", icon: Tags },
    { href: "/teacher/tasks", key: "tasks", icon: ClipboardList },
    { href: "/teacher/buildings", key: "buildings", icon: Landmark },
    { href: "/teacher/review", key: "review", icon: ClipboardCheck },
    { href: "/teacher/analytics", key: "analytics", icon: ChartColumn },
    { href: "/teacher/certificates", key: "certificates", icon: Award },
  ],
  parent: [
    { href: "/parent", key: "overview", icon: House },
    { href: "/parent/notifications", key: "notifications", icon: Bell },
  ],
  admin: [
    { href: "/admin", key: "overview", icon: LayoutDashboard },
    { href: "/admin/users", key: "users", icon: Users },
    { href: "/admin/schools", key: "schools", icon: School },
    { href: "/admin/buildings", key: "buildings", icon: Landmark },
    { href: "/admin/certificates", key: "certificates", icon: Award },
    { href: "/admin/settings", key: "settings", icon: Settings },
    { href: "/admin/logs", key: "logs", icon: ScrollText },
    { href: "/admin/backups", key: "backups", icon: DatabaseBackup },
  ],
};

/** Root path of a role's cabinet: "/student", "/teacher", ... */
export const roleHome = (role: Role) => navByRole[role][0].href;

/** Active when the path equals the item, or is nested under it (except the cabinet root). */
export function isActive(pathname: string, href: string, role: Role) {
  if (href === roleHome(role)) {
    // The parent's home also covers the child pages (/parent/child/…).
    return pathname === href || (role === "parent" && pathname.startsWith("/parent/child/"));
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
