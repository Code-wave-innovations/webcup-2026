import type { Request, Response } from "express";
import { AlertAudience, AlertSeverity, Prisma } from "@prisma/client";
import { z } from "zod";
import alertModel, { activeAlertWhere, audienceUserWhere, concernsUser } from "../model/alert.model";
import { badRequest, notFound } from "../lib/errors";
import { notifyUsers } from "../lib/notify";
import { pageMeta, paginationSchema, parseId, toSkipTake, zBool, zDate, zId, zJson } from "../lib/validation";
import { resolveLocale, translate, translateOne } from "../lib/translations";
import { isStaff } from "../middleware/auth";

// D18 city-wide message, F29 district alert (flood), F31 vulnerable people (heat wave)

const recommendationSchema = z.union([
  z.string().min(1),
  z.object({ title: z.string().optional(), text: z.string().min(1), audience: z.string().optional() }),
]);

const createSchema = z.object({
  title: z.string().trim().min(1).max(191),
  message: z.string().trim().min(1).max(10000),
  category: z.string().trim().toUpperCase().max(50).optional(),
  severity: z.nativeEnum(AlertSeverity).optional(),
  audience: z.nativeEnum(AlertAudience).default("ALL"),
  district_ids: zJson(z.array(zId)).default([]),
  instructions: z.string().trim().max(10000).nullable().optional(),
  recommendations: zJson(z.array(recommendationSchema)).nullable().optional(),
  source: z.string().trim().max(191).nullable().optional(),
  starts_at: zDate.optional(),
  ends_at: zDate.nullable().optional(),
  // Send an in-app notification to the targeted people
  notify: zBool.default(true),
});

const updateSchema = createSchema
  .omit({ notify: true, audience: true, district_ids: true })
  .partial()
  .extend({
    audience: z.nativeEnum(AlertAudience).optional(),
    district_ids: zJson(z.array(zId)).optional(),
    is_active: zBool.optional(),
  });

const listQuerySchema = paginationSchema.extend({
  active: zBool.optional(),
  category: z.string().trim().toUpperCase().optional(),
  severity: z.nativeEnum(AlertSeverity).optional(),
});

const toJson = (value: unknown[] | null | undefined) =>
  value === undefined ? undefined : value === null ? Prisma.DbNull : (value as Prisma.InputJsonArray);

const alertController = {
  // Public banner feed: every active alert, with concerns_me for the logged-in user.
  getActive: async (req: Request, res: Response) => {
    const [alerts] = await alertModel.list(activeAlertWhere());
    const translated = await translate("Alert", alerts, resolveLocale(req));
    res.json(translated.map((alert) => ({ ...alert, concerns_me: concernsUser(alert, req.user) })));
  },

  // Staff history of all alerts
  getAll: async (req: Request, res: Response) => {
    const { active, category, severity, ...pagination } = listQuerySchema.parse(req.query);
    const where: Prisma.AlertWhereInput = {
      category,
      severity,
      ...(active === true ? activeAlertWhere() : active === false ? { is_active: false } : {}),
    };
    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await alertModel.list(where, skip, take);
    res.json({ data, meta: pageMeta(pagination, total) });
  },

  getOne: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const alert = await alertModel.getOne(isStaff(req.user) ? { id } : { id, ...activeAlertWhere() });
    if (!alert) throw notFound("Alert not found");
    const translated = await translateOne("Alert", alert, resolveLocale(req));
    res.json({ ...translated, concerns_me: concernsUser(alert, req.user) });
  },

  create: async (req: Request, res: Response) => {
    const { notify, district_ids, recommendations, ...input } = createSchema.parse(req.body);
    if (input.audience === "DISTRICTS" && district_ids.length === 0) {
      throw badRequest("district_ids is required when audience is DISTRICTS");
    }

    const alert = await alertModel.create(
      { ...input, recommendations: toJson(recommendations), created_by_id: req.user!.id },
      district_ids
    );

    let notified = 0;
    if (notify && alert.starts_at <= new Date()) {
      notified = await notifyUsers(audienceUserWhere(alert.audience, district_ids), {
        type: "ALERT",
        title: alert.title,
        body: alert.instructions ?? alert.message,
        link: `/alerts/${alert.id}`,
        data: { alert_id: alert.id, severity: alert.severity, category: alert.category },
      });
    }
    res.status(201).json({ ...alert, notified });
  },

  update: async (req: Request, res: Response) => {
    const { district_ids, recommendations, ...input } = updateSchema.parse(req.body);
    const alert = await alertModel.update(
      parseId(req.params.id),
      { ...input, recommendations: toJson(recommendations) },
      district_ids
    );
    res.json(alert);
  },

  // End an alert now (it stays in the history)
  close: async (req: Request, res: Response) => {
    res.json(await alertModel.update(parseId(req.params.id), { is_active: false, ends_at: new Date() }));
  },

  delete: async (req: Request, res: Response) => {
    res.json(await alertModel.delete(parseId(req.params.id)));
  },
};

export default alertController;
