import type { Request, Response } from "express";
import { AnnouncementCategory, Prisma, PublicationStatus } from "@prisma/client";
import { z } from "zod";
import announcementModel, { visibleAnnouncementWhere } from "../model/announcement.model";
import { notFound } from "../lib/errors";
import { notifyUsers } from "../lib/notify";
import { saveUpload } from "../lib/upload";
import { pageMeta, paginationSchema, parseId, toSkipTake, zBool, zDate, zId } from "../lib/validation";
import { resolveLocale, translate, translateOne } from "../lib/translations";
import { isStaff } from "../middleware/auth";
import { audit, diffChanges } from "../lib/audit";

// D06 publications, F30 notification on important announcements

const listQuerySchema = paginationSchema.extend({
  category: z.nativeEnum(AnnouncementCategory).optional(),
  important: zBool.optional(),
  service_id: zId.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  // Staff only: defaults to the public view
  status: z.union([z.nativeEnum(PublicationStatus), z.literal("ALL")]).optional(),
});

const createSchema = z.object({
  title: z.string().trim().min(1).max(191),
  summary: z.string().trim().max(500).nullable().optional(),
  content: z.string().trim().min(1).max(50000),
  category: z.nativeEnum(AnnouncementCategory).optional(),
  is_important: zBool.optional(),
  is_pinned: zBool.optional(),
  service_id: zId.nullable().optional(),
  // Future date = scheduled publication
  published_at: zDate.nullable().optional(),
  expires_at: zDate.nullable().optional(),
  // Shortcut to publish on creation
  publish: zBool.default(false),
});

const updateSchema = createSchema.omit({ publish: true }).partial().extend({
  status: z.nativeEnum(PublicationStatus).optional(),
});

// F30: everyone is notified once, when an important announcement goes live.
const notifyIfImportant = async (announcement: { id: number; title: string; summary: string | null; is_important: boolean }) => {
  if (!announcement.is_important) return;
  await notifyUsers(
    {},
    {
      type: "ANNOUNCEMENT",
      title: `Annonce importante : ${announcement.title}`,
      body: announcement.summary,
      link: `/announcements/${announcement.id}`,
      data: { announcement_id: announcement.id },
    }
  );
};

const announcementController = {
  getAll: async (req: Request, res: Response) => {
    const { category, important, service_id, q, status, ...pagination } = listQuerySchema.parse(req.query);
    const staffView = isStaff(req.user) && status !== undefined;

    const where: Prisma.AnnouncementWhereInput = {
      category,
      service_id,
      ...(important !== undefined ? { is_important: important } : {}),
      AND: [
        staffView ? (status === "ALL" ? {} : { status }) : visibleAnnouncementWhere(),
        q ? { OR: [{ title: { contains: q } }, { summary: { contains: q } }, { content: { contains: q } }] } : {},
      ],
    };

    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await announcementModel.list(where, skip, take);
    res.json({ data: await translate("Announcement", data, resolveLocale(req)), meta: pageMeta(pagination, total) });
  },

  getOne: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const announcement = await announcementModel.getOne(
      isStaff(req.user) ? { id } : { id, ...visibleAnnouncementWhere() }
    );
    if (!announcement) throw notFound("Announcement not found");
    res.json(await translateOne("Announcement", announcement, resolveLocale(req)));
  },

  create: async (req: Request, res: Response) => {
    const { publish, ...input } = createSchema.parse(req.body);
    const cover_image = await saveUpload(req, "cover_image", "announcement");
    const announcement = await announcementModel.create({
      ...input,
      cover_image,
      author_id: req.user!.id,
      ...(publish ? { status: "PUBLISHED", published_at: input.published_at ?? new Date() } : {}),
    });
    if (publish) await notifyIfImportant(announcement);
    await audit(req, {
      action: publish ? "announcement.published" : "announcement.created",
      entity: "Announcement",
      entityId: announcement.id,
      label: announcement.title,
      changes: [{ field: "status", to: announcement.status }],
      always: true,
    });
    res.status(201).json(announcement);
  },

  update: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const input = updateSchema.parse(req.body);
    const current = await announcementModel.getOne({ id });
    if (!current) throw notFound("Announcement not found");

    const cover_image = await saveUpload(req, "cover_image", "announcement");
    const goesLive = input.status === "PUBLISHED" && current.status !== "PUBLISHED";
    const announcement = await announcementModel.update(id, {
      ...input,
      ...(cover_image ? { cover_image } : {}),
      ...(goesLive && !current.published_at && !input.published_at ? { published_at: new Date() } : {}),
    });
    if (goesLive) await notifyIfImportant(announcement);
    const published = current.status !== "PUBLISHED" && announcement.status === "PUBLISHED";
    const archived = current.status !== "ARCHIVED" && announcement.status === "ARCHIVED";
    await audit(req, {
      action: published ? "announcement.published" : archived ? "announcement.archived" : "announcement.updated",
      entity: "Announcement",
      entityId: announcement.id,
      label: announcement.title,
      changes: diffChanges(current, announcement, ["title", "summary", "status", "category", "is_important", "is_pinned", "service_id"]),
    });
    res.json(announcement);
  },

  publish: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const current = await announcementModel.getOne({ id });
    if (!current) throw notFound("Announcement not found");
    if (current.status === "PUBLISHED") {
      res.json(current);
      return;
    }
    const announcement = await announcementModel.update(id, {
      status: "PUBLISHED",
      published_at: current.published_at ?? new Date(),
    });
    await notifyIfImportant(announcement);
    await audit(req, {
      action: "announcement.published",
      entity: "Announcement",
      entityId: announcement.id,
      label: announcement.title,
      changes: [{ field: "status", from: current.status, to: "PUBLISHED" }],
      always: true,
    });
    res.json(announcement);
  },

  delete: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const current = await announcementModel.getOne({ id });
    if (!current) throw notFound("Announcement not found");
    const deleted = await announcementModel.delete(id);
    await audit(req, {
      action: "announcement.deleted",
      entity: "Announcement",
      entityId: id,
      label: current.title,
      always: true,
    });
    res.json(deleted);
  },
};

export default announcementController;
