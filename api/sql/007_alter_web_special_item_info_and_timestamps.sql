-- web_special: 등록·수정 일시
-- web_special_item: info(통합) → title_en, info(정보), running_minutes, running_time_label
-- prog_base 참고: name2, runningtime (테이블 변경 없음)

IF COL_LENGTH('dbo.web_special', 'created_at') IS NULL
BEGIN
  ALTER TABLE dbo.web_special ADD
    created_at DATETIME2(0) NOT NULL
      CONSTRAINT DF_web_special_created DEFAULT (SYSUTCDATETIME()),
    updated_at DATETIME2(0) NOT NULL
      CONSTRAINT DF_web_special_updated DEFAULT (SYSUTCDATETIME());
END
GO

IF COL_LENGTH('dbo.web_special_item', 'title_en') IS NULL
BEGIN
  ALTER TABLE dbo.web_special_item ADD
    title_en NVARCHAR(300) NULL,
    running_minutes INT NULL,
    running_time_label NVARCHAR(120) NULL;
END
GO

/* 기존 info(통합 문자열) → 세분화 컬럼 백필은 migrate-special-program.mjs --backfill-info 실행 */
