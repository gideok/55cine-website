-- 상영 회차(prog_daily.seq)별 웹 플래그·메타 (prog_daily 는 SELECT 만, FK 참조만)
IF NOT EXISTS (
  SELECT 1 FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = N'dbo' AND t.name = N'web_program_schedule'
)
BEGIN
  CREATE TABLE dbo.web_program_schedule (
    seq INT IDENTITY(1, 1) NOT NULL,
    prog_daily_seq INT NOT NULL,
    is_opening BIT NOT NULL CONSTRAINT DF_web_program_schedule_opening DEFAULT (0),
    is_closing BIT NOT NULL CONSTRAINT DF_web_program_schedule_closing DEFAULT (0),
    is_gv BIT NOT NULL CONSTRAINT DF_web_program_schedule_gv DEFAULT (0),
    is_ct BIT NOT NULL CONSTRAINT DF_web_program_schedule_ct DEFAULT (0),
    note NVARCHAR(200) NULL,
    CONSTRAINT PK_web_program_schedule PRIMARY KEY CLUSTERED (seq),
    CONSTRAINT UQ_web_program_schedule_prog_daily UNIQUE (prog_daily_seq),
    CONSTRAINT FK_web_program_schedule_prog_daily
      FOREIGN KEY (prog_daily_seq) REFERENCES dbo.prog_daily (seq)
  );

  CREATE INDEX IX_web_program_schedule_prog_daily_seq ON dbo.web_program_schedule (prog_daily_seq);
END
GO
