const GRADE_MAP: Record<number, { image: string; alt: string }> = {
  1: { image: "images/rate_all.png", alt: "전체관람가" },
  2: { image: "images/rate_12.png", alt: "12세이상관람가" },
  3: { image: "images/rate_15.png", alt: "15세이상관람가" },
  4: { image: "images/rate_19.png", alt: "청소년관람불가" }
};

export function gradeToRating(grade: number | null | undefined): {
  ratingImage: string;
  ratingAlt: string;
} {
  const key = Number(grade);
  const row = GRADE_MAP[key];
  if (row) return { ratingImage: row.image, ratingAlt: row.alt };
  return { ratingImage: "", ratingAlt: "" };
}

export function formatReleaseDate(dateOpen: unknown): string {
  const d = parseProgDate(dateOpen);
  if (!d) return "";
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

export function parseProgDate(value: unknown): Date | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
