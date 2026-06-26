import sql from "mssql";
import { getPool } from "../../db/pool.js";

export type SysCodeItem = {
  seqCode: number;
  name: string;
};

/** FormProgramSave 콤보 div_code (FillCombo) */
export const PROG_BASE_FORM_DIV_CODES = {
  divScreen: "015",
  country: "016",
  divProg: "013",
  specVideo: "010",
  specAudio: "011",
  specFormat: "014",
  grade: "012",
  divState: "040"
} as const;

export type ProgBaseFormOptions = {
  divScreen: SysCodeItem[];
  country: SysCodeItem[];
  divProg: SysCodeItem[];
  specVideo: SysCodeItem[];
  specAudio: SysCodeItem[];
  specFormat: SysCodeItem[];
  grade: SysCodeItem[];
  divState: SysCodeItem[];
};

export type CreateProgBaseInput = {
  name: string;
  name2?: string;
  divScreen: number;
  divProg: number;
  grade: number;
  country: number;
  runningTime?: number | null;
  producer?: string | null;
  distributor?: string | null;
  specVideo: number;
  specAudio: number;
  specFormat: number;
  volumn?: string;
  dateOpen: string;
  dateClose?: string | null;
  divState: number;
  progUrl?: string | null;
  confirmDuplicate?: boolean;
};

export type UpdateProgBaseInput = Omit<CreateProgBaseInput, "confirmDuplicate">;

export type CreateProgBaseResult = {
  progId: number;
  titleKo: string;
  titleEn: string;
};

function mapSysCodeRows(rows: { seq_code: number; name: string | null }[]): SysCodeItem[] {
  return rows.map((row) => ({
    seqCode: Number(row.seq_code),
    name: String(row.name || "").trim()
  }));
}

async function querySysCodes(divCode: string): Promise<SysCodeItem[]> {
  const pool = await getPool();
  const result = await pool.request().input("divCode", sql.VarChar(10), divCode).query<{
    seq_code: number;
    name: string | null;
  }>(`
    SELECT seq_code, name
    FROM dbo.sys_code
    WHERE div_code = @divCode AND seq_code <> 255
    ORDER BY seq_code
  `);
  return mapSysCodeRows(result.recordset);
}

export async function getProgBaseFormOptions(): Promise<ProgBaseFormOptions> {
  const entries = Object.entries(PROG_BASE_FORM_DIV_CODES) as [keyof ProgBaseFormOptions, string][];
  const loaded = await Promise.all(entries.map(([, div]) => querySysCodes(div)));
  const out = {} as ProgBaseFormOptions;
  entries.forEach(([key], i) => {
    out[key] = loaded[i]!;
  });
  return out;
}

export async function getAdminSysCodes(divCode: string): Promise<SysCodeItem[]> {
  return querySysCodes(divCode);
}

/** 공백 제거 후 동일 제목 건수 (FormProgramSave.SaveRecord 검증) */
export async function countDuplicateProgTitle(name: string): Promise<number> {
  const normalized = String(name || "").replace(/\s/g, "");
  if (!normalized) return 0;
  const pool = await getPool();
  const result = await pool
    .request()
    .input("normalized", sql.NVarChar(500), normalized)
    .query<{ cnt: number }>(`
      SELECT COUNT(*) AS cnt
      FROM dbo.prog_base
      WHERE REPLACE(name, ' ', '') = @normalized
    `);
  return Number(result.recordset[0]?.cnt ?? 0);
}

function parseOptionalInt(val: number | null | undefined): number | null {
  if (val == null) return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
}

export async function createProgBase(input: CreateProgBaseInput): Promise<CreateProgBaseResult> {
  const name = String(input.name || "").trim();
  const name2 = String(input.name2 ?? "").trim();
  if (!name) throw new Error("영화명을 입력해 주세요.");

  const dup = await countDuplicateProgTitle(name);
  if (dup > 0 && !input.confirmDuplicate) {
    const err = new Error("동일한 제목의 영화가 등록되어 있습니다.");
    (err as Error & { code: string }).code = "DUPLICATE_TITLE";
    throw err;
  }

  const pool = await getPool();
  const runningTime = parseOptionalInt(input.runningTime);
  const dateClose = input.dateClose ? String(input.dateClose).trim().slice(0, 10) : null;

  const result = await pool
    .request()
    .input("name", sql.NVarChar(300), name)
    .input("name2", sql.NVarChar(300), name2)
    .input("divScreen", sql.TinyInt, input.divScreen)
    .input("divProg", sql.TinyInt, input.divProg)
    .input("grade", sql.TinyInt, input.grade)
    .input("country", sql.TinyInt, input.country)
    .input("runningTime", sql.Int, runningTime)
    .input("producer", sql.NVarChar(200), input.producer?.trim() || null)
    .input("distributor", sql.NVarChar(200), input.distributor?.trim() || null)
    .input("specVideo", sql.TinyInt, input.specVideo)
    .input("specAudio", sql.TinyInt, input.specAudio)
    .input("specFormat", sql.TinyInt, input.specFormat)
    .input("volumn", sql.NVarChar(50), String(input.volumn ?? "").trim())
    .input("dateOpen", sql.Date, input.dateOpen)
    .input("dateClose", sql.Date, dateClose)
    .input("divState", sql.TinyInt, input.divState)
    .input("progUrl", sql.NVarChar(500), input.progUrl?.trim() || "")
    .query<{ prog_id: number }>(`
      INSERT INTO dbo.prog_base (
        name, name2, div_screen, div_prog, grade, country, runningtime,
        producer, distributor, spec_video, spec_audio, spec_format,
        volumn, date_open, date_close, div_state, prog_url
      )
      OUTPUT INSERTED.prog_id
      VALUES (
        @name, @name2, @divScreen, @divProg, @grade, @country, @runningTime,
        @producer, @distributor, @specVideo, @specAudio, @specFormat,
        @volumn, @dateOpen, @dateClose, @divState, @progUrl
      )
    `);

  const progId = Number(result.recordset[0]?.prog_id);
  if (!progId) throw new Error("상영작 등록에 실패했습니다.");

  return { progId, titleKo: name, titleEn: name2 };
}

export async function updateProgBase(
  progId: number,
  input: UpdateProgBaseInput
): Promise<{ progId: number; titleKo: string; titleEn: string }> {
  const name = String(input.name || "").trim();
  const name2 = String(input.name2 ?? "").trim();
  if (!name) throw new Error("영화명을 입력해 주세요.");

  const pool = await getPool();
  const prev = await pool.request().input("progId", sql.Int, progId).query<{
    div_prog: number | null;
  }>(`SELECT div_prog FROM dbo.prog_base WHERE prog_id = @progId`);
  const prevRow = prev.recordset[0];
  if (!prevRow) throw new Error("상영작을 찾을 수 없습니다.");

  const runningTime = parseOptionalInt(input.runningTime);
  const dateClose = input.dateClose ? String(input.dateClose).trim().slice(0, 10) : null;

  await pool
    .request()
    .input("progId", sql.Int, progId)
    .input("name", sql.NVarChar(300), name)
    .input("name2", sql.NVarChar(300), name2)
    .input("divScreen", sql.TinyInt, input.divScreen)
    .input("divProg", sql.TinyInt, input.divProg)
    .input("grade", sql.TinyInt, input.grade)
    .input("country", sql.TinyInt, input.country)
    .input("runningTime", sql.Int, runningTime)
    .input("producer", sql.NVarChar(200), input.producer?.trim() || null)
    .input("distributor", sql.NVarChar(200), input.distributor?.trim() || null)
    .input("specVideo", sql.TinyInt, input.specVideo)
    .input("specAudio", sql.TinyInt, input.specAudio)
    .input("specFormat", sql.TinyInt, input.specFormat)
    .input("volumn", sql.NVarChar(50), String(input.volumn ?? "").trim())
    .input("dateOpen", sql.Date, input.dateOpen)
    .input("dateClose", sql.Date, dateClose)
    .input("divState", sql.TinyInt, input.divState)
    .input("progUrl", sql.NVarChar(500), input.progUrl?.trim() || "")
    .query(`
      UPDATE dbo.prog_base SET
        name = @name,
        name2 = @name2,
        div_screen = @divScreen,
        div_prog = @divProg,
        grade = @grade,
        country = @country,
        runningtime = @runningTime,
        producer = @producer,
        distributor = @distributor,
        spec_video = @specVideo,
        spec_audio = @specAudio,
        spec_format = @specFormat,
        volumn = @volumn,
        date_open = @dateOpen,
        date_close = @dateClose,
        div_state = @divState,
        prog_url = @progUrl
      WHERE prog_id = @progId
    `);

  const prevDivProg = prevRow.div_prog != null ? Number(prevRow.div_prog) : null;
  if (prevDivProg != null && prevDivProg !== input.divProg) {
    await pool
      .request()
      .input("progIdStr", sql.VarChar(20), String(progId))
      .query(`EXEC dbo.sp_calc_day1n @progIdStr`);
  }

  return { progId, titleKo: name, titleEn: name2 };
}
