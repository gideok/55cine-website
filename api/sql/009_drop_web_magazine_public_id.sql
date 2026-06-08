-- web_magazine: 대외 식별자를 seq 로 통일, public_id 컬럼 제거

IF EXISTS (
  SELECT 1 FROM sys.key_constraints
  WHERE name = N'UQ_web_magazine_public_id' AND parent_object_id = OBJECT_ID(N'dbo.web_magazine')
)
BEGIN
  ALTER TABLE dbo.web_magazine DROP CONSTRAINT UQ_web_magazine_public_id;
END
GO

IF EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.web_magazine') AND name = N'public_id'
)
BEGIN
  ALTER TABLE dbo.web_magazine DROP COLUMN public_id;
END
GO
