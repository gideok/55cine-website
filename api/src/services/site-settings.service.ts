import { getAdminSiteSettings, type SiteSettings } from "./admin/site-settings-admin.service.js";

export type PublicSiteSettings = Pick<
  SiteSettings,
  | "membershipCmsUrl"
  | "membershipCmsLabel"
  | "donationDocLabel"
  | "donationDocPath"
  | "seatSponsorUrl"
  | "seatSponsorLabel"
  | "rentalFormUrl"
  | "rentalFormLabel"
>;

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  const settings = await getAdminSiteSettings();
  return {
    membershipCmsUrl: settings.membershipCmsUrl,
    membershipCmsLabel: settings.membershipCmsLabel,
    donationDocLabel: settings.donationDocLabel,
    donationDocPath: settings.donationDocPath,
    seatSponsorUrl: settings.seatSponsorUrl,
    seatSponsorLabel: settings.seatSponsorLabel,
    rentalFormUrl: settings.rentalFormUrl,
    rentalFormLabel: settings.rentalFormLabel
  };
}
