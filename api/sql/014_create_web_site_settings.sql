-- 사이트 링크·문서 설정 (단일 행)
IF NOT EXISTS (
  SELECT 1 FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE s.name = N'dbo' AND t.name = N'web_site_settings'
)
BEGIN
  CREATE TABLE dbo.web_site_settings (
    id TINYINT NOT NULL
      CONSTRAINT PK_web_site_settings PRIMARY KEY
      CONSTRAINT DF_web_site_settings_id DEFAULT (1),
    membership_cms_url NVARCHAR(500) NULL,
    membership_cms_label NVARCHAR(100) NOT NULL
      CONSTRAINT DF_web_site_settings_cms_label DEFAULT (N'CMS 링크'),
    donation_doc_label NVARCHAR(200) NULL,
    donation_doc_path NVARCHAR(500) NULL,
    seat_sponsor_url NVARCHAR(500) NULL,
    seat_sponsor_label NVARCHAR(100) NOT NULL
      CONSTRAINT DF_web_site_settings_seat_label DEFAULT (N'후원하기'),
    rental_form_url NVARCHAR(500) NULL,
    rental_form_label NVARCHAR(100) NOT NULL
      CONSTRAINT DF_web_site_settings_rental_label DEFAULT (N'대관 신청서'),
    updated_at DATETIME2(0) NOT NULL
      CONSTRAINT DF_web_site_settings_updated DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_web_site_settings_singleton CHECK (id = 1)
  );

  INSERT INTO dbo.web_site_settings (
    id,
    membership_cms_url,
    membership_cms_label,
    donation_doc_label,
    donation_doc_path,
    seat_sponsor_label,
    rental_form_label
  )
  VALUES (
    1,
    N'https://www.ihappynanum.com/Nanum/nanum/banner/bridge/DG782YKOAT.nanum?memPayType=null&loginOrga=null&orgaId=null&lang=null',
    N'CMS 링크',
    N'2025년 기부금 모금액 및 활용실적명세서',
    N'documents/2025-donation-disclosure.pdf',
    N'후원하기',
    N'대관 신청서'
  );
END
GO
