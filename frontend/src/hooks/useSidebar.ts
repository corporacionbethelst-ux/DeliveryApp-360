'use client';

import { useState, useEffect } from 'react';

export function useSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Detectar móvil
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setIsCollapsed(true); // En móvil siempre empieza cerrado (offcanvas)
      } else {
        // En desktop, recuperar preferencia guardada
        const saved = localStorage.getItem('sidebar-collapsed');
        setIsCollapsed(saved === 'true');
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggle = () => {
    if (!isMobile) {
      const newState = !isCollapsed;
      setIsCollapsed(newState);
      localStorage.setItem('sidebar-collapsed', String(newState));
    } else {
      // En móvil, toggle abre/cierra el offcanvas
      setIsCollapsed(!isCollapsed);
    }
  };

  return { isCollapsed, isMobile, toggle, isMounted };
}