-- web_magazine: article_url 제거 (source_url 만 유지)

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.web_magazine') AND name = N'article_url'
)
BEGIN
  ALTER TABLE dbo.web_magazine DROP COLUMN article_url;
END
GO
