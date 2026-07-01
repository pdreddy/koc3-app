export interface Announcement {
  id: string;
  title: string;
  body: string;
  publishedAt: number;
  createdBy: string;
}

export interface Sponsor {
  id: string;
  name: string;
  logoUrl: string;
  website: string | null;
  tier: 'TITLE' | 'GOLD' | 'SILVER' | 'BRONZE' | 'PARTNER';
  createdAt: number;
}

export interface GalleryImage {
  id: string;
  url: string;
  caption: string | null;
  uploadedAt: number;
  uploadedBy: string;
}
