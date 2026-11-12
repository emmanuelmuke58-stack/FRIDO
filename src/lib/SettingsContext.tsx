import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface WebsiteSettings {
  websiteName: string;
  logoUrl: string;
  faviconUrl: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  socialLinks: {
    facebook: string;
    twitter: string;
    linkedin: string;
    youtube: string;
  };
  seo: {
    defaultTitle: string;
    defaultDescription: string;
  };
  heroSlides: {
    category: string;
    title: string;
    description: string;
    buttonText: string;
    image: string;
    link: string;
  }[];
}

const DEFAULT_SETTINGS: WebsiteSettings = {
  websiteName: "Rwanda Opportunities",
  logoUrl: "/src/assets/images/rwanda_opportunities_logo_graphic_1794481093301.jpg",
  faviconUrl: "",
  contactEmail: "info@rwandaopportunities.com",
  contactPhone: "+250 788 000 000",
  address: "Kigali, Rwanda",
  socialLinks: {
    facebook: "https://facebook.com",
    twitter: "https://twitter.com",
    linkedin: "https://linkedin.com",
    youtube: "https://youtube.com"
  },
  seo: {
    defaultTitle: "Rwanda Opportunities - Find Your Next Big Step",
    defaultDescription: "Your trusted source for the latest news and opportunities in Rwanda and beyond."
  },
  heroSlides: [
    {
      category: 'Rwanda News (Kinyarwanda)',
      title: "U Rwanda rukomeje kwagura ubukungu n'ishoramari",
      description: "Leta y'u Rwanda yemeje ingamba nshya zo kongera ishoramari, guteza imbere ibikorwa remezo n'imirimo ishyigikira iterambere ry'igihugu.",
      buttonText: 'Soma amakuru',
      image: '/src/assets/images/kigali_panorama_hero_1794481092206.jpg',
      link: '/news'
    },
    {
      category: 'Latest Opportunities',
      title: "Accelerate Your Future in Rwanda",
      description: "Connect with the latest job vacancies, scholarships, and tenders across the land of a thousand hills.",
      buttonText: 'View Opportunities',
      image: '/src/assets/images/rwanda_infrastructure_1794481092287.jpg',
      link: '/opportunities'
    }
  ]
};

const SettingsContext = createContext<{
  settings: WebsiteSettings;
  updateSettings: (newSettings: WebsiteSettings) => Promise<void>;
  loading: boolean;
}>({
  settings: DEFAULT_SETTINGS,
  updateSettings: async () => {},
  loading: true
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<WebsiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...snap.data() } as WebsiteSettings);
      } else {
        // Initialize settings if they don't exist
        setDoc(doc(db, 'settings', 'global'), DEFAULT_SETTINGS);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const updateSettings = async (newSettings: WebsiteSettings) => {
    await setDoc(doc(db, 'settings', 'global'), newSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
      {!loading && children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
