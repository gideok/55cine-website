-- web_magazine: excerpt 제거 (목록 요약은 body_html plain text 파생)

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.web_magazine') AND name = N'excerpt'
)
BEGIN
  ALTER TABLE dbo.web_magazine DROP COLUMN excerpt;
END
GO
