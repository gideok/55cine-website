-- 기획전·행사 통합 (prog_base / prog_daily 변경 없음)
-- public_id: URL용 e000003, ev000001 — 내부 PK: seq (메인고유일련번호)

IF NOT EXISTS (
  SELECT 1 FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = N'dbo' AND t.name = N'web_special'
)
BEGIN
  CREATE TABLE dbo.web_special (
    seq INT IDENTITY(1, 1) NOT NULL,
    public_id NVARCHAR(20) NOT NULL,
    kind NVARCHAR(12) NOT NULL,
    title NVARCHAR(500) NOT NULL,
    date_label NVARCHAR(300) NULL,
    body NVARCHAR(MAX) NULL,
    img_main NVARCHAR(500) NULL,
    booking_url NVARCHAR(500) NULL,
    list_order INT NOT NULL CONSTRAINT DF_web_special_list_order DEFAULT (0),
    created_at DATETIME2(0) NOT NULL
      CONSTRAINT DF_web_special_created DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(0) NOT NULL
      CONSTRAINT DF_web_special_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT PK_web_special PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT CK_web_special_kind CHECK (kind IN (N'exhibition', N'event')),
    CONSTRAINT UQ_web_special_public_id UNIQUE (public_id)
  );

  CREATE INDEX IX_web_special_kind_list ON dbo.web_special (kind, list_order DESC, seq DESC);
END
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = N'dbo' AND t.name = N'web_special_item'
)
BEGIN
  CREATE TABLE dbo.web_special_item (
    item_seq INT IDENTITY(1, 1) NOT NULL,
    special_seq INT NOT NULL,
    sort_order INT NOT NULL CONSTRAINT DF_web_special_item_sort DEFAULT (0),
    title NVARCHAR(300) NULL,
    is_empty_spacer BIT NOT NULL CONSTRAINT DF_web_special_item_empty DEFAULT (0),
    img_path NVARCHAR(500) NULL,
    title_en NVARCHAR(300) NULL,
    info NVARCHAR(300) NULL,
    running_minutes INT NULL,
    running_time_label NVARCHAR(120) NULL,
    director NVARCHAR(200) NULL,
    cast_names NVARCHAR(1000) NULL,
    description NVARCHAR(MAX) NULL,
    section_name NVARCHAR(200) NULL,
    CONSTRAINT PK_web_special_item PRIMARY KEY CLUSTERED (item_seq),
    CONSTRAINT FK_web_special_item_special
      FOREIGN KEY (special_seq) REFERENCES dbo.web_special (seq)
      ON DELETE CASCADE
  );

  CREATE INDEX IX_web_special_item_special ON dbo.web_special_item (special_seq, sort_order, item_seq);
END
GO

/* 상영 회차 — JSON films[].screenings[] 대응 */
IF NOT EXISTS (
  SELECT 1 FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = N'dbo' AND t.name = N'web_special_screening'
)
BEGIN
  CREATE TABLE dbo.web_special_screening (
    screening_seq INT IDENTITY(1, 1) NOT NULL,
    item_seq INT NOT NULL,
    date_sc CHAR(10) NOT NULL,
    time_sc CHAR(5) NOT NULL,
    is_gv BIT NOT NULL CONSTRAINT DF_web_special_screening_gv DEFAULT (0),
    sort_order INT NOT NULL CONSTRAINT DF_web_special_screening_sort DEFAULT (0),
    CONSTRAINT PK_web_special_screening PRIMARY KEY CLUSTERED (screening_seq),
    CONSTRAINT FK_web_special_screening_item
      FOREIGN KEY (item_seq) REFERENCES dbo.web_special_item (item_seq)
      ON DELETE CASCADE
  );

  CREATE INDEX IX_web_special_screening_item ON dbo.web_special_screening (item_seq, date_sc, time_sc);
END
GO
