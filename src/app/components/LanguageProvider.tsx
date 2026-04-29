"use client";

import React, { createContext, useContext } from "react";
import type { AppLanguage } from "@/lib/i18n";

const LanguageContext = createContext<AppLanguage>("fr");

export function LanguageProvider({
  language,
  children,
}: {
  language: AppLanguage;
  children: React.ReactNode;
}) {
  return (
    <LanguageContext.Provider value={language}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): AppLanguage {
  return useContext(LanguageContext);
}
