import type { Request, Response } from "express";
import prisma from "../lib/prisma";
import { ACTION_NEEDED_STATUSES, OPEN_STATUSES, requestListInclude } from "../model/citizenRequest.model";
import { activeAlertWhere } from "../model/alert.model";
import { visibleAnnouncementWhere } from "../model/announcement.model";

// D17 workload at a glance, F22 / D19 agent workspace

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
    ] = await Promise.all([
      prisma.citizenRequest.count({ where: { status: "SUBMITTED" } }),
      prisma.citizenRequest.count({ where: { status: { in: ACTION_NEEDED_STATUSES } } }),
      prisma.citizenRequest.count({ where: open }),
      prisma.citizenRequest.count({ where: { ...open, assigned_agent_id: null } }),
      prisma.citizenRequest.count({ where: { status: { in: ACTION_NEEDED_STATUSES }, assigned_agent_id: userId } }),
      prisma.citizenRequest.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.citizenRequest.groupBy({ by: ["type"], where: open, _count: { _all: true } }),
      prisma.citizenRequest.groupBy({ by: ["priority"], where: open, _count: { _all: true } }),
      prisma.citizenRequest.findFirst({
        where: { status: "SUBMITTED" },
        orderBy: { created_at: "asc" },
        select: { id: true, reference: true, created_at: true },
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
    ]);

    res.json({
      requests: {
        // D17: waiting for someone to pick them up
        awaiting_pickup: awaitingPickup,
        needs_action: needsAction,
        open: openTotal,
        unassigned_open: unassignedOpen,
        assigned_to_me: mineOpen,
        oldest_awaiting: oldestAwaiting,
        by_status: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
        open_by_type: Object.fromEntries(byType.map((row) => [row.type, row._count._all])),
        open_by_priority: Object.fromEntries(openByPriority.map((row) => [row.priority, row._count._all])),
      },
      // Highest priority first, then oldest
      queue: recent,
      platform: {
        citizens,
        active_alerts: activeAlerts,
        published_announcements: publishedAnnouncements,
      },
    });
  },
};

export default dashboardController;
