-- 매거진 삼삼오오 — 프리뷰·연재·GV·지난기사 단일 테이블
-- public_id: pv001, sr001, gm001, pa001 …

IF NOT EXISTS (
  SELECT 1 FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = N'dbo' AND t.name = N'web_magazine'
)
BEGIN
  CREATE TABLE dbo.web_magazine (
    seq INT IDENTITY(1, 1) NOT NULL,
    public_id NVARCHAR(20) NOT NULL,
    section NVARCHAR(12) NOT NULL,
    is_past BIT NOT NULL CONSTRAINT DF_web_magazine_is_past DEFAULT (0),
    title NVARCHAR(500) NOT NULL,
    movie_title NVARCHAR(300) NULL,
    subtitle NVARCHAR(300) NULL,
    published_label NVARCHAR(120) NULL,
    published_at DATETIME2(0) NULL,
    excerpt NVARCHAR(2000) NULL,
    body_html NVARCHAR(MAX) NULL,
    img_thumb NVARCHAR(500) NULL,
    img_cover NVARCHAR(500) NULL,
    source_url NVARCHAR(500) NULL,
    article_url NVARCHAR(500) NULL,
    list_order INT NOT NULL CONSTRAINT DF_web_magazine_list_order DEFAULT (0),
    created_at DATETIME2(0) NOT NULL
      CONSTRAINT DF_web_magazine_created DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(0) NOT NULL
      CONSTRAINT DF_web_magazine_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_web_magazine PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT UQ_web_magazine_public_id UNIQUE (public_id),
    CONSTRAINT CK_web_magazine_section CHECK (
      section IN (N'preview', N'serial', N'gv-moment')
    )
  );

  CREATE INDEX IX_web_magazine_section_list
    ON dbo.web_magazine (section, is_past, list_order ASC, seq ASC);

  CREATE INDEX IX_web_magazine_past_list
    ON dbo.web_magazine (is_past, list_order ASC, seq ASC)
    WHERE is_past = 1;
END
GO
