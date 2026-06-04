-- 신규 테이블만 추가 (prog_daily, prog_base 등 기존 테이블은 변경하지 않음)
IF NOT EXISTS (
  SELECT 1 FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = N'dbo' AND t.name = N'web_program'
)
BEGIN
  CREATE TABLE dbo.web_program (
    seq INT IDENTITY(1, 1) NOT NULL,
    prog_id INT NOT NULL,
    slug NVARCHAR(120) NULL,
    detail_url NVARCHAR(500) NULL,
    img_thumb NVARCHAR(500) NULL,
    img1 NVARCHAR(500) NULL,
    img2 NVARCHAR(500) NULL,
    img3 NVARCHAR(500) NULL,
    img4 NVARCHAR(500) NULL,
    img5 NVARCHAR(500) NULL,
    director NVARCHAR(200) NULL,
    cast_names NVARCHAR(1000) NULL,
    info NVARCHAR(300) NULL,
    synopsis NVARCHAR(MAX) NULL,
    trailer_url NVARCHAR(200) NULL,
    CONSTRAINT PK_web_program PRIMARY KEY CLUSTERED (seq)
  );

  CREATE INDEX IX_web_program_prog_id ON dbo.web_program (prog_id);
  CREATE UNIQUE INDEX UX_web_program_prog_id ON dbo.web_program (prog_id);
END
GO
