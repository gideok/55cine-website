import sql from "mssql";
import { getPool } from "../../db/pool.js";

export type WorkScheduleDayEntry = {
  workdate: string;
  inMonth: boolean;
  emp1Name: string | null;
  emp2Name: string | null;
  emp1_2Name: string | null;
  emp2_2Name: string | null;
  divMeeting: boolean;
  remark1: string | null;
  remark2: string | null;
  remark3: string | null;
  patternId: number | null;
  patternSeq: number | null;
};

export type WorkScheduleMonthResult = {
  year: number;
  month: number;
  days: WorkScheduleDayEntry[];
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function buildCalendarDates(year: number, month: number): { workdate: string; inMonth: boolean }[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const startOffset = firstOfMonth.getDay();
  const calStart = new Date(year, month - 1, 1 - startOffset);
  const out: { workdate: string; inMonth: boolean }[] = [];

  for (let i = 0; i < 42; i++) {
    const d = new Date(calStart.getFullYear(), calStart.getMonth(), calStart.getDate() + i);
    out.push({
      workdate: formatLocalDate(d),
      inMonth: d.getMonth() === month - 1
    });
  }

  return out;
}

type ScheduleRow = {
  workdate: string;
  emp1Name: string | null;
  emp2Name: string | null;
  emp1_2Name: string | null;
  emp2_2Name: string | null;
  divMeeting: boolean | number | null;
  remark1: string | null;
  remark2: string | null;
  remark3: string | null;
  patternId: number | null;
  patternSeq: number | null;
};

function trimOrNull(v: string | null | undefined): string | null {
  const s = String(v ?? "").trim();
  return s || null;
}

function asBool(v: boolean | number | null | undefined): boolean {
  return v === true || v === 1;
}

export async function getWorkScheduleMonth(
  year: number,
  month: number
): Promise<WorkScheduleMonthResult> {
  const calendarDays = buildCalendarDates(year, month);
  const from = calendarDays[0]?.workdate;
  const to = calendarDays[calendarDays.length - 1]?.workdate;

  const pool = await getPool();
  const result = await pool
    .request()
    .input("from", sql.Char(10), from)
    .input("to", sql.Char(10), to)
    .query<ScheduleRow>(`
      SELECT
        RTRIM(A.workdate) AS workdate,
        AM.name AS emp1Name,
        PM.name AS emp2Name,
        AM2.name AS emp1_2Name,
        PM2.name AS emp2_2Name,
        A.div_meeting AS divMeeting,
        A.remark1,
        A.remark2,
        A.remark3,
        A.patternid AS patternId,
        A.patternseq AS patternSeq
      FROM dbo.work_schedule A
      LEFT JOIN dbo.user_emp AM ON A.emp1 = AM.id
      LEFT JOIN dbo.user_emp PM ON A.emp2 = PM.id
      LEFT JOIN dbo.user_emp AM2 ON A.emp1_2 = AM2.id
      LEFT JOIN dbo.user_emp PM2 ON A.emp2_2 = PM2.id
      WHERE RTRIM(A.workdate) >= @from
        AND RTRIM(A.workdate) <= @to
    `);

  const byDate = new Map<string, ScheduleRow>();
  for (const row of result.recordset) {
    byDate.set(String(row.workdate).trim(), row);
  }

  const days: WorkScheduleDayEntry[] = calendarDays.map(({ workdate, inMonth }) => {
    const row = byDate.get(workdate);
    if (!row) {
      return {
        workdate,
        inMonth,
        emp1Name: null,
        emp2Name: null,
        emp1_2Name: null,
        emp2_2Name: null,
        divMeeting: false,
        remark1: null,
        remark2: null,
        remark3: null,
        patternId: null,
        patternSeq: null
      };
    }

    return {
      workdate,
      inMonth,
      emp1Name: trimOrNull(row.emp1Name),
      emp2Name: trimOrNull(row.emp2Name),
      emp1_2Name: trimOrNull(row.emp1_2Name),
      emp2_2Name: trimOrNull(row.emp2_2Name),
      divMeeting: asBool(row.divMeeting),
      remark1: trimOrNull(row.remark1),
      remark2: trimOrNull(row.remark2),
      remark3: trimOrNull(row.remark3),
      patternId: row.patternId ?? null,
      patternSeq: row.patternSeq ?? null
    };
  });

  return { year, month, days };
}
