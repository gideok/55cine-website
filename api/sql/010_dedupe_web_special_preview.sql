/*
 * web_special 중복 점검·정리 (미실행 — 검토 후 수동 적용)
 *
 * 점검 일시 기준 요약 (총 30건: exhibition 29, event 1)
 * - public_id 중복: 없음 (UQ 제약 정상)
 * - 제목+kind+date_label 기준 중복: exhibition 5쌍 (10건)
 *
 * 중복 원인 추정:
 *   1) 마이그레이션 1차(14:00) + 재적재(14:08)로 동일 제목이 다른 public_id(e000002↔e000026 등)로 이중 등록
 *   2) e000009 / e000010 은 1차 적재 시 동일 JSON 제목이 연속 public_id 로 2건 등록
 *
 * 정리 기준(제안): (kind, title, ISNULL(date_label,'')) 그룹당 seq 가 가장 작은 행 1건만 유지
 *   → 삭제 후보 seq: 35, 52, 53, 54, 55  (public_id: e000010, e000026, e000027, e000028, e000029)
 *   → 유지 행 seq: 27, 29, 31, 33, 34
 *
 * FK: web_special_item → web_special ON DELETE CASCADE
 *     web_special_screening → web_special_item ON DELETE CASCADE
 */

/* =============================================================================
   1) 중복 점검 (SELECT 전용)
   ============================================================================= */

-- 1-1. 전체 건수
SELECT kind, COUNT(*) AS cnt
FROM dbo.web_special
GROUP BY kind
ORDER BY kind;

-- 1-2. public_id 중복 (있으면 제약 위반 직전 상태)
SELECT public_id, COUNT(*) AS cnt
FROM dbo.web_special
GROUP BY public_id
HAVING COUNT(*) > 1;

-- 1-3. 제목+kind+date_label 중복 그룹
SELECT kind, title, ISNULL(date_label, N'') AS date_label, COUNT(*) AS cnt
FROM dbo.web_special
GROUP BY kind, title, ISNULL(date_label, N'')
HAVING COUNT(*) > 1
ORDER BY cnt DESC, title;

-- 1-4. 중복 그룹 상세 (하위 item/screening 건수 포함)
WITH dup AS (
  SELECT kind, title, ISNULL(date_label, N'') AS date_label
  FROM dbo.web_special
  GROUP BY kind, title, ISNULL(date_label, N'')
  HAVING COUNT(*) > 1
)
SELECT
  s.seq,
  s.public_id,
  s.kind,
  s.title,
  s.date_label,
  s.list_order,
  s.img_main,
  s.created_at,
  s.updated_at,
  (SELECT COUNT(*) FROM dbo.web_special_item i WHERE i.special_seq = s.seq) AS item_cnt,
  (SELECT COUNT(*) FROM dbo.web_special_screening sc
     INNER JOIN dbo.web_special_item i ON i.item_seq = sc.item_seq
     WHERE i.special_seq = s.seq) AS screening_cnt
FROM dbo.web_special s
INNER JOIN dup d
  ON s.kind = d.kind
 AND s.title = d.title
 AND ISNULL(s.date_label, N'') = d.date_label
ORDER BY s.title, s.seq;

-- 1-5. list_order 충돌 (중복 제거 후 재정렬 검토용)
SELECT kind, list_order, COUNT(*) AS cnt
FROM dbo.web_special
GROUP BY kind, list_order
HAVING COUNT(*) > 1
ORDER BY kind, list_order;

-- 1-6. 삭제 후보 미리보기 (그룹당 최소 seq 유지, 나머지 삭제 대상)
WITH ranked AS (
  SELECT
    seq,
    public_id,
    kind,
    title,
    date_label,
    list_order,
    ROW_NUMBER() OVER (
      PARTITION BY kind, title, ISNULL(date_label, N'')
      ORDER BY seq ASC
    ) AS rn
  FROM dbo.web_special
)
SELECT seq, public_id, kind, title, date_label, list_order, rn
FROM ranked
WHERE rn > 1
ORDER BY title, seq;

/* =============================================================================
   2) 정리 SQL (실행 전 반드시 1) 점검 결과 재확인)
   ============================================================================= */

/*
BEGIN TRANSACTION;

-- 2-1. 삭제 대상 확인 (COMMIT 전 마지막 점검)
WITH to_delete AS (
  SELECT seq
  FROM (
    SELECT
      seq,
      ROW_NUMBER() OVER (
        PARTITION BY kind, title, ISNULL(date_label, N'')
        ORDER BY seq ASC
      ) AS rn
    FROM dbo.web_special
  ) x
  WHERE rn > 1
)
SELECT s.seq, s.public_id, s.title, s.date_label
FROM dbo.web_special s
INNER JOIN to_delete d ON d.seq = s.seq
ORDER BY s.seq;

-- 2-2. 중복 행 삭제 (하위 item/screening CASCADE)
WITH to_delete AS (
  SELECT seq
  FROM (
    SELECT
      seq,
      ROW_NUMBER() OVER (
        PARTITION BY kind, title, ISNULL(date_label, N'')
        ORDER BY seq ASC
      ) AS rn
    FROM dbo.web_special
  ) x
  WHERE rn > 1
)
DELETE s
FROM dbo.web_special s
INNER JOIN to_delete d ON d.seq = s.seq;

-- 기대 삭제 건수: 5
-- SELECT @@ROWCOUNT AS deleted_rows;

-- 2-3. (선택) exhibition list_order 를 public_id 숫자와 맞추고 싶을 때
--       마이그레이션 규칙: list_order = public_id 의 trailing number
/*
UPDATE dbo.web_special
SET list_order = TRY_CAST(
  SUBSTRING(public_id, PATINDEX('%[0-9]%', public_id), 20) AS INT
)
WHERE kind = N'exhibition'
  AND public_id LIKE N'e%';
*/

-- ROLLBACK;  -- 검증 단계
-- COMMIT;
*/

/* =============================================================================
   3) 명시적 삭제 (그룹 규칙 대신 건별 확정 시)
   ============================================================================= */

/*
BEGIN TRANSACTION;

DELETE FROM dbo.web_special
WHERE public_id IN (
  N'e000010',  -- 인디피크닉 2025 단편3/4 (e000009 와 동일 제목)
  N'e000026',  -- 홍진훤 패배 삼부작 (e000002 중복)
  N'e000027',  -- 대구독립영화연말정산 (e000004 중복)
  N'e000028',  -- 인디피크닉 2025 단편5/6 (e000006 중복)
  N'e000029'   -- 에스퍼의 빛 전작전 (e000008 중복)
);

-- SELECT @@ROWCOUNT AS deleted_rows;

-- ROLLBACK;
-- COMMIT;
*/
