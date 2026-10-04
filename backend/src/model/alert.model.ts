import type { AlertAudience, Prisma } from "@prisma/client";
import prisma from "../lib/prisma";
import { notifyUsers } from "../lib/notify";
import type { AuthUser } from "../middleware/auth";

const alertInclude = {
  districts: { include: { district: { select: { id: true, code: true, name: true } } } },
  created_by: { select: { id: true, name: true, last_name: true } },
} satisfies Prisma.AlertInclude;

type AlertRow = Prisma.AlertGetPayload<{ include: typeof alertInclude }>;

// Flattens the join table: districts: [{ id, code, name }]
const present = (alert: AlertRow) => ({
  ...alert,
  districts: alert.districts.map((link) => link.district),
});

export const activeAlertWhere = (): Prisma.AlertWhereInput => {
  const now = new Date();
  return {
    is_active: true,
    starts_at: { lte: now },
    OR: [{ ends_at: null }, { ends_at: { gt: now } }],
  };
};

// Severity enum is declared INFO < WARNING < CRITICAL, so desc puts critical alerts first.
const ALERT_ORDER: Prisma.AlertOrderByWithRelationInput[] = [{ severity: "desc" }, { starts_at: "desc" }];

// Who an alert targets. ALL: everyone. DISTRICTS: residents of the listed districts.
// VULNERABLE: people flagged vulnerable, restricted to the districts when some are listed (F31).
export const audienceUserWhere = (audience: AlertAudience, districtIds: number[]): Prisma.UserWhereInput => {
  const inDistricts = districtIds.length ? { district_id: { in: districtIds } } : {};
  if (audience === "DISTRICTS") return inDistricts;
  if (audience === "VULNERABLE") return { is_vulnerable: true, ...inDistricts };
  return {};
};

export const concernsUser = (
  alert: { audience: AlertAudience; districts: { id: number }[] },
  user?: AuthUser
) => {
  if (alert.audience === "ALL") return true;
  if (!user) return false;
  const ids = alert.districts.map((d) => d.id);
  const inDistrict = ids.length === 0 || (user.district_id !== null && ids.includes(user.district_id));
  if (alert.audience === "DISTRICTS") return inDistrict;
  return user.is_vulnerable && inDistrict;
};

type NotifiableAlert = {
  id: number;
  title: string;
  message: string;
  instructions: string | null;
  severity: string;
  category: string;
  audience: AlertAudience;
  districts: { id: number }[];
};

// D18: notifies the people an alert targets, once. Claiming notified_at first keeps the API and the
// cron job from sending the same alert twice. Returns the number notified, or null when already sent.
export const sendAlertNotifications = async (alert: NotifiableAlert, now = new Date()) => {
  const { count } = await prisma.alert.updateMany({ where: { id: alert.id, notified_at: null }, data: { notified_at: now } });
  if (count === 0) return null;
  const recipients = await notifyUsers(audienceUserWhere(alert.audience, alert.districts.map((d) => d.id)), {
    type: "ALERT",
    title: alert.title,
    body: alert.instructions ?? alert.message,
    link: `/alerts/${alert.id}`,
    data: { alert_id: alert.id, severity: alert.severity, category: alert.category },
  });
  await prisma.alert.update({ where: { id: alert.id }, data: { recipients } });
  return recipients;
};

const alertModel = {
  list: async (where: Prisma.AlertWhereInput, skip?: number, take?: number) => {
    const [rows, total] = await prisma.$transaction([
      prisma.alert.findMany({ where, orderBy: ALERT_ORDER, skip, take, include: alertInclude }),
      prisma.alert.count({ where }),
    ]);
    return [rows.map(present), total] as const;
  },
  getOne: async (where: Prisma.AlertWhereInput) => {
    const alert = await prisma.alert.findFirst({ where, include: alertInclude });
    return alert ? present(alert) : null;
  },
  create: async (data: Prisma.AlertUncheckedCreateInput, districtIds: number[]) =>
    present(
      await prisma.alert.create({
        data: { ...data, districts: { create: districtIds.map((district_id) => ({ district_id })) } },
        include: alertInclude,
      })
    ),
  update: async (id: number, data: Prisma.AlertUncheckedUpdateInput, districtIds?: number[]) =>
    present(
      await prisma.alert.update({
        where: { id },
        data: {
          ...data,
          ...(districtIds
            ? { districts: { deleteMany: {}, create: districtIds.map((district_id) => ({ district_id })) } }
            : {}),
        },
        include: alertInclude,
      })
    ),
  delete: (id: number) => prisma.alert.delete({ where: { id }, select: { id: true } }),
};

export default alertModel;
