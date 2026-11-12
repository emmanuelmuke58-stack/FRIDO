export interface NewsItem {
  id: string;
  headline: string;
  subtitle?: string;
  slug: string;
  summary: string;
  content: string; // Rich text content
  imageUrl: string;
  imageCaption?: string;
  publishedAt: string;
  category: 'News' | 'Economy' | 'Infrastructure' | 'Updates' | 'Business' | 'Technology' | 'International';
  language: 'Kinyarwanda' | 'English';
  status: 'published' | 'draft' | 'scheduled';
  author: string;
  featured: boolean;
  views: number;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
}

export interface Opportunity {
  id: string;
  title: string;
  slug: string;
  organization: string;
  organizationLogo?: string;
  location: string;
  deadline: string;
  category: 'Jobs' | 'Scholarships' | 'Tenders' | 'Others';
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
  status: 'active' | 'draft' | 'expired';
  views: number;
  clicks: number;
  createdAt: string;
  featured: boolean;
  
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

export interface WebPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  status: 'published' | 'draft';
  lastUpdated: string;
  seoTitle?: string;
  seoDescription?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'super_admin' | 'admin' | 'editor' | 'content_manager' | 'user';
  status: 'active' | 'suspended';
}

export interface Subscriber {
  id: string;
  email: string;
  subscribedAt: string;
  status: 'active' | 'unsubscribed';
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
