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
  createAdminSpecial,
  updateAdminSpecial,
  deleteAdminSpecial
} from "../../services/admin/special-admin.service.js";
import {
  getAdminMagazineList,
  getAdminMagazineBySeq,
  createAdminMagazine,
  updateAdminMagazine,
  deleteAdminMagazine,
  markMagazineAsPast
} from "../../services/admin/magazine-admin.service.js";
import { resolveUploadPath, saveUploadedFile } from "../../services/admin/upload.service.js";

const kindSchema = z.enum(["exhibition", "event"]);
const sectionSchema = z.enum(["preview", "serial", "gv-moment"]);

const magazineWriteBodySchema = z.object({
  title: z.string().min(1, "제목을 입력해 주세요.").max(500, "제목은 500자 이하여야 합니다."),
  movieTitle: z.string().max(300, "영화 제목은 300자 이하여야 합니다.").nullable().optional(),
  subtitle: z.string().max(300, "부제는 300자 이하여야 합니다.").nullable().optional(),
  publishedLabel: z.string().max(120, "게시일 라벨은 120자 이하여야 합니다.").nullable().optional(),
  publishedAt: z.string().nullable().optional(),
  bodyHtml: z.string().nullable().optional(),
  imgThumb: z.string().max(500, "썸네일 경로는 500자 이하여야 합니다.").nullable().optional(),
  imgCover: z.string().max(500, "커버 이미지 경로는 500자 이하여야 합니다.").nullable().optional(),
  sourceUrl: z.string().max(500, "원본 URL은 500자 이하여야 합니다.").nullable().optional(),
  createdAt: z.string().nullable().optional(),
  coverTempPath: z.string().max(500).nullable().optional(),
  removeCover: z.boolean().optional()
});

const magazineUpdateBodySchema = magazineWriteBodySchema.partial().extend({
  title: z.string().min(1, "제목을 입력해 주세요.").max(500, "제목은 500자 이하여야 합니다.").optional()
});

function zodBodyMessage(result: z.SafeParseError<unknown>): string {
  const first = result.error.issues[0];
  if (!first) return "요청 본문이 올바르지 않습니다.";
  const path = first.path.length ? first.path.join(".") + ": " : "";
  return path + first.message;
}

const specialImageBodyFields = {
  mainImageTempPath: z.string().max(500).nullable().optional(),
  removeMainImage: z.boolean().optional()
};

const filmItemSchema = z.object({
  itemSeq: z.number().int().optional(),
  title: z.string().max(300, "작품 제목은 300자 이하여야 합니다.").optional().default(""),
  image: z.string().max(500).optional().default(""),
  imageTempPath: z.string().max(500).nullable().optional(),
  removeImage: z.boolean().optional(),
  titleEn: z.string().max(300, "영문 제목은 300자 이하여야 합니다.").optional().default(""),
  info: z.string().max(300, "정보는 300자 이하여야 합니다.").optional().default(""),
  runningTimeLabel: z.string().max(120, "상영시간은 120자 이하여야 합니다.").optional().default(""),
  director: z.string().max(200, "감독명은 200자 이하여야 합니다.").optional().default(""),
  cast: z.string().max(1000, "출연진은 1000자 이하여야 합니다.").optional().default(""),
  description: z.string().optional().default(""),
  sectionName: z.string().max(200, "섹션명은 200자 이하여야 합니다.").optional().default(""),
  isEmptySpacer: z.boolean().optional().default(false),
  screenings: z
    .array(
      z.object({
        date: z.string().min(1).max(10, "상영일은 YYYY-MM-DD 형식(10자)이어야 합니다."),
        time: z
          .string()
          .min(1)
          .max(8)
          .transform((s) => s.trim().slice(0, 5)),
        gv: z.boolean().optional().default(false)
      })
    )
    .optional()
    .default([])
});

const specialWriteBodySchema = z.object({
  kind: kindSchema,
  title: z.string().min(1, "제목을 입력해 주세요.").max(500, "제목은 500자 이하여야 합니다."),
  dateLabel: z.string().max(300, "기간 라벨은 300자 이하여야 합니다.").nullable().optional(),
  body: z.string().nullable().optional(),
  imgMain: z.string().max(500).nullable().optional(),
  films: z.array(filmItemSchema).optional(),
  ...specialImageBodyFields
});

const specialUpdateBodySchema = specialWriteBodySchema.omit({ kind: true }).partial().extend({
  title: z.string().min(1, "제목을 입력해 주세요.").max(500, "제목은 500자 이하여야 합니다.").optional()
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

  app.get("/admin/special/:seq", async (request, reply) => {
    const params = z.object({ seq: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return sendError(reply, 400, "INVALID_PARAMS", "seq 필요");
    try {
      const { getAdminSpecialBySeq } = await import("../../services/admin/special-admin.service.js");
      const detail = await getAdminSpecialBySeq(params.data.seq);
      if (!detail) return sendError(reply, 404, "NOT_FOUND", "콘텐츠를 찾을 수 없습니다.");
      return detail;
    } catch (err) {
      request.log.error(err);
      return sendError(reply, 500, "SPECIAL_DETAIL_FAILED", "기획전·행사 상세 조회 실패");
    }
  });

  app.post("/admin/special", async (request, reply) => {
    const body = specialWriteBodySchema.safeParse(request.body);
    if (!body.success) return sendError(reply, 400, "INVALID_BODY", zodBodyMessage(body));
    try {
      const created = await createAdminSpecial(body.data);
      reply.code(201);
      return created;
    } catch (err) {
      request.log.error(err);
      const raw = err instanceof Error ? err.message : "";
      let msg = raw || "기획전·행사 생성 실패";
      if (/truncat/i.test(raw)) {
        msg = "입력값이 허용 길이를 초과했습니다. 제목·기간·작품 정보 등 필드 길이를 확인해 주세요.";
      } else if (/임시 파일 없음/i.test(raw)) {
        msg = "이미지 임시 파일을 찾을 수 없습니다. 이미지를 다시 업로드한 뒤 저장해 주세요.";
      }
      return sendError(reply, 500, "SPECIAL_CREATE_FAILED", msg);
    }
  });

  app.put("/admin/special/:seq", async (request, reply) => {
    const params = z.object({ seq: z.coerce.number().int().positive() }).safeParse(request.params);
    const body = specialUpdateBodySchema.safeParse(request.body);
    if (!params.success) return sendError(reply, 400, "INVALID_PARAMS", "seq 필요");
    if (!body.success) return sendError(reply, 400, "INVALID_BODY", zodBodyMessage(body));
    try {
      const updated = await updateAdminSpecial(params.data.seq, body.data);
      if (!updated) return sendError(reply, 404, "NOT_FOUND", "콘텐츠를 찾을 수 없습니다.");
      return updated;
    } catch (err) {
      request.log.error(err);
      const raw = err instanceof Error ? err.message : "";
      let msg = "기획전·행사 수정 실패";
      if (/truncat/i.test(raw)) {
        msg = "입력값이 허용 길이를 초과했습니다. 제목·기간·작품 정보 등 필드 길이를 확인해 주세요.";
      } else if (/임시 파일 없음/i.test(raw)) {
        msg = "이미지 임시 파일을 찾을 수 없습니다. 이미지를 다시 업로드한 뒤 저장해 주세요.";
      }
      return sendError(reply, 500, "SPECIAL_UPDATE_FAILED", msg);
    }
  });

  app.delete("/admin/special/:seq", async (request, reply) => {
    const params = z.object({ seq: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return sendError(reply, 400, "INVALID_PARAMS", "seq 필요");
    try {
      const ok = await deleteAdminSpecial(params.data.seq);
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

  app.get("/admin/magazine/:seq", async (request, reply) => {
    const params = z.object({ seq: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return sendError(reply, 400, "INVALID_PARAMS", "seq 필요");
    try {
      const detail = await getAdminMagazineBySeq(params.data.seq);
      if (!detail) return sendError(reply, 404, "NOT_FOUND", "기사를 찾을 수 없습니다.");
      return detail;
    } catch (err) {
      request.log.error(err);
      return sendError(reply, 500, "MAGAZINE_DETAIL_FAILED", "매거진 상세 조회 실패");
    }
  });

  app.post("/admin/magazine", async (request, reply) => {
    const body = z
      .object({ section: sectionSchema })
      .merge(magazineWriteBodySchema)
      .safeParse(request.body);
    if (!body.success) return sendError(reply, 400, "INVALID_BODY", zodBodyMessage(body));
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

  app.put("/admin/magazine/:seq", async (request, reply) => {
    const params = z.object({ seq: z.coerce.number().int().positive() }).safeParse(request.params);
    const body = magazineUpdateBodySchema.safeParse(request.body);
    if (!params.success) return sendError(reply, 400, "INVALID_PARAMS", "seq 필요");
    if (!body.success) return sendError(reply, 400, "INVALID_BODY", zodBodyMessage(body));
    try {
      const updated = await updateAdminMagazine(params.data.seq, body.data);
      if (!updated) return sendError(reply, 404, "NOT_FOUND", "기사를 찾을 수 없습니다.");
      return updated;
    } catch (err) {
      request.log.error(err);
      const raw = err instanceof Error ? err.message : "";
      let msg = "매거진 수정 실패";
      if (/truncat/i.test(raw)) {
        msg = "입력값이 허용 길이를 초과했습니다. 제목은 500자 이하로 입력해 주세요.";
      } else if (/임시 파일 없음/i.test(raw)) {
        msg =
          "본문 이미지 임시 파일을 찾을 수 없습니다. 이미지를 다시 업로드한 뒤 저장해 주세요.";
      }
      return sendError(reply, 500, "MAGAZINE_UPDATE_FAILED", msg);
    }
  });

  app.delete("/admin/magazine/:seq", async (request, reply) => {
    const params = z.object({ seq: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return sendError(reply, 400, "INVALID_PARAMS", "seq 필요");
    try {
      const ok = await deleteAdminMagazine(params.data.seq);
      if (!ok) return sendError(reply, 404, "NOT_FOUND", "기사를 찾을 수 없습니다.");
      return { ok: true };
    } catch (err) {
      request.log.error(err);
      return sendError(reply, 500, "MAGAZINE_DELETE_FAILED", "매거진 삭제 실패");
    }
  });

  app.post("/admin/magazine/:seq/mark-past", async (request, reply) => {
    const params = z.object({ seq: z.coerce.number().int().positive() }).safeParse(request.params);
    if (!params.success) return sendError(reply, 400, "INVALID_PARAMS", "seq 필요");
    try {
      const updated = await markMagazineAsPast(params.data.seq);
      if (!updated) return sendError(reply, 404, "NOT_FOUND", "기사를 찾을 수 없습니다.");
      return updated;
    } catch (err) {
      request.log.error(err);
      return sendError(reply, 500, "MAGAZINE_MARK_PAST_FAILED", "지난기사 처리 실패");
    }
  });

  app.post("/admin/upload", async (request, reply) => {
    try {
      const fields: Record<string, string> = {};
      let uploadFilename: string | undefined;
      let uploadBuffer: Buffer | null = null;

      for await (const part of request.parts()) {
        if (part.type === "file") {
          if (part.fieldname === "file" && !uploadBuffer) {
            uploadFilename = part.filename;
            uploadBuffer = await part.toBuffer();
          }
          continue;
        }
        fields[part.fieldname] = String(part.value);
      }

      if (!uploadBuffer) return sendError(reply, 400, "NO_FILE", "파일이 없습니다.");

      const category = fields.category as
        | "special-main"
        | "special-item"
        | "special-temp"
        | "magazine-body"
        | "magazine-cover"
        | "magazine-thumb"
        | "magazine-temp"
        | "program"
        | undefined;
      if (!category) return sendError(reply, 400, "INVALID_CATEGORY", "category 필드 필요");

      if (category === "magazine-temp") {
        const { saveMagazineTempFile } = await import("../../services/admin/magazine-assets.service.js");
        const saved = await saveMagazineTempFile(uploadBuffer, uploadFilename);
        return saved;
      }

      if (category === "special-temp") {
        const { saveSpecialTempFile } = await import("../../services/admin/special-assets.service.js");
        const saved = await saveSpecialTempFile(uploadBuffer, uploadFilename);
        return saved;
      }

      if (category === "program") {
        const programSeq = fields.programSeq ? Number(fields.programSeq) : undefined;
        if (!programSeq) {
          return sendError(reply, 400, "INVALID_FIELDS", "programSeq 필요");
        }
        const { finalizeProgramPosterUpload } = await import(
          "../../services/admin/program-assets.service.js"
        );
        const saved = await finalizeProgramPosterUpload(
          uploadBuffer,
          programSeq,
          uploadFilename
        );
        return saved;
      }

      const relPath = resolveUploadPath(category, {
        specialSeq: fields.specialSeq ? Number(fields.specialSeq) : undefined,
        itemSeq: fields.itemSeq ? Number(fields.itemSeq) : undefined,
        magazineSeq: fields.magazineSeq ? Number(fields.magazineSeq) : undefined,
        imageIndex: fields.imageIndex ? Number(fields.imageIndex) : undefined,
        tempId: fields.tempId || undefined,
        programSeq: fields.programSeq ? Number(fields.programSeq) : undefined,
        originalFilename: uploadFilename
      });

      const saved = await saveUploadedFile(uploadBuffer, relPath);
      return { path: saved.path };
    } catch (err) {
      request.log.error(err);
      const msg = err instanceof Error ? err.message : "업로드 실패";
      return sendError(reply, 500, "UPLOAD_FAILED", msg);
    }
  });
}
