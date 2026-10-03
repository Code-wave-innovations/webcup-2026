import type { Request, Response } from "express";
import prisma from "../lib/prisma";
import alertModel, { activeAlertWhere, concernsUser } from "../model/alert.model";
import { ANNOUNCEMENT_ORDER, announcementInclude, visibleAnnouncementWhere } from "../model/announcement.model";
import { SERVICE_ORDER, serviceListInclude } from "../model/cityService.model";
import serviceCategoryModel from "../model/serviceCategory.model";
import { OPEN_STATUSES } from "../model/citizenRequest.model";
import { resolveLocale, translate, translateServices } from "../lib/translations";

// D07: everything the home page needs in one call, most urgent first.
const homeController = {
  get: async (req: Request, res: Response) => {
    const locale = resolveLocale(req);
    const user = req.user;

    const [[alerts], services, categories, announcements, unread, openRequests] = await Promise.all([
      alertModel.list(activeAlertWhere(), 0, 5),
      // F28: featured services first, completed by priority and popularity
      prisma.cityService.findMany({
        where: { is_active: true },
        orderBy: SERVICE_ORDER.default,
        take: 8,
        include: serviceListInclude,
      }),
      serviceCategoryModel.getAll(),
      prisma.announcement.findMany({
        where: visibleAnnouncementWhere(),
        orderBy: ANNOUNCEMENT_ORDER,
        take: 5,
        include: announcementInclude,
      }),
      user ? prisma.notification.count({ where: { user_id: user.id, read_at: null } }) : Promise.resolve(0),
      user
        ? prisma.citizenRequest.count({ where: { citizen_id: user.id, status: { in: OPEN_STATUSES } } })
        : Promise.resolve(0),
    ]);

    res.json({
      alerts: (await translate("Alert", alerts, locale)).map((alert) => ({
        ...alert,
        concerns_me: concernsUser(alert, user),
      })),
      featured_services: await translateServices(services, locale),
      categories: await translate("ServiceCategory", categories, locale),
      announcements: await translate("Announcement", announcements, locale),
      me: user ? { unread_notifications: unread, open_requests: openRequests } : null,
    });
  },
};

export default homeController;
