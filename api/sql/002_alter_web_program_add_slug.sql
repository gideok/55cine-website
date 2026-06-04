-- 이미 001(구버전)로 web_program 이 생성된 경우 slug/detail_url 컬럼 추가
IF EXISTS (
  SELECT 1 FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = N'dbo' AND t.name = N'web_program'
)
BEGIN
  IF COL_LENGTH('dbo.web_program', 'slug') IS NULL
    ALTER TABLE dbo.web_program ADD slug NVARCHAR(120) NULL;

  IF COL_LENGTH('dbo.web_program', 'detail_url') IS NULL
    ALTER TABLE dbo.web_program ADD detail_url NVARCHAR(500) NULL;

  IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_web_program_prog_id' AND object_id = OBJECT_ID(N'dbo.web_program')
  )
    CREATE UNIQUE INDEX UX_web_program_prog_id ON dbo.web_program (prog_id);
END
GO
