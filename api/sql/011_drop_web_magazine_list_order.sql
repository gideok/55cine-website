-- web_magazine: list_order 제거, created_at 역순 정렬용 인덱스

IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_web_magazine_section_list' AND object_id = OBJECT_ID(N'dbo.web_magazine')
)
BEGIN
  DROP INDEX IX_web_magazine_section_list ON dbo.web_magazine;
END
GO

IF EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_web_magazine_past_list' AND object_id = OBJECT_ID(N'dbo.web_magazine')
)
BEGIN
  DROP INDEX IX_web_magazine_past_list ON dbo.web_magazine;
END
GO

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.web_magazine') AND name = N'list_order'
)
BEGIN
  ALTER TABLE dbo.web_magazine DROP CONSTRAINT DF_web_magazine_list_order;
END
GO

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.web_magazine') AND name = N'list_order'
)
BEGIN
  ALTER TABLE dbo.web_magazine DROP COLUMN list_order;
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_web_magazine_section_created' AND object_id = OBJECT_ID(N'dbo.web_magazine')
)
BEGIN
  CREATE INDEX IX_web_magazine_section_created
    ON dbo.web_magazine (section, is_past, created_at DESC, seq DESC);
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = N'IX_web_magazine_past_created' AND object_id = OBJECT_ID(N'dbo.web_magazine')
)
BEGIN
  CREATE INDEX IX_web_magazine_past_created
    ON dbo.web_magazine (is_past, created_at DESC, seq DESC)
    WHERE is_past = 1;
END
GO
