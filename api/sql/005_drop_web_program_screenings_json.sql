-- 상영시간표는 prog_daily.date_sc / time_sc 사용 — screenings_json 미사용
IF EXISTS (
  SELECT 1 FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = N'dbo' AND t.name = N'web_program'
)
AND COL_LENGTH('dbo.web_program', 'screenings_json') IS NOT NULL
BEGIN
  ALTER TABLE dbo.web_program DROP COLUMN screenings_json;
END
GO
