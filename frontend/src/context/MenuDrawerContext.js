import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const MenuDrawerContext = createContext(null);

export function MenuDrawerProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  const openMenu = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    setIsOpen((current) => !current);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      openMenu,
      closeMenu,
      toggleMenu,
    }),
    [closeMenu, isOpen, openMenu, toggleMenu]
  );

  return <MenuDrawerContext.Provider value={value}>{children}</MenuDrawerContext.Provider>;
}

export function useMenuDrawer() {
  const context = useContext(MenuDrawerContext);
  if (!context) {
    throw new Error('useMenuDrawer must be used within MenuDrawerProvider');
  }
  return context;
}
