import type { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { ACTION_NEEDED_STATUSES, OPEN_STATUSES, requestListInclude } from "../model/citizenRequest.model";
import { activeAlertWhere } from "../model/alert.model";
import { visibleAnnouncementWhere } from "../model/announcement.model";
import { activity, appointmentsToday, overdueWhere, summary, trends } from "../model/dashboard.model";

// D17 workload at a glance, F22 / D19 agent workspace, F50 simplified dashboard

const trendsQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(90).default(14) });
const summaryQuerySchema = z.object({ period: z.enum(["today", "7d", "30d"]).default("7d") });
const activityQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) });

const dashboardController = {
  stats: async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const open = { status: { in: OPEN_STATUSES } };

    const [
      awaitingPickup,
      needsAction,
      openTotal,
      unassignedOpen,
      mineOpen,
      byStatus,
      byType,
      openByPriority,
      oldestAwaiting,
      recent,
      citizens,
      activeAlerts,
      publishedAnnouncements,
      todayAppointments,
      openByAgent,
      overdue,
      overdueCount,
      incidentsByDistrict,
    ] = await Promise.all([
      prisma.citizenRequest.count({ where: { status: "SUBMITTED" } }),
      prisma.citizenRequest.count({ where: { status: { in: ACTION_NEEDED_STATUSES } } }),
      prisma.citizenRequest.count({ where: open }),
      prisma.citizenRequest.count({ where: { ...open, assigned_agent_id: null } }),
      prisma.citizenRequest.count({ where: { status: { in: ACTION_NEEDED_STATUSES }, assigned_agent_id: userId } }),
      prisma.citizenRequest.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.citizenRequest.groupBy({ by: ["type"], where: open, _count: { _all: true } }),
      prisma.citizenRequest.groupBy({ by: ["priority"], where: open, _count: { _all: true } }),
      prisma.citizenRequest.findMany({
        where: { status: "SUBMITTED" },
        orderBy: { created_at: "asc" },
        take: 3,
        select: { id: true, reference: true, subject: true, priority: true, created_at: true },
      }),
      prisma.citizenRequest.findMany({
        where: { status: { in: ACTION_NEEDED_STATUSES } },
        orderBy: [{ priority: "desc" }, { created_at: "asc" }],
        take: 10,
        include: requestListInclude,
      }),
      prisma.user.count({ where: { role: "CITIZEN", is_active: true } }),
      prisma.alert.count({ where: activeAlertWhere() }),
      prisma.announcement.count({ where: visibleAnnouncementWhere() }),
      appointmentsToday(),
      prisma.citizenRequest.groupBy({ by: ["assigned_agent_id"], where: { status: { in: ACTION_NEEDED_STATUSES } }, _count: { _all: true } }),
      prisma.citizenRequest.findMany({
        where: overdueWhere(new Date()),
        orderBy: [{ priority: "desc" }, { created_at: "asc" }],
        take: 20,
        include: requestListInclude,
      }),
      prisma.citizenRequest.count({ where: overdueWhere(new Date()) }),
      prisma.citizenRequest.groupBy({ by: ["district_id"], where: { type: "INCIDENT", ...open }, _count: { _all: true } }),
    ]);

    // F22 / D17: load of each agent (open requests needing action); unassigned ones are not counted
    const agentIds = openByAgent.map((row) => row.assigned_agent_id).filter((id): id is number => id !== null);
    const agents = await prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true, last_name: true } });
    const agentsById = new Map(agents.map((agent) => [agent.id, agent]));

    res.json({
      requests: {
        // D17: waiting for someone to pick them up
        awaiting_pickup: awaitingPickup,
        needs_action: needsAction,
        open: openTotal,
        unassigned_open: unassignedOpen,
        assigned_to_me: mineOpen,
        oldest_awaiting: oldestAwaiting[0] ?? null,
        // The three oldest, for the agent dashboard
        oldest_awaiting_list: oldestAwaiting,
        by_status: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
        open_by_type: Object.fromEntries(byType.map((row) => [row.type, row._count._all])),
        open_by_priority: Object.fromEntries(openByPriority.map((row) => [row.priority, row._count._all])),
        open_by_agent: openByAgent
          .filter((row) => row.assigned_agent_id !== null && agentsById.has(row.assigned_agent_id))
          .map((row) => ({ agent: agentsById.get(row.assigned_agent_id!)!, count: row._count._all }))
          .sort((a, b) => b.count - a.count),
        // Still waiting on the city past the delay of their priority (OVERDUE_HOURS), most serious first
        overdue_count: overdueCount,
        overdue,
        // F25: open incident reports per district (key "none" when no district was given)
        incidents_by_district: Object.fromEntries(incidentsByDistrict.map((row) => [row.district_id ?? "none", row._count._all])),
      },
      // F39: not cancelled, over the whole day (server time zone)
      appointments: { today: todayAppointments },
      // Highest priority first, then oldest
      queue: recent,
      platform: {
        citizens,
        active_alerts: activeAlerts,
        published_announcements: publishedAnnouncements,
      },
    });
  },

  // D19: activity over the last `days` days (charts of the admin overview)
  trends: async (req: Request, res: Response) => {
    const { days } = trendsQuerySchema.parse(req.query);
    res.json(await trends(days));
  },

  // F22 / D19: what the staff did lately on the requests (until the audit log, BO-03)
  activity: async (req: Request, res: Response) => {
    const { limit } = activityQuerySchema.parse(req.query);
    res.json(await activity(limit));
  },

  // F50: a few indicators compared with the previous period, plus what needs attention
  summary: async (req: Request, res: Response) => {
    const { period } = summaryQuerySchema.parse(req.query);
    res.json(await summary(period, req.user!.role));
  },
};

export default dashboardController;
