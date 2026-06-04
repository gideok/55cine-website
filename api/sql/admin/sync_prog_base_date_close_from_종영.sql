/*
  관리자 수동 실행용 (api/sql/admin — db:migrate 자동 실행 대상 아님)

  목적:
    prog_daily.prog_label 에 '(종영)' 이 포함된 회차의 date_sc 를
    해당 prog_id 의 prog_base.date_close 에 반영합니다.

  전제:
    - date_sc, date_close 모두 char(10), 형식 yyyy-MM-dd
    - 동일 prog_id 에 종영 회차가 여러 건이면 date_sc 가장 늦은 날(MAX) 사용

  실행:
    SSMS / Azure Data Studio / sqlcmd 등에서 cine55 DB 선택 후 실행
    반드시 1) 미리보기 SELECT → 2) UPDATE → 3) 검증 SELECT 순으로 확인

  롤백:
    UPDATE 전 백업 또는 트랜잭션 내에서 COMMIT 대신 ROLLBACK
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ------------------------------------------------------------------ */
/* 1) 반영 대상 미리보기 (실행 전 확인)                                */
/* ------------------------------------------------------------------ */
;WITH closing AS (
  SELECT
    pd.prog_id,
    MAX(LTRIM(RTRIM(pd.date_sc))) AS date_close_new
  FROM dbo.prog_daily AS pd
  WHERE pd.prog_label LIKE N'%(종영)%'
    AND NULLIF(LTRIM(RTRIM(pd.date_sc)), '') IS NOT NULL
    AND TRY_CONVERT(date, LTRIM(RTRIM(pd.date_sc))) IS NOT NULL
  GROUP BY pd.prog_id
)
SELECT
  pb.prog_id,
  pb.name,
  LTRIM(RTRIM(pb.date_close)) AS date_close_before,
  c.date_close_new AS date_close_after,
  CASE
    WHEN ISNULL(LTRIM(RTRIM(pb.date_close)), '') = c.date_close_new THEN N'동일(스킵)'
    ELSE N'변경'
  END AS action
FROM dbo.prog_base AS pb
INNER JOIN closing AS c ON c.prog_id = pb.prog_id
ORDER BY pb.prog_id;
GO

/* ------------------------------------------------------------------ */
/* 2) UPDATE (확인 후 실행 — 필요 시 BEGIN TRAN … ROLLBACK 으로 시험) */
/* ------------------------------------------------------------------ */
BEGIN TRANSACTION;

;WITH closing AS (
  SELECT
    pd.prog_id,
    MAX(LTRIM(RTRIM(pd.date_sc))) AS date_close_new
  FROM dbo.prog_daily AS pd
  WHERE pd.prog_label LIKE N'%(종영)%'
    AND NULLIF(LTRIM(RTRIM(pd.date_sc)), '') IS NOT NULL
    AND TRY_CONVERT(date, LTRIM(RTRIM(pd.date_sc))) IS NOT NULL
  GROUP BY pd.prog_id
)
UPDATE pb
SET pb.date_close = c.date_close_new
FROM dbo.prog_base AS pb
INNER JOIN closing AS c ON c.prog_id = pb.prog_id
WHERE ISNULL(LTRIM(RTRIM(pb.date_close)), '') <> c.date_close_new;

SELECT @@ROWCOUNT AS rows_updated;

-- 문제 없으면 COMMIT, 시험만 할 경우 ROLLBACK
COMMIT TRANSACTION;
GO

/* ------------------------------------------------------------------ */
/* 3) 반영 후 검증 — 종영 회차 date_sc 와 date_close 불일치 건수        */
/* ------------------------------------------------------------------ */
;WITH closing AS (
  SELECT
    pd.prog_id,
    MAX(LTRIM(RTRIM(pd.date_sc))) AS date_close_expected
  FROM dbo.prog_daily AS pd
  WHERE pd.prog_label LIKE N'%(종영)%'
    AND NULLIF(LTRIM(RTRIM(pd.date_sc)), '') IS NOT NULL
    AND TRY_CONVERT(date, LTRIM(RTRIM(pd.date_sc))) IS NOT NULL
  GROUP BY pd.prog_id
)
SELECT COUNT(*) AS mismatch_count
FROM dbo.prog_base AS pb
INNER JOIN closing AS c ON c.prog_id = pb.prog_id
WHERE ISNULL(LTRIM(RTRIM(pb.date_close)), '') <> c.date_close_expected;
GO
