export interface SoftDeleteMetadata {
  deletedAt?: string;
  deletedBy?: string;
  deletedByName?: string;
  previousStatus?: string;
  deleteReason?: string;
}

export interface NewsItem extends SoftDeleteMetadata {
  id: string;
  headline: string;
  subtitle?: string;
  slug: string;
  summary: string;
  content: string; // Rich text content
  imageUrl: string;
  imageCaption?: string;
  publishedAt: string;
  category: string;
  language: 'Kinyarwanda'| 'English';
  status: 'published'| 'draft'| 'scheduled'| 'deleted';
  author: string;
  authorId?: string;
  authorAvatar?: string;
  featured: boolean;
  views: number;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
}

export interface Opportunity extends SoftDeleteMetadata {
  id: string;
  title: string;
  slug: string;
  organization: string;
  organizationLogo?: string;
  coverImageUrl?: string;
  galleryImages?: string[];
  location: string;
  deadline: string;
  category: 'Jobs'| 'Scholarships'| 'Tenders'| 'Others';
  subCategory?: string; // e.g., 'Government', 'NGO', 'Undergraduate'
  type: string; // e.g., 'Full-time', 'Contract'
  salary?: string;
  description: string; // Rich text
  responsibilities?: string; // Rich text
  qualifications?: string; // Rich text
  requirements?: string; // Rich text
  benefits?: string; // Rich text
  applicationInstructions?: string; // Rich text
  applyUrl: string;
  status: 'active'| 'draft'| 'expired'| 'deleted';
  views: number;
  clicks: number;
  createdAt: string;
  featured: boolean;
  authorId?: string;

  // Specific to Scholarships
  institution?: string;
  country?: string;
  scholarshipType?: string;
  requiredDocuments?: string;

  // Specific to Tenders
  tenderRef?: string;
  issuingOrg?: string;
  submissionInstructions?: string;
  downloadUrl?: string;
  contactInfo?: string;
}

export interface WebPage extends SoftDeleteMetadata {
  id: string;
  title: string;
  slug: string;
  content: string;
  imageUrl?: string;
  status: 'published'| 'draft'| 'deleted';
  lastUpdated: string;
  seoTitle?: string;
  seoDescription?: string;
  isSystem?: boolean;
}

export interface CategoryItem extends SoftDeleteMetadata {
  id: string;
  name: string;
  slug: string;
  module: 'News'| 'Jobs'| 'Scholarships'| 'Tenders'| 'Others';
  parentCategory?: string;
  description?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  status: 'active'| 'deleted';
  createdAt: string;
}

export interface MediaItem {
  id: string;
  url: string;
  thumbnailUrl?: string;
  assetId?: string;
  name: string;
  mediaType?: 'image'| 'video'| 'pdf'| 'document';
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  uploadedBy?: string;
  uploadedByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  role: 'super_admin'| 'admin'| 'editor'| 'content_manager'| 'user';
  status: 'active'| 'suspended';
  canDelete?: boolean;
  assignedModules?: string[];
}

export interface Subscriber {
  id: string;
  email: string;
  subscribedAt: string;
  status: 'active'| 'unsubscribed';
}

export interface SavedReport {
  id: string;
  title: string;
  dateRange: string;
  startDate?: string;
  endDate?: string;
  format: 'snapshot'| 'pdf'| 'xlsx';
  totalViews?: number;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
}

export interface AnalyticsEvent {
  id: string;
  type: string;
  path: string;
  targetId?: string;
  category?: string;
  timestamp: string;
  metadata?: any;
}

export interface ActivityLog {
  id: string;
  adminId: string;
  adminName?: string;
  action: string;
  module: string;
  targetId?: string | null;
  recordType?: string;
  recordTitle?: string;
  deletionType?: string;
  reason?: string;
  details?: string;
  timestamp: string;
}

export interface HeroSlide {
  id?: string;
  category: string;
  title: string;
  description: string;
  buttonText: string;
  image: string;
  link: string;
  secondaryButtonText?: string;
  secondaryLink?: string;
  status?: 'published'| 'draft';
  order?: number;
  publishedAt?: string;
  featuredType?: 'news'| 'opportunity'| 'custom';
  featuredId?: string;
}

export type HomepageSectionId =
  | 'featured'| 'search'| 'news'| 'jobs'| 'scholarships'| 'tenders'| 'others'| 'promos'| 'cta';

export interface HomepageSectionConfig {
  id: HomepageSectionId;
  enabled: boolean;
  title: string;
  description: string;
  limit: number;
  order: number;
  featuredCategories?: string[];
}

export interface PromoBannerItem {
  title: string;
  description: string;
  buttonText: string;
  link: string;
  image: string;
}

export interface HomepageConfig {
  sections: HomepageSectionConfig[];
  featuredNewsIds?: string[];
  featuredOpportunityIds?: string[];
  promoBanners?: {
    education: PromoBannerItem;
    tenders: PromoBannerItem;
    cta: PromoBannerItem;
  };
}

