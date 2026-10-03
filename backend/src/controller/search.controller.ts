import type { Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { SERVICE_ORDER, serviceListInclude } from "../model/cityService.model";
import { ANNOUNCEMENT_ORDER, visibleAnnouncementWhere } from "../model/announcement.model";
import { resolveLocale, searchTranslatedIds, translate, translateServices } from "../lib/translations";
import { isStaff } from "../middleware/auth";
import { withAvailability } from "../lib/availability";

// F32: one search box across services, procedures, announcements and the user's requests.

const querySchema = z.object({
  q: z.string().trim().min(2).max(100),
  limit: z.coerce.number().int().min(1).max(20).default(5),
});

const byIds = (ids: number[]) => (ids.length ? [{ id: { in: ids } }] : []);

const searchController = {
  search: async (req: Request, res: Response) => {
    const { q, limit } = querySchema.parse(req.query);
    const locale = resolveLocale(req);
    const user = req.user;

    const [serviceIds, procedureIds, announcementIds] = await Promise.all([
      searchTranslatedIds("CityService", locale, q),
      searchTranslatedIds("Procedure", locale, q),
      searchTranslatedIds("Announcement", locale, q),
    ]);

    const [services, procedures, announcements, requests] = await Promise.all([
      prisma.cityService.findMany({
        where: {
          is_active: true,
          OR: [
            { name: { contains: q } },
            { summary: { contains: q } },
            { keywords: { contains: q } },
            { category: { name: { contains: q } } },
            ...byIds(serviceIds),
          ],
        },
        orderBy: SERVICE_ORDER.default,
        take: limit,
        include: serviceListInclude(),
      }),
      prisma.procedure.findMany({
        where: {
          is_active: true,
          OR: [{ title: { contains: q } }, { description: { contains: q } }, ...byIds(procedureIds)],
        },
        orderBy: { title: "asc" },
        take: limit,
        include: { service: { select: { id: true, slug: true, name: true } } },
      }),
      prisma.announcement.findMany({
        where: {
          AND: [
            visibleAnnouncementWhere(),
            { OR: [{ title: { contains: q } }, { summary: { contains: q } }, ...byIds(announcementIds)] },
          ],
        },
        orderBy: ANNOUNCEMENT_ORDER,
        take: limit,
        select: { id: true, title: true, summary: true, category: true, is_important: true, published_at: true },
      }),
      user
        ? prisma.citizenRequest.findMany({
            where: {
              ...(isStaff(user) ? {} : { citizen_id: user.id }),
              OR: [{ reference: { contains: q } }, { subject: { contains: q } }],
            },
            orderBy: { created_at: "desc" },
            take: limit,
            select: { id: true, reference: true, subject: true, type: true, status: true, created_at: true },
          })
        : Promise.resolve([]),
    ]);

    res.json({
      q,
      services: (await translateServices(services, locale)).map(withAvailability),
      procedures: await translate("Procedure", procedures, locale),
      announcements: await translate("Announcement", announcements, locale),
      requests,
    });
  },
};

export default searchController;
