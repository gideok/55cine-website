-- web_program.prog_id → prog_base.prog_id FK (ON DELETE CASCADE)
-- prog_base 행 삭제 시 연결된 web_program 행 자동 삭제

IF EXISTS (
  SELECT 1 FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = N'dbo' AND t.name = N'web_program'
)
AND EXISTS (
  SELECT 1 FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = N'dbo' AND t.name = N'prog_base'
)
AND NOT EXISTS (
  SELECT 1
  FROM sys.foreign_keys
  WHERE name = N'FK_web_program_prog_base'
    AND parent_object_id = OBJECT_ID(N'dbo.web_program')
)
BEGIN
  -- FK 추가 전 고아 web_program 제거 (prog_base에 없는 prog_id)
  DELETE wp
  FROM dbo.web_program AS wp
  LEFT JOIN dbo.prog_base AS pb ON pb.prog_id = wp.prog_id
  WHERE pb.prog_id IS NULL;

  ALTER TABLE dbo.web_program
  ADD CONSTRAINT FK_web_program_prog_base
  FOREIGN KEY (prog_id) REFERENCES dbo.prog_base (prog_id)
  ON DELETE CASCADE;
END
GO
