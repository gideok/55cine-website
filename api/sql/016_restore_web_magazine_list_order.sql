-- web_magazine: list_order 복구·백필 (표시 순서: list_order DESC, seq DESC)
-- 신규 등록은 앱에서 MAX(list_order)+1 부여

-- 오타 컬럼 lst_order → list_order 정규화
IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.web_magazine') AND name = N'lst_order'
)
AND NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.web_magazine') AND name = N'list_order'
)
BEGIN
  EXEC sp_rename N'dbo.web_magazine.lst_order', N'list_order', N'COLUMN';
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.web_magazine') AND name = N'list_order'
)
BEGIN
  ALTER TABLE dbo.web_magazine ADD list_order INT NOT NULL
    CONSTRAINT DF_web_magazine_list_order DEFAULT (0);
END
GO

-- 기존 자료: created_at ASC → list_order 1..N (최신이 큰 값 → DESC 정렬 시 상단)
;WITH ordered AS (
  SELECT
    seq,
    ROW_NUMBER() OVER (ORDER BY created_at ASC, seq ASC) AS rn
  FROM dbo.web_magazine
)
UPDATE m
SET m.list_order = o.rn
FROM dbo.web_magazine AS m
INNER JOIN ordered AS o ON o.seq = m.seq;
GO

IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_web_magazine_section_created' AND object_id = OBJECT_ID(N'dbo.web_magazine')
)
BEGIN
  DROP INDEX IX_web_magazine_section_created ON dbo.web_magazine;
END
GO

IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_web_magazine_past_created' AND object_id = OBJECT_ID(N'dbo.web_magazine')
)
BEGIN
  DROP INDEX IX_web_magazine_past_created ON dbo.web_magazine;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_web_magazine_section_list' AND object_id = OBJECT_ID(N'dbo.web_magazine')
)
BEGIN
  CREATE INDEX IX_web_magazine_section_list
    ON dbo.web_magazine (section, is_past, list_order DESC, seq DESC);
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_web_magazine_past_list' AND object_id = OBJECT_ID(N'dbo.web_magazine')
)
BEGIN
  CREATE INDEX IX_web_magazine_past_list
    ON dbo.web_magazine (is_past, list_order DESC, seq DESC)
    WHERE is_past = 1;
END
GO
