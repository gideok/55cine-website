import sql from "mssql";
import { getPool } from "../../db/pool.js";
import { normalizeDocumentPath, normalizeSiteLinkUrl } from "../../utils/site-settings-url.js";
import { finalizeDonationDocument } from "./site-document-assets.service.js";

export type SiteSettings = {
  membershipCmsUrl: string | null;
  membershipCmsLabel: string;
  donationDocLabel: string | null;
  donationDocPath: string | null;
  seatSponsorUrl: string | null;
  seatSponsorLabel: string;
  rentalFormUrl: string | null;
  rentalFormLabel: string;
  updatedAt: string;
};

type SettingsRow = {
  membership_cms_url: string | null;
  membership_cms_label: string;
  donation_doc_label: string | null;
  donation_doc_path: string | null;
  seat_sponsor_url: string | null;
  seat_sponsor_label: string;
  rental_form_url: string | null;
  rental_form_label: string;
  updated_at: unknown;
};

function formatTs(val: unknown): string {
  if (val == null) return "";
  const d = val instanceof Date ? val : new Date(String(val));
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toISOString();
}

function mapRow(row: SettingsRow): SiteSettings {
  return {
    membershipCmsUrl: row.membership_cms_url?.trim() || null,
    membershipCmsLabel: String(row.membership_cms_label || "CMS 링크").trim() || "CMS 링크",
    donationDocLabel: row.donation_doc_label?.trim() || null,
    donationDocPath: row.donation_doc_path?.trim() || null,
    seatSponsorUrl: row.seat_sponsor_url?.trim() || null,
    seatSponsorLabel: String(row.seat_sponsor_label || "후원하기").trim() || "후원하기",
    rentalFormUrl: row.rental_form_url?.trim() || null,
    rentalFormLabel: String(row.rental_form_label || "대관 신청서").trim() || "대관 신청서",
    updatedAt: formatTs(row.updated_at)
  };
}

async function ensureSettingsRow(pool: sql.ConnectionPool): Promise<void> {
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM dbo.web_site_settings WHERE id = 1)
    BEGIN
      INSERT INTO dbo.web_site_settings (id) VALUES (1);
    END
  `);
}

export async function getAdminSiteSettings(): Promise<SiteSettings> {
  const pool = await getPool();
  await ensureSettingsRow(pool);
  const res = await pool.request().query<SettingsRow>(`
    SELECT
      membership_cms_url,
      membership_cms_label,
      donation_doc_label,
      donation_doc_path,
      seat_sponsor_url,
      seat_sponsor_label,
      rental_form_url,
      rental_form_label,
      updated_at
    FROM dbo.web_site_settings
    WHERE id = 1
  `);
  const row = res.recordset[0];
  if (!row) {
    return {
      membershipCmsUrl: null,
      membershipCmsLabel: "CMS 링크",
      donationDocLabel: null,
      donationDocPath: null,
      seatSponsorUrl: null,
      seatSponsorLabel: "후원하기",
      rentalFormUrl: null,
      rentalFormLabel: "대관 신청서",
      updatedAt: ""
    };
  }
  return mapRow(row);
}

export type UpdateSiteSettingsInput = {
  membershipCmsUrl?: string | null;
  membershipCmsLabel?: string;
  donationDocLabel?: string | null;
  donationDocTempPath?: string | null;
  removeDonationDoc?: boolean;
  seatSponsorUrl?: string | null;
  seatSponsorLabel?: string;
  rentalFormUrl?: string | null;
  rentalFormLabel?: string;
};

export async function updateAdminSiteSettings(input: UpdateSiteSettingsInput): Promise<SiteSettings> {
  const pool = await getPool();
  await ensureSettingsRow(pool);

  const currentRes = await pool.request().query<SettingsRow>(`
    SELECT
      membership_cms_url,
      membership_cms_label,
      donation_doc_label,
      donation_doc_path,
      seat_sponsor_url,
      seat_sponsor_label,
      rental_form_url,
      rental_form_label,
      updated_at
    FROM dbo.web_site_settings
    WHERE id = 1
  `);
  const current = currentRes.recordset[0];

  const membershipCmsUrl =
    input.membershipCmsUrl !== undefined
      ? normalizeSiteLinkUrl(input.membershipCmsUrl)
      : current?.membership_cms_url?.trim() || null;
  const membershipCmsLabel =
    input.membershipCmsLabel !== undefined
      ? String(input.membershipCmsLabel || "CMS 링크").trim() || "CMS 링크"
      : String(current?.membership_cms_label || "CMS 링크").trim() || "CMS 링크";
  const donationDocLabel =
    input.donationDocLabel !== undefined
      ? input.donationDocLabel?.trim() || null
      : current?.donation_doc_label?.trim() || null;
  const seatSponsorUrl =
    input.seatSponsorUrl !== undefined
      ? normalizeSiteLinkUrl(input.seatSponsorUrl)
      : current?.seat_sponsor_url?.trim() || null;
  const seatSponsorLabel =
    input.seatSponsorLabel !== undefined
      ? String(input.seatSponsorLabel || "후원하기").trim() || "후원하기"
      : String(current?.seat_sponsor_label || "후원하기").trim() || "후원하기";
  const rentalFormUrl =
    input.rentalFormUrl !== undefined
      ? normalizeSiteLinkUrl(input.rentalFormUrl)
      : current?.rental_form_url?.trim() || null;
  const rentalFormLabel =
    input.rentalFormLabel !== undefined
      ? String(input.rentalFormLabel || "대관 신청서").trim() || "대관 신청서"
      : String(current?.rental_form_label || "대관 신청서").trim() || "대관 신청서";

  const donationDocPath = await finalizeDonationDocument({
    donationDocTempPath: input.donationDocTempPath,
    removeDonationDoc: input.removeDonationDoc,
    existingPath: current?.donation_doc_path
  });
  const safeDonationDocPath = normalizeDocumentPath(donationDocPath);

  await pool
    .request()
    .input("membershipCmsUrl", sql.NVarChar(500), membershipCmsUrl)
    .input("membershipCmsLabel", sql.NVarChar(100), membershipCmsLabel)
    .input("donationDocLabel", sql.NVarChar(200), donationDocLabel)
    .input("donationDocPath", sql.NVarChar(500), safeDonationDocPath)
    .input("seatSponsorUrl", sql.NVarChar(500), seatSponsorUrl)
    .input("seatSponsorLabel", sql.NVarChar(100), seatSponsorLabel)
    .input("rentalFormUrl", sql.NVarChar(500), rentalFormUrl)
    .input("rentalFormLabel", sql.NVarChar(100), rentalFormLabel)
    .query(`
      UPDATE dbo.web_site_settings
      SET
        membership_cms_url = @membershipCmsUrl,
        membership_cms_label = @membershipCmsLabel,
        donation_doc_label = @donationDocLabel,
        donation_doc_path = @donationDocPath,
        seat_sponsor_url = @seatSponsorUrl,
        seat_sponsor_label = @seatSponsorLabel,
        rental_form_url = @rentalFormUrl,
        rental_form_label = @rentalFormLabel,
        updated_at = SYSUTCDATETIME()
      WHERE id = 1
    `);

  return getAdminSiteSettings();
}
