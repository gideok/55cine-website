-- 매거진 삼삼오오 — 프리뷰·연재·GV·지난기사 단일 테이블
-- 대외 식별자: seq (PK)

IF NOT EXISTS (
  SELECT 1 FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = N'dbo' AND t.name = N'web_magazine'
)
BEGIN
  CREATE TABLE dbo.web_magazine (
    seq INT IDENTITY(1, 1) NOT NULL,
    section NVARCHAR(12) NOT NULL,
    is_past BIT NOT NULL CONSTRAINT DF_web_magazine_is_past DEFAULT (0),
    title NVARCHAR(500) NOT NULL,
    movie_title NVARCHAR(300) NULL,
    subtitle NVARCHAR(300) NULL,
    published_label NVARCHAR(120) NULL,
    published_at DATETIME2(0) NULL,
    body_html NVARCHAR(MAX) NULL,
    img_thumb NVARCHAR(500) NULL,
    img_cover NVARCHAR(500) NULL,
    source_url NVARCHAR(500) NULL,
    created_at DATETIME2(0) NOT NULL
      CONSTRAINT DF_web_magazine_created DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(0) NOT NULL
      CONSTRAINT DF_web_magazine_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_web_magazine PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT CK_web_magazine_section CHECK (
      section IN (N'preview', N'serial', N'gv-moment')
    )
  );

  CREATE INDEX IX_web_magazine_section_created
    ON dbo.web_magazine (section, is_past, created_at DESC, seq DESC);

  CREATE INDEX IX_web_magazine_past_created
    ON dbo.web_magazine (is_past, created_at DESC, seq DESC)
    WHERE is_past = 1;
END
GO
