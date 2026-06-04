-- web_program: 상영작 웹 상세 필드 (prog_base / prog_daily 는 변경하지 않음)
IF EXISTS (
  SELECT 1 FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = N'dbo' AND t.name = N'web_program'
)
BEGIN
  IF COL_LENGTH('dbo.web_program', 'director') IS NULL
    ALTER TABLE dbo.web_program ADD director NVARCHAR(200) NULL;

  IF COL_LENGTH('dbo.web_program', 'cast_names') IS NULL
    ALTER TABLE dbo.web_program ADD cast_names NVARCHAR(1000) NULL;

  IF COL_LENGTH('dbo.web_program', 'info') IS NULL
    ALTER TABLE dbo.web_program ADD info NVARCHAR(300) NULL;

  IF COL_LENGTH('dbo.web_program', 'synopsis') IS NULL
    ALTER TABLE dbo.web_program ADD synopsis NVARCHAR(MAX) NULL;

  IF COL_LENGTH('dbo.web_program', 'trailer_url') IS NULL
    ALTER TABLE dbo.web_program ADD trailer_url NVARCHAR(200) NULL;
END
GO
