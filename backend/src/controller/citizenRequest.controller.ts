import type { Request, Response } from "express";
import { Prisma, RequestPriority, RequestStatus, RequestType } from "@prisma/client";
import { z } from "zod";
import prisma from "../lib/prisma";
import citizenRequestModel, {
  ACTION_NEEDED_STATUSES,
  FINAL_STATUSES,
  OPEN_STATUSES,
  STATUS_LABELS,
} from "../model/citizenRequest.model";
import { badRequest, notFound } from "../lib/errors";
import { notifyUser } from "../lib/notify";
import { saveUpload } from "../lib/upload";
import { assertServiceAvailable } from "../lib/availability";
import { assertNotInMaintenance } from "../lib/settings";
import { pageMeta, paginationSchema, parseId, toSkipTake, zBool, zId, zJson } from "../lib/validation";
import { isStaff } from "../middleware/auth";
import { zEmail } from "./auth.controller";
import type { FormField } from "./procedure.controller";

// D04 contact, D11 procedures + tracking, D16 confirmation, F22 agent queue,
// F25 incident reports, F26 history.

const createSchema = z.object({
  type: z.nativeEnum(RequestType),
  subject: z.string().trim().min(3).max(191),
  message: z.string().trim().min(5).max(10000),
  service_id: zId.optional(),
  procedure_id: zId.optional(),
  category: z.string().trim().max(100).optional(),
  district_id: zId.optional(),
  location_label: z.string().trim().max(191).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  data: zJson(z.record(z.unknown())).optional(),
  contact_name: z.string().trim().min(1).max(191).optional(),
  contact_email: zEmail.optional(),
});

// ?status=SUBMITTED,IN_REVIEW
const zStatusList = z.preprocess(
  (value) => (typeof value === "string" ? value.split(",").filter(Boolean) : value),
  z.array(z.nativeEnum(RequestStatus))
);

const listQuerySchema = paginationSchema.extend({
  status: zStatusList.optional(),
  scope: z.enum(["open", "needs_action", "closed"]).optional(),
  type: z.nativeEnum(RequestType).optional(),
  priority: z.nativeEnum(RequestPriority).optional(),
  service_id: zId.optional(),
  district_id: zId.optional(),
  // Staff only: "me", "none" or an agent id
  assigned: z.union([z.enum(["me", "none"]), zId]).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  sort: z.enum(["newest", "oldest", "priority", "updated"]).default("newest"),
});

const ORDER: Record<string, Prisma.CitizenRequestOrderByWithRelationInput[]> = {
  newest: [{ created_at: "desc" }],
  oldest: [{ created_at: "asc" }],
  priority: [{ priority: "desc" }, { created_at: "asc" }],
  updated: [{ updated_at: "desc" }],
};

const updateSchema = z.object({
  status: z.nativeEnum(RequestStatus).optional(),
  priority: z.nativeEnum(RequestPriority).optional(),
  assigned_agent_id: zId.nullable().optional(),
  service_id: zId.nullable().optional(),
  district_id: zId.nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  // Explanation attached to the change; shown to the citizen unless internal_note
  note: z.string().trim().min(1).max(5000).optional(),
  internal_note: zBool.default(false),
});

const commentSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  is_internal: zBool.default(false),
});

const missingRequiredFields = (formSchema: unknown, data: Record<string, unknown> | undefined) => {
  if (!Array.isArray(formSchema)) return [];
  return (formSchema as FormField[])
    .filter((field) => field.required)
    .filter((field) => {
      const value = data?.[field.name];
      return value === undefined || value === null || value === "";
    })
    .map((field) => field.name);
};

// Loads a request the current user may see: its owner or staff. Others get a 404.
const loadVisible = async (req: Request, id: number) => {
  const request = await citizenRequestModel.getById(id);
  if (!request || (!isStaff(req.user) && request.citizen_id !== req.user?.id)) {
    throw notFound("Request not found");
  }
  return request;
};

const citizenRequestController = {
  create: async (req: Request, res: Response) => {
    const input = createSchema.parse(req.body);
    const user = req.user;
    await assertNotInMaintenance(user);

    // D04: visitors without an account can only contact the city, and must leave a way to reply.
    if (!user) {
      if (input.type !== "CONTACT") throw badRequest("You must be logged in for this type of request");
      if (!input.contact_name || !input.contact_email) {
        throw badRequest("contact_name and contact_email are required when not logged in");
      }
    }

    // F25: an incident must say where it is.
    if (
      input.type === "INCIDENT" &&
      !input.location_label &&
      (input.latitude === undefined || input.longitude === undefined)
    ) {
      throw badRequest("An incident report needs a location_label or latitude/longitude");
    }

    let serviceId = input.service_id;
    if (input.type === "PROCEDURE") {
      if (!input.procedure_id) throw badRequest("procedure_id is required for a PROCEDURE request");
      const procedure = await prisma.procedure.findFirst({ where: { id: input.procedure_id, is_active: true } });
      if (!procedure) throw badRequest("Unknown or inactive procedure");
      const missing = missingRequiredFields(procedure.form_schema, input.data);
      if (missing.length) throw badRequest("Missing required procedure fields", { missing });
      serviceId = procedure.service_id;
    }

    // F38: refuse new requests while the service is down, with when to come back and what to do instead
    if (serviceId) await assertServiceAvailable(serviceId);

    const attachment = await saveUpload(req, "attachment", "request");
    const { data, ...fields } = input;
    const request = await citizenRequestModel.create(
      {
        ...fields,
        service_id: serviceId,
        citizen_id: user?.id,
        attachment,
        data: data as Prisma.InputJsonObject | undefined,
      },
      user?.id
    );

    if (user) {
      await notifyUser(user.id, {
        type: "REQUEST_CREATED",
        title: `Demande ${request.reference} bien reçue`,
        link: `/requests/${request.id}`,
        data: { request_id: request.id, reference: request.reference, status: request.status },
      });
    }

    // D16: immediate, explicit confirmation
    res.status(201).json({
      message: `Votre demande a bien été enregistrée sous la référence ${request.reference}.`,
      reference: request.reference,
      status: request.status,
      request,
    });
  },

  // Citizens get their own history (F26); staff get the processing queue (F22).
  getAll: async (req: Request, res: Response) => {
    const { status, scope, type, priority, service_id, district_id, assigned, q, sort, ...pagination } =
      listQuerySchema.parse(req.query);
    const user = req.user!;
    const staff = isStaff(user);

    const where: Prisma.CitizenRequestWhereInput = { type, priority, service_id, district_id };
    if (!staff) where.citizen_id = user.id;
    if (status) where.status = { in: status };
    else if (scope === "open") where.status = { in: OPEN_STATUSES };
    else if (scope === "needs_action") where.status = { in: ACTION_NEEDED_STATUSES };
    else if (scope === "closed") where.status = { in: FINAL_STATUSES };
    if (staff && assigned !== undefined) {
      where.assigned_agent_id = assigned === "me" ? user.id : assigned === "none" ? null : assigned;
    }
    if (q) {
      where.OR = [
        { reference: { contains: q } },
        { subject: { contains: q } },
        { message: { contains: q } },
        ...(staff ? [{ contact_name: { contains: q } }, { contact_email: { contains: q } }] : []),
      ];
    }

    const { skip, take } = toSkipTake(pagination);
    const [data, total] = await citizenRequestModel.list(where, ORDER[sort], skip, take);
    res.json({ data, meta: pageMeta(pagination, total) });
  },

  // D11: request detail with its timeline
  getOne: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    await loadVisible(req, id);
    res.json(await citizenRequestModel.getDetail(id, isStaff(req.user)));
  },

  // Staff processing: status, priority, assignment, routing. Every change is logged as an event.
  update: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const { note, internal_note, ...changes } = updateSchema.parse(req.body);
    const current = await citizenRequestModel.getById(id);
    if (!current) throw notFound("Request not found");

    if (changes.assigned_agent_id) {
      const agent = await prisma.user.findFirst({
        where: { id: changes.assigned_agent_id, is_active: true, role: { in: ["AGENT", "ADMIN"] } },
      });
      if (!agent) throw badRequest("assigned_agent_id must be an active agent or admin");
      // Assigning a new request means it has been picked up.
      if (!changes.status && current.status === "SUBMITTED") changes.status = "IN_REVIEW";
    }

    const authorId = req.user!.id;
    const events: Omit<Prisma.RequestEventCreateManyInput, "request_id">[] = [];
    const statusChanged = changes.status !== undefined && changes.status !== current.status;

    if (statusChanged) {
      events.push({
        type: "STATUS_CHANGED",
        author_id: authorId,
        from_status: current.status,
        to_status: changes.status,
        message: note,
        is_internal: internal_note,
      });
    } else if (note) {
      events.push({ type: "COMMENT", author_id: authorId, message: note, is_internal: internal_note });
    }
    if (changes.assigned_agent_id !== undefined && changes.assigned_agent_id !== current.assigned_agent_id) {
      events.push({ type: "ASSIGNED", author_id: authorId, is_internal: true });
    }
    if (changes.priority !== undefined && changes.priority !== current.priority) {
      events.push({ type: "PRIORITY_CHANGED", author_id: authorId, message: changes.priority, is_internal: true });
    }

    const data: Prisma.CitizenRequestUncheckedUpdateInput = { ...changes };
    if (statusChanged) {
      data.resolved_at = FINAL_STATUSES.includes(changes.status!) ? new Date() : null;
    }

    const request = await citizenRequestModel.update(id, data, events);

    if (current.citizen_id && (statusChanged || (note && !internal_note))) {
      await notifyUser(current.citizen_id, {
        type: "REQUEST_UPDATE",
        title: `Demande ${request.reference} : ${STATUS_LABELS[request.status]}`,
        body: internal_note ? null : note,
        link: `/requests/${request.id}`,
        data: { request_id: request.id, reference: request.reference, status: request.status },
      });
    }

    res.json(request);
  },

  // Owner or staff can add a message to the timeline. Only staff can write internal notes.
  addComment: async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    const request = await loadVisible(req, id);
    const { message, is_internal } = commentSchema.parse(req.body);
    const staff = isStaff(req.user);
    const internal = staff && is_internal;
    const authorId = req.user!.id;

    const events: Omit<Prisma.RequestEventCreateManyInput, "request_id">[] = [
      { type: "COMMENT", author_id: authorId, message, is_internal: internal },
    ];
    const data: Prisma.CitizenRequestUncheckedUpdateInput = {};
    // The citizen answered: the request goes back to the city.
    if (!staff && request.status === "WAITING_CITIZEN") {
      data.status = "IN_REVIEW";
      events.push({ type: "STATUS_CHANGED", author_id: authorId, from_status: request.status, to_status: "IN_REVIEW" });
    }
    await citizenRequestModel.update(id, data, events);

    const notification = {
      title: `Nouveau message sur la demande ${request.reference}`,
      body: message,
      link: `/requests/${request.id}`,
      data: { request_id: request.id, reference: request.reference },
    };
    if (staff && !internal && request.citizen_id) {
      await notifyUser(request.citizen_id, { type: "REQUEST_MESSAGE", ...notification });
    } else if (!staff && request.assigned_agent_id) {
      await notifyUser(request.assigned_agent_id, { type: "REQUEST_MESSAGE", ...notification });
    }

    res.status(201).json(await citizenRequestModel.getDetail(id, staff));
  },

  delete: async (req: Request, res: Response) => {
    res.json(await citizenRequestModel.delete(parseId(req.params.id)));
  },
};

export default citizenRequestController;
