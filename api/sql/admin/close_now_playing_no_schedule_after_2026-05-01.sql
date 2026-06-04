/*
  관리자 수동 실행용 (api/sql/admin — db:migrate 자동 실행 대상 아님)

  목적:
    현재상영작으로 노출되지만 종영일이 비어 있거나 미래인 경우,
    prog_daily 기준 2026-05-01 이후(엄격히 초과) 상영 회차가 없으면
    prog_base.date_close 를 2025-12-31 로 일괄 반영합니다.

  현재상영작(API) 조건:
    @today >= date_open
    AND (date_close IS NULL/공백 OR @today <= date_close)

  상영시간표 조건:
    prog_daily.date_sc 가 유효한 날짜 중
    MAX(date_sc) <= 2026-05-01 이거나 회차 없음
    (즉 2026-05-02 이후 회차가 하나도 없음)

  실행:
    1) 미리보기 SELECT
    2) UPDATE (BEGIN TRAN … COMMIT / ROLLBACK)
    3) 검증 SELECT

  상수 변경 시 아래 @schedule_cutoff, @date_close_set, @today 만 수정
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ------------------------------------------------------------------ */
/* 1) 반영 대상 미리보기                                               */
/* ------------------------------------------------------------------ */
DECLARE @today date = CAST(GETDATE() AS date);
DECLARE @schedule_cutoff date = '2026-05-01';
DECLARE @date_close_set char(10) = '2025-12-31';

;WITH schedule_max AS (
  SELECT
    pd.prog_id,
    MAX(TRY_CONVERT(date, LTRIM(RTRIM(pd.date_sc)))) AS last_date_sc
  FROM dbo.prog_daily AS pd
  WHERE NULLIF(LTRIM(RTRIM(pd.date_sc)), '') IS NOT NULL
    AND TRY_CONVERT(date, LTRIM(RTRIM(pd.date_sc))) IS NOT NULL
  GROUP BY pd.prog_id
),
targets AS (
  SELECT
    pb.prog_id,
    pb.name,
    LTRIM(RTRIM(pb.date_open)) AS date_open,
    LTRIM(RTRIM(pb.date_close)) AS date_close_before,
    @date_close_set AS date_close_after,
    sm.last_date_sc,
    wp.slug
  FROM dbo.prog_base AS pb
  INNER JOIN dbo.web_program AS wp ON wp.prog_id = pb.prog_id
  LEFT JOIN schedule_max AS sm ON sm.prog_id = pb.prog_id
  WHERE wp.slug IS NOT NULL
    AND LTRIM(RTRIM(wp.slug)) <> ''
    AND TRY_CONVERT(date, LTRIM(RTRIM(pb.date_open))) IS NOT NULL
    AND @today >= TRY_CONVERT(date, LTRIM(RTRIM(pb.date_open)))
    AND (
      NULLIF(LTRIM(RTRIM(pb.date_close)), '') IS NULL
      OR @today <= TRY_CONVERT(date, LTRIM(RTRIM(pb.date_close)))
    )
    AND (
      sm.last_date_sc IS NULL
      OR sm.last_date_sc <= @schedule_cutoff
    )
    AND ISNULL(LTRIM(RTRIM(pb.date_close)), '') <> @date_close_set
)
SELECT
  prog_id,
  name,
  slug,
  date_open,
  date_close_before,
  date_close_after,
  last_date_sc,
  N'변경' AS action
FROM targets
ORDER BY prog_id;
GO

/* ------------------------------------------------------------------ */
/* 2) UPDATE (확인 후 실행)                                            */
/* ------------------------------------------------------------------ */
DECLARE @today date = CAST(GETDATE() AS date);
DECLARE @schedule_cutoff date = '2026-05-01';
DECLARE @date_close_set char(10) = '2025-12-31';

BEGIN TRANSACTION;

;WITH schedule_max AS (
  SELECT
    pd.prog_id,
    MAX(TRY_CONVERT(date, LTRIM(RTRIM(pd.date_sc)))) AS last_date_sc
  FROM dbo.prog_daily AS pd
  WHERE NULLIF(LTRIM(RTRIM(pd.date_sc)), '') IS NOT NULL
    AND TRY_CONVERT(date, LTRIM(RTRIM(pd.date_sc))) IS NOT NULL
  GROUP BY pd.prog_id
),
targets AS (
  SELECT pb.prog_id
  FROM dbo.prog_base AS pb
  INNER JOIN dbo.web_program AS wp ON wp.prog_id = pb.prog_id
  LEFT JOIN schedule_max AS sm ON sm.prog_id = pb.prog_id
  WHERE wp.slug IS NOT NULL
    AND LTRIM(RTRIM(wp.slug)) <> ''
    AND TRY_CONVERT(date, LTRIM(RTRIM(pb.date_open))) IS NOT NULL
    AND @today >= TRY_CONVERT(date, LTRIM(RTRIM(pb.date_open)))
    AND (
      NULLIF(LTRIM(RTRIM(pb.date_close)), '') IS NULL
      OR @today <= TRY_CONVERT(date, LTRIM(RTRIM(pb.date_close)))
    )
    AND (
      sm.last_date_sc IS NULL
      OR sm.last_date_sc <= @schedule_cutoff
    )
    AND ISNULL(LTRIM(RTRIM(pb.date_close)), '') <> @date_close_set
)
UPDATE pb
SET pb.date_close = @date_close_set
FROM dbo.prog_base AS pb
INNER JOIN targets AS t ON t.prog_id = pb.prog_id;

SELECT @@ROWCOUNT AS rows_updated;

COMMIT TRANSACTION;
GO

/* ------------------------------------------------------------------ */
/* 3) 반영 후 검증 — 동일 조건·date_close 미반영 건수                   */
/* ------------------------------------------------------------------ */
DECLARE @today date = CAST(GETDATE() AS date);
DECLARE @schedule_cutoff date = '2026-05-01';
DECLARE @date_close_set char(10) = '2025-12-31';

;WITH schedule_max AS (
  SELECT
    pd.prog_id,
    MAX(TRY_CONVERT(date, LTRIM(RTRIM(pd.date_sc)))) AS last_date_sc
  FROM dbo.prog_daily AS pd
  WHERE NULLIF(LTRIM(RTRIM(pd.date_sc)), '') IS NOT NULL
    AND TRY_CONVERT(date, LTRIM(RTRIM(pd.date_sc))) IS NOT NULL
  GROUP BY pd.prog_id
)
SELECT COUNT(*) AS remaining_should_close_count
FROM dbo.prog_base AS pb
INNER JOIN dbo.web_program AS wp ON wp.prog_id = pb.prog_id
LEFT JOIN schedule_max AS sm ON sm.prog_id = pb.prog_id
WHERE wp.slug IS NOT NULL
  AND LTRIM(RTRIM(wp.slug)) <> ''
  AND TRY_CONVERT(date, LTRIM(RTRIM(pb.date_open))) IS NOT NULL
  AND @today >= TRY_CONVERT(date, LTRIM(RTRIM(pb.date_open)))
  AND (
    NULLIF(LTRIM(RTRIM(pb.date_close)), '') IS NULL
    OR @today <= TRY_CONVERT(date, LTRIM(RTRIM(pb.date_close)))
  )
  AND (
    sm.last_date_sc IS NULL
    OR sm.last_date_sc <= @schedule_cutoff
  )
  AND ISNULL(LTRIM(RTRIM(pb.date_close)), '') <> @date_close_set;
GO
