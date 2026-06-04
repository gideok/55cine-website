import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getAllMovieDetails,
  getMovieDetail,
  getMovieList
} from "../services/movies.service.js";

const sectionSchema = z.enum(["now-playing", "upcoming", "past"]);

export async function registerMovieRoutes(app: FastifyInstance): Promise<void> {
  app.get("/movies", async (request, reply) => {
    const parsed = z
      .object({ section: sectionSchema })
      .safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        error: { code: "INVALID_QUERY", message: "section=now-playing|upcoming|past 필요" }
      });
    }

    try {
      const data = await getMovieList(parsed.data.section);
      reply.header("Cache-Control", "public, max-age=120");
      return data;
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: { code: "MOVIES_LIST_FAILED", message: "상영작 목록 조회 실패" }
      });
    }
  });

  app.get("/movies/catalog", async (request, reply) => {
    try {
      const movies = await getAllMovieDetails();
      reply.header("Cache-Control", "public, max-age=120");
      return { movies };
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: { code: "MOVIES_CATALOG_FAILED", message: "상영작 카탈로그 조회 실패" }
      });
    }
  });

  app.get("/movies/:slug", async (request, reply) => {
    const params = z.object({ slug: z.string().min(1) }).safeParse(request.params);
    const query = z
      .object({ from: sectionSchema.optional() })
      .safeParse(request.query);

    if (!params.success) {
      return reply.code(400).send({
        error: { code: "INVALID_PARAMS", message: "slug 필요" }
      });
    }

    try {
      const movie = await getMovieDetail(
        params.data.slug,
        query.success ? query.data.from : undefined
      );
      if (!movie) {
        return reply.code(404).send({
          error: { code: "NOT_FOUND", message: "상영작을 찾을 수 없습니다." }
        });
      }
      reply.header("Cache-Control", "public, max-age=120");
      return movie;
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: { code: "MOVIE_DETAIL_FAILED", message: "상영작 상세 조회 실패" }
      });
    }
  });
}
