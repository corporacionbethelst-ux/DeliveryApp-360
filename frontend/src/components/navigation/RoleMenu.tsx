'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@/types/user';
import { NAVIGATION_CONFIG, NavItem } from '@/config/navigation.config';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface RoleMenuProps {
  userRole: UserRole;
  isOpen: boolean;
  isCollapsed?: boolean; // NUEVA PROP
}

// Componente recursivo para renderizar items y submenús
function MenuItem({ 
  item, 
  userRole, 
  depth = 0, 
  isCollapsed = false 
}: { 
  item: NavItem; 
  userRole: UserRole; 
  depth?: number;
  isCollapsed?: boolean;
}) {
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!item.roles.includes(userRole)) return null;

  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const hasChildren = item.children && item.children.length > 0;
  const visibleChildren = item.children?.filter(child => child.roles.includes(userRole));

  // Si está colapsado y hay hijos, al hacer click expandimos (si es posible visualmente)
  // O navegamos directamente si no hay espacio para submenús
  const handleClick = (e: React.MouseEvent) => {
    if (hasChildren) {
      e.preventDefault();
      if (!isCollapsed) {
        setIsExpanded(!isExpanded);
      } else {
        // Opcional: En modo colapsado, podríamos forzar la navegación al padre
        // o simplemente no hacer nada si no hay espacio para submenús
      }
    }
  };

  return (
    <div className="mb-1 group">
      <Link
        href={item.href}
        onClick={handleClick}
        title={isCollapsed ? item.label : ''} // Tooltip si está colapsado
        className={`
          flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200
          ${isActive && !hasChildren
            ? 'bg-blue-600 text-white shadow-md' 
            : 'text-slate-300 hover:bg-slate-800 hover:text-white'}
          ${isCollapsed ? 'justify-center px-2' : ''}
        `}
      >
        <div className={`flex items-center ${isCollapsed ? 'justify-center w-full' : 'gap-3'}`}>
          <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
          
          {!isCollapsed && (
            <span className="whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>
          )}
        </div>
        
        {!isCollapsed && hasChildren && (
          <button className="p-1 rounded hover:bg-slate-700 text-slate-400">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}
      </Link>

      {/* Submenú: Solo se muestra si NO está colapsado y está expandido */}
      {!isCollapsed && hasChildren && isExpanded && visibleChildren && (
        <div className="mt-1 ml-4 pl-4 border-l border-slate-700 space-y-1">
          {visibleChildren.map((child) => (
            <MenuItem 
              key={child.href} 
              item={child} 
              userRole={userRole} 
              depth={depth + 1} 
              isCollapsed={false} 
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function RoleMenu({ userRole, isOpen, isCollapsed = false }: RoleMenuProps) {
  if (!isOpen) return null;

  return (
    <nav className={`mt-6 px-2 space-y-2 overflow-y-auto max-h-[calc(100vh-80px)] custom-scrollbar ${isCollapsed ? 'text-center' : ''}`}>
      {NAVIGATION_CONFIG.map((item) => (
        <MenuItem 
          key={item.href} 
          item={item} 
          userRole={userRole} 
          isCollapsed={isCollapsed}
        />
      ))}
      
      {!isCollapsed && (
        <div className="mt-8 pt-4 border-t border-slate-800 px-3">
          <p className="text-xs text-slate-500">
            Conectado como <span className="text-slate-300 font-semibold">{userRole}</span>
          </p>
        </div>
      )}
    </nav>
  );
}