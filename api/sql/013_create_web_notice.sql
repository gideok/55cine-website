-- 사이트 공지사항 (활성 0~1건)
IF NOT EXISTS (
  SELECT 1 FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = N'dbo' AND t.name = N'web_notice'
)
BEGIN
  CREATE TABLE dbo.web_notice (
    seq INT IDENTITY(1, 1) NOT NULL,
    title NVARCHAR(200) NOT NULL,
    format_type NVARCHAR(20) NOT NULL,
    body_html NVARCHAR(MAX) NULL,
    img_main NVARCHAR(500) NULL,
    content_width TINYINT NOT NULL
      CONSTRAINT DF_web_notice_content_width DEFAULT (100),
    is_active BIT NOT NULL
      CONSTRAINT DF_web_notice_is_active DEFAULT (0),
    created_at DATETIME2(0) NOT NULL
      CONSTRAINT DF_web_notice_created DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(0) NOT NULL
      CONSTRAINT DF_web_notice_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_web_notice PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT CK_web_notice_format_type CHECK (
      format_type IN (N'image-text', N'text')
    ),
    CONSTRAINT CK_web_notice_content_width CHECK (content_width IN (100, 50, 30))
  );

  CREATE INDEX IX_web_notice_created ON dbo.web_notice (created_at DESC, seq DESC);

  CREATE UNIQUE INDEX UX_web_notice_one_active
    ON dbo.web_notice (is_active)
    WHERE is_active = 1;
END
GO
