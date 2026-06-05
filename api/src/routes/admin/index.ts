import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { z } from "zod";
import { requireAdminAuth } from "../../middleware/admin-auth.js";
import { getAdminDashboardStats } from "../../services/admin/dashboard.service.js";
import {
  getAdminProgramList,
  getAdminProgramBySeq,
  updateAdminProgram
} from "../../services/admin/web-program-admin.service.js";
import {
  getAdminSpecialList,
  getAdminSpecialByPublicId,
  createAdminSpecial,
  updateAdminSpecial,
  deleteAdminSpecial
} from "../../services/admin/special-admin.service.js";
import {
  getAdminMagazineList,
  getAdminMagazineByPublicId,
  createAdminMagazine,
  updateAdminMagazine,
  deleteAdminMagazine,
  markMagazineAsPast
} from "../../services/admin/magazine-admin.service.js";
import { resolveUploadPath, saveUploadedFile } from "../../services/admin/upload.service.js";

const kindSchema = z.enum(["exhibition", "event"]);
const sectionSchema = z.enum(["preview", "serial", "gv-moment"]);

const filmItemSchema = z.object({
  itemSeq: z.number().int().optional(),
  title: z.string().optional().default(""),
  image: z.string().optional().default(""),
  titleEn: z.string().optional().default(""),
  info: z.string().optional().default(""),
  runningTimeLabel: z.string().optional().default(""),
  director: z.string().optional().default(""),
  cast: z.string().optional().default(""),
  description: z.string().optional().default(""),
  sectionName: z.string().optional().default(""),
  isEmptySpacer: z.boolean().optional().default(false),
  screenings: z
    .array(
      z.object({
        date: z.string().min(1),
        time: z.string().min(1),
        gv: z.boolean().optional().default(false)
      })
    )
    .optional()
    .default([])
});

function sendError(reply: import("fastify").FastifyReply, code: number, errCode: string, message: string) {
  return reply.code(code).send({ error: { code: errCode, message } });
}

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } });

  app.addHook("preHandler", async (request, reply) => {
    await requireAdminAuth(request, reply);
    if (reply.sent) return;
  });

  app.get("/admin/dashboard", async (request, reply) => {
    try {
      const stats = await getAdminDashboardStats();
      return stats;
    } catch (err) {
      request.log.error(err);
      return sendError(reply, 500, "DASHBOARD_FAILED", "대시보드 조회 실패");
    }
  });

  app.get("/admin/programs", async (request, reply) => {
    const parsed = z
      .object({
        q: z.string().optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional()
      })
      .safeParse(request.query);
    if (!parsed.success) {
      return sendError(reply, 400, "INVALID_QUERY", "쿼리 파라미터가 올바르지 않습니다.");
    }
    try {
      return await getAdminProgramList({
        q: parsed.data.q,
        page: parsed.data.page ?? 1,
        pageSize: parsed.data.pageSize ?? 20
      });
    } catch (err) {
      request.log.error(err);
      return sendError(reply, 500, "PROGRAM_LIST_FAILED", "상영작 목록 조회 실패");
    }
  });

  app.get("/admin/programs/:seq", async (request, reply) => {
    const params = z.object({ seq: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return sendError(reply, 400, "INVALID_PARAMS", "seq 필요");
    try {
      const detail = await getAdminProgramBySeq(params.data.seq);
      if (!detail) return sendError(reply, 404, "NOT_FOUND", "상영작을 찾을 수 없습니다.");
      return detail;
    } catch (err) {
      request.log.error(err);
      return sendError(reply, 500, "PROGRAM_DETAIL_FAILED", "상영작 상세 조회 실패");
    }
  });

  app.put("/admin/programs/:seq", async (request, reply) => {
    const params = z.object({ seq: z.coerce.number().int().positive() }).safeParse(request.params);
    const body = z
      .object({
        slug: z.string().nullable().optional(),
        detailUrl: z.string().nullable().optional(),
        imgThumb: z.string().nullable().optional(),
        img1: z.string().nullable().optional(),
        img2: z.string().nullable().optional(),
        img3: z.string().nullable().optional(),
        img4: z.string().nullable().optional(),
        img5: z.string().nullable().optional(),
        director: z.string().nullable().optional(),
        castNames: z.string().nullable().optional(),
        info: z.string().nullable().optional(),
        synopsis: z.string().nullable().optional(),
        trailerUrl: z.string().nullable().optional()
      })
      .safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(reply, 400, "INVALID_BODY", "요청 본문이 올바르지 않습니다.");
    }
    try {
      const updated = await updateAdminProgram(params.data.seq, body.data);
      if (!updated) return sendError(reply, 404, "NOT_FOUND", "상영작을 찾을 수 없습니다.");
      return updated;
    } catch (err) {
      request.log.error(err);
      return sendError(reply, 500, "PROGRAM_UPDATE_FAILED", "상영작 수정 실패");
    }
  });

  app.get("/admin/special", async (request, reply) => {
    const parsed = z
      .object({
        kind: kindSchema.optional(),
        q: z.string().optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional()
      })
      .safeParse(request.query);
    if (!parsed.success) return sendError(reply, 400, "INVALID_QUERY", "쿼리 파라미터가 올바르지 않습니다.");
    try {
      return await getAdminSpecialList({
        kind: parsed.data.kind,
        q: parsed.data.q,
        page: parsed.data.page ?? 1,
        pageSize: parsed.data.pageSize ?? 20
      });
    } catch (err) {
      request.log.error(err);
      return sendError(reply, 500, "SPECIAL_LIST_FAILED", "기획전·행사 목록 조회 실패");
    }
  });

  app.get("/admin/special/:publicId", async (request, reply) => {
    const params = z.object({ publicId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return sendError(reply, 400, "INVALID_PARAMS", "publicId 필요");
    try {
      const detail = await getAdminSpecialByPublicId(params.data.publicId);
      if (!detail) return sendError(reply, 404, "NOT_FOUND", "콘텐츠를 찾을 수 없습니다.");
      return detail;
    } catch (err) {
      request.log.error(err);
      return sendError(reply, 500, "SPECIAL_DETAIL_FAILED", "기획전·행사 상세 조회 실패");
    }
  });

  app.post("/admin/special", async (request, reply) => {
    const body = z
      .object({
        publicId: z.string().min(1),
        kind: kindSchema,
        title: z.string().min(1),
        dateLabel: z.string().nullable().optional(),
        body: z.string().nullable().optional(),
        imgMain: z.string().nullable().optional(),
        bookingUrl: z.string().nullable().optional(),
        listOrder: z.number().int().optional(),
        films: z.array(filmItemSchema).optional()
      })
      .safeParse(request.body);
    if (!body.success) return sendError(reply, 400, "INVALID_BODY", "요청 본문이 올바르지 않습니다.");
    try {
      const created = await createAdminSpecial(body.data);
      reply.code(201);
      return created;
    } catch (err) {
      request.log.error(err);
      const msg = err instanceof Error ? err.message : "기획전·행사 생성 실패";
      return sendError(reply, 500, "SPECIAL_CREATE_FAILED", msg);
    }
  });

  app.put("/admin/special/:publicId", async (request, reply) => {
    const params = z.object({ publicId: z.string().min(1) }).safeParse(request.params);
    const body = z
      .object({
        title: z.string().min(1).optional(),
        dateLabel: z.string().nullable().optional(),
        body: z.string().nullable().optional(),
        imgMain: z.string().nullable().optional(),
        bookingUrl: z.string().nullable().optional(),
        listOrder: z.number().int().optional(),
        films: z.array(filmItemSchema).optional()
      })
      .safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(reply, 400, "INVALID_BODY", "요청 본문이 올바르지 않습니다.");
    }
    try {
      const updated = await updateAdminSpecial(params.data.publicId, body.data);
      if (!updated) return sendError(reply, 404, "NOT_FOUND", "콘텐츠를 찾을 수 없습니다.");
      return updated;
    } catch (err) {
      request.log.error(err);
      return sendError(reply, 500, "SPECIAL_UPDATE_FAILED", "기획전·행사 수정 실패");
    }
  });

  app.delete("/admin/special/:publicId", async (request, reply) => {
    const params = z.object({ publicId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return sendError(reply, 400, "INVALID_PARAMS", "publicId 필요");
    try {
      const ok = await deleteAdminSpecial(params.data.publicId);
      if (!ok) return sendError(reply, 404, "NOT_FOUND", "콘텐츠를 찾을 수 없습니다.");
      return { ok: true };
    } catch (err) {
      request.log.error(err);
      return sendError(reply, 500, "SPECIAL_DELETE_FAILED", "기획전·행사 삭제 실패");
    }
  });

  app.get("/admin/magazine", async (request, reply) => {
    const parsed = z
      .object({
        section: sectionSchema.optional(),
        isPast: z.union([z.literal("true"), z.literal("false"), z.literal("1"), z.literal("0")]).optional(),
        q: z.string().optional(),
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional()
      })
      .safeParse(request.query);
    if (!parsed.success) return sendError(reply, 400, "INVALID_QUERY", "쿼리 파라미터가 올바르지 않습니다.");
    const isPast = parsed.data.isPast === "true" || parsed.data.isPast === "1";
    try {
      return await getAdminMagazineList({
        section: parsed.data.section,
        isPast: isPast || undefined,
        q: parsed.data.q,
        page: parsed.data.page ?? 1,
        pageSize: parsed.data.pageSize ?? 20
      });
    } catch (err) {
      request.log.error(err);
      return sendError(reply, 500, "MAGAZINE_LIST_FAILED", "매거진 목록 조회 실패");
    }
  });

  app.get("/admin/magazine/:publicId", async (request, reply) => {
    const params = z.object({ publicId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return sendError(reply, 400, "INVALID_PARAMS", "publicId 필요");
    try {
      const detail = await getAdminMagazineByPublicId(params.data.publicId);
      if (!detail) return sendError(reply, 404, "NOT_FOUND", "기사를 찾을 수 없습니다.");
      return detail;
    } catch (err) {
      request.log.error(err);
      return sendError(reply, 500, "MAGAZINE_DETAIL_FAILED", "매거진 상세 조회 실패");
    }
  });

  app.post("/admin/magazine", async (request, reply) => {
    const body = z
      .object({
        publicId: z.string().min(1),
        section: sectionSchema,
        title: z.string().min(1),
        movieTitle: z.string().nullable().optional(),
        subtitle: z.string().nullable().optional(),
        publishedLabel: z.string().nullable().optional(),
        publishedAt: z.string().nullable().optional(),
        excerpt: z.string().nullable().optional(),
        bodyHtml: z.string().nullable().optional(),
        imgThumb: z.string().nullable().optional(),
        imgCover: z.string().nullable().optional(),
        sourceUrl: z.string().nullable().optional(),
        articleUrl: z.string().nullable().optional(),
        listOrder: z.number().int().optional()
      })
      .safeParse(request.body);
    if (!body.success) return sendError(reply, 400, "INVALID_BODY", "요청 본문이 올바르지 않습니다.");
    try {
      const created = await createAdminMagazine(body.data);
      reply.code(201);
      return created;
    } catch (err) {
      request.log.error(err);
      const msg = err instanceof Error ? err.message : "매거진 생성 실패";
      return sendError(reply, 500, "MAGAZINE_CREATE_FAILED", msg);
    }
  });

  app.put("/admin/magazine/:publicId", async (request, reply) => {
    const params = z.object({ publicId: z.string().min(1) }).safeParse(request.params);
    const body = z
      .object({
        title: z.string().min(1).optional(),
        movieTitle: z.string().nullable().optional(),
        subtitle: z.string().nullable().optional(),
        publishedLabel: z.string().nullable().optional(),
        publishedAt: z.string().nullable().optional(),
        excerpt: z.string().nullable().optional(),
        bodyHtml: z.string().nullable().optional(),
        imgThumb: z.string().nullable().optional(),
        imgCover: z.string().nullable().optional(),
        sourceUrl: z.string().nullable().optional(),
        articleUrl: z.string().nullable().optional(),
        listOrder: z.number().int().optional()
      })
      .safeParse(request.body);
    if (!params.success || !body.success) {
      return sendError(reply, 400, "INVALID_BODY", "요청 본문이 올바르지 않습니다.");
    }
    try {
      const updated = await updateAdminMagazine(params.data.publicId, body.data);
      if (!updated) return sendError(reply, 404, "NOT_FOUND", "기사를 찾을 수 없습니다.");
      return updated;
    } catch (err) {
      request.log.error(err);
      return sendError(reply, 500, "MAGAZINE_UPDATE_FAILED", "매거진 수정 실패");
    }
  });

  app.delete("/admin/magazine/:publicId", async (request, reply) => {
    const params = z.object({ publicId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return sendError(reply, 400, "INVALID_PARAMS", "publicId 필요");
    try {
      const ok = await deleteAdminMagazine(params.data.publicId);
      if (!ok) return sendError(reply, 404, "NOT_FOUND", "기사를 찾을 수 없습니다.");
      return { ok: true };
    } catch (err) {
      request.log.error(err);
      return sendError(reply, 500, "MAGAZINE_DELETE_FAILED", "매거진 삭제 실패");
    }
  });

  app.post("/admin/magazine/:publicId/mark-past", async (request, reply) => {
    const params = z.object({ publicId: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return sendError(reply, 400, "INVALID_PARAMS", "publicId 필요");
    try {
      const updated = await markMagazineAsPast(params.data.publicId);
      if (!updated) return sendError(reply, 404, "NOT_FOUND", "기사를 찾을 수 없습니다.");
      return updated;
    } catch (err) {
      request.log.error(err);
      return sendError(reply, 500, "MAGAZINE_MARK_PAST_FAILED", "지난기사 처리 실패");
    }
  });

  app.post("/admin/upload", async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) return sendError(reply, 400, "NO_FILE", "파일이 없습니다.");

      const fields: Record<string, string> = {};
      if (data.fields) {
        for (const [key, val] of Object.entries(data.fields)) {
          const v = val as { value?: string };
          if (v && typeof v.value === "string") fields[key] = v.value;
        }
      }

      const category = fields.category as
        | "special-main"
        | "special-item"
        | "magazine-body"
        | "magazine-thumb"
        | "program"
        | undefined;
      if (!category) return sendError(reply, 400, "INVALID_CATEGORY", "category 필드 필요");

      const buffer = await data.toBuffer();
      const relPath = resolveUploadPath(category, {
        specialSeq: fields.specialSeq ? Number(fields.specialSeq) : undefined,
        itemSeq: fields.itemSeq ? Number(fields.itemSeq) : undefined,
        magazineSeq: fields.magazineSeq ? Number(fields.magazineSeq) : undefined,
        imageIndex: fields.imageIndex ? Number(fields.imageIndex) : undefined,
        programSeq: fields.programSeq ? Number(fields.programSeq) : undefined,
        originalFilename: data.filename
      });

      const saved = await saveUploadedFile(buffer, relPath);
      return { path: saved.path };
    } catch (err) {
      request.log.error(err);
      const msg = err instanceof Error ? err.message : "업로드 실패";
      return sendError(reply, 500, "UPLOAD_FAILED", msg);
    }
  });
}
