'use client';
import clsx from 'clsx';
import { useState, useEffect, useMemo } from 'react';
import usePreferencesStore from '@/features/Preferences/store/usePreferencesStore';
import useCrazyModeStore from '@/features/CrazyMode/store/useCrazyModeStore';
import { usePathname } from 'next/navigation';
import { ScrollRestoration } from 'next-scroll-restoration';
import WelcomeModal from '@/shared/components/Modals/WelcomeModal';
import { AchievementNotificationContainer } from '@/shared/components/achievements/AchievementNotification';
import AchievementIntegration from '@/shared/components/achievements/AchievementIntegration';
import { applyTheme } from '@/features/Preferences/data/themes';
import BackToTop from '@/shared/components/navigation/BackToTop';
import MobileBottomBar from '@/shared/components/layout/BottomBar';
import { useVisitTracker } from '@/features/Progress/hooks/useVisitTracker';
import { getGlobalAdaptiveSelector } from '@/shared/lib/adaptiveSelection';

// Statically import the default font
import { Zen_Maru_Gothic } from 'next/font/google';

const defaultFont = Zen_Maru_Gothic({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'sans-serif']
});

// Define a type for the font object for clarity, adjust as needed
type FontObject = {
  name: string;
  font: {
    className: string;
  };
};

// Module-level cache for fonts (persists across component remounts)
let fontsCache: FontObject[] | null = null;
let fontsLoadingPromise: Promise<FontObject[]> | null = null;

const loadFontsModule = async (): Promise<FontObject[]> => {
  if (fontsCache) return fontsCache;
  if (fontsLoadingPromise) return fontsLoadingPromise;

  fontsLoadingPromise = import('@/features/Preferences/data/fonts').then(
    module => {
      fontsCache = module.default;
      fontsLoadingPromise = null;
      return module.default;
    }
  );

  return fontsLoadingPromise;
};

export default function ClientLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { theme } = usePreferencesStore();
  const font = usePreferencesStore(state => state.font);

  // Crazy Mode Integration
  const isCrazyMode = useCrazyModeStore(state => state.isCrazyMode);
  const activeThemeId = useCrazyModeStore(state => state.activeThemeId);
  const activeFontName = useCrazyModeStore(state => state.activeFontName);
  const randomize = useCrazyModeStore(state => state.randomize);

  // Determine effective theme and font
  const effectiveTheme = isCrazyMode && activeThemeId ? activeThemeId : theme;
  const effectiveFont = isCrazyMode && activeFontName ? activeFontName : font;

  // 3. Create state to hold the fonts module
  const [fontsModule, setFontsModule] = useState<FontObject[] | null>(null);

  // Use useMemo to instantly calculate the font class name
  const fontClassName = useMemo(() => {
    // If the full module is loaded and the user selected a font from that list, use it
    if (fontsModule) {
      const selected = fontsModule.find(
        (fontObj: FontObject) => effectiveFont === fontObj.name
      );
      if (selected) return selected.font.className;
    }

    // On the first render, or if the user's preferred font is the default one,
    // use the class name from the statically imported default font
    return defaultFont.className;
  }, [fontsModule, effectiveFont]);

  useEffect(() => {
    applyTheme(effectiveTheme);

    if (typeof window !== 'undefined') {
      window.history.scrollRestoration = 'manual';
    }
  }, [effectiveTheme]);

  // Trigger randomization on page navigation
  const pathname = usePathname();
  useEffect(() => {
    if (isCrazyMode) {
      randomize();
    }
  }, [pathname, isCrazyMode, randomize]);

  // Load fonts using cached loader - only in production
  useEffect(() => {
    let isMounted = true;

    const initFonts = async () => {
      try {
        const fonts = await loadFontsModule();
        if (isMounted) {
          setFontsModule(fonts);
        }
      } catch (err) {
        console.error('Failed to dynamically load fonts:', err);
      }
    };

    void initFonts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const selector = getGlobalAdaptiveSelector();
      selector.ensureLoaded().catch(console.error);
    }
  }, []);

  // Track user visits for streak feature
  useVisitTracker();

  useEffect(() => {
    // Resume AudioContext on first user interaction
    const handleClick = () => {
      // @ts-expect-error (use-sound exposes Howler globally)
      if (window.Howler?.ctx?.state === 'suspended') {
        // @ts-expect-error (use-sound exposes Howler globally)
        window.Howler.ctx.resume();
      }
    };

    document.addEventListener('click', handleClick, { once: true });
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <div
      data-scroll-restoration-id='container'
      className={clsx(
        'bg-[var(--background-color)] text-[var(--main-color)] min-h-[100dvh] max-w-[100dvw]',
        fontClassName
      )}
      style={{
        height: '100dvh',
        overflowY: 'auto'
      }}
    >
      {children}
      <ScrollRestoration />
      <WelcomeModal />
      <AchievementNotificationContainer />
      <AchievementIntegration />
      <BackToTop />
      <MobileBottomBar />
    </div>
  );
}
