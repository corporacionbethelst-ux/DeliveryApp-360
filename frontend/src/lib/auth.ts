/**
 * Authentication utilities for Delivery360
 * Handles token management, session validation, and auth state
 * NOTE: This file contains pure utility functions, NOT state management.
 */

import { AuthTokens, User } from '@/types';

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

const TOKEN_KEY = 'delivery360_auth_tokens';
const REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiration

/**
 * Save auth tokens to localStorage
 */
export function saveTokens(tokens: AuthTokens): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  } catch (error) {
    console.error('Error saving tokens:', error);
  }
}

/**
 * Get auth tokens from localStorage
 */
export function getTokens(): AuthTokens | null {
  if (typeof window === 'undefined') return null;
  try {
    const tokensStr = localStorage.getItem(TOKEN_KEY);
    if (!tokensStr) return null;
    return JSON.parse(tokensStr);
  } catch (error) {
    console.error('Error getting tokens:', error);
    return null;
  }
}

/**
 * Clear auth tokens from localStorage
 */
export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error clearing tokens:', error);
  }
}

/**
 * Decode JWT token (base64 decoding, not cryptographic verification)
 * Safe for SSR environments
 */
export function decodeToken(token: string): TokenPayload | null {
  if (typeof window === 'undefined') {
    // Implementación segura para SSR (Node.js) si es necesario
    // Por ahora retornamos null en SSR para evitar errores de atob
    return null; 
  }
  
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return true;
  
  const now = Date.now() / 1000;
  return payload.exp < now;
}

/**
 * Check if token needs refresh (within threshold)
 */
export function needsRefresh(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return true;
  
  const expirationTime = payload.exp * 1000;
  const now = Date.now();
  const timeUntilExpiration = expirationTime - now;
  
  return timeUntilExpiration < REFRESH_THRESHOLD_MS;
}

/**
 * Validate token structure and expiration
 */
export function validateToken(token: string): boolean {
  if (!token || token.split('.').length !== 3) return false;
  return !isTokenExpired(token);
}

/**
 * Validate complete auth state
 */
export function validateAuthState(tokens: AuthTokens | null): boolean {
  if (!tokens) return false;
  
  const { access_token, refresh_token } = tokens;
  
  // Both tokens must be present
  if (!access_token || !refresh_token) return false;
  
  // Access token must be valid
  if (!validateToken(access_token)) return false;
  
  return true;
}

/**
 * Get user info from access token
 */
export function getUserFromToken(token: string): Partial<User> | null {
  const payload = decodeToken(token);
  if (!payload) return null;
  
  return {
    id: payload.userId,
    email: payload.email,
    role: payload.role as User['role'],
  };
}

/**
 * Check if user has required role
 * Hierarchy: REPARTIDOR < OPERADOR < GERENTE < SUPERADMIN
 */
export function hasRole(user: User | null, requiredRole: string): boolean {
  if (!user) return false;
  
  const roleHierarchy: Record<string, number> = {
    REPARTIDOR: 1,
    OPERADOR: 2,
    GERENTE: 3,
    SUPERADMIN: 4,
  };
  
  const userRoleLevel = roleHierarchy[user.role] || 0;
  const requiredRoleLevel = roleHierarchy[requiredRole] || 0;
  
  return userRoleLevel >= requiredRoleLevel;
}

/**
 * Check if user has any of the required roles
 */
export function hasAnyRole(user: User | null, roles: string[]): boolean {
  return roles.some(role => hasRole(user, role));
}

/**
 * Format token expiration time
 */
export function getTokenExpiration(token: string): Date | null {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return null;
  return new Date(payload.exp * 1000);
}

/**
 * Get time until token expiration in milliseconds
 */
export function getTimeUntilExpiration(token: string): number {
  const expiration = getTokenExpiration(token);
  if (!expiration) return 0;
  return expiration.getTime() - Date.now();
}

/**
 * Create authorization header
 */
export function createAuthHeader(token: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Check if password meets requirements
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Debe contener al menos una letra mayúscula');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Debe contener al menos una letra minúscula');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Debe contener al menos un número');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Debe contener al menos un carácter especial');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Generate secure random string for CSRF tokens or temporary IDs
 * Safe for browser environment
 */
export function generateSecureToken(length: number = 32): string {
  if (typeof window === 'undefined' || !crypto.getRandomValues) {
    // Fallback para SSR si es necesario (menos seguro)
    return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
  }
  
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash password before sending to backend (additional security layer)
 * Note: Always use HTTPS. This is an extra layer, not a replacement for TLS.
 */
export async function hashPassword(password: string): Promise<string> {
  if (typeof window === 'undefined' || !crypto.subtle) {
     // Fallback o error en SSR
     throw new Error('Crypto API not available');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if session is active based on localStorage tokens
 */
export function isSessionActive(): boolean {
  const tokens = getTokens();
  return validateAuthState(tokens);
}

/**
 * Get current authenticated user from localStorage
 * WARNING: For reactive UI, use useAuthStore() instead. 
 * This is for non-reactive checks.
 */
export function getCurrentUser(): User | null {
  const tokens = getTokens();
  if (!tokens || !validateAuthState(tokens)) return null;
  
  return getUserFromToken(tokens.access_token) as User;
}

/**
 * Logout and clear all auth data
 * Triggers a custom event for global listeners
 */
export function logout(): void {
  clearTokens();
  if (typeof window !== 'undefined') {
    sessionStorage.clear();
    // Dispatch custom event for logout handling across tabs/components
    window.dispatchEvent(new CustomEvent('auth-logout'));
  }
}

/**
 * Setup auth event listeners
 * Useful for syncing logout across components or tabs
 */
export function setupAuthListeners(callbacks: {
  onLogout?: () => void;
  onTokenRefresh?: (newTokens: AuthTokens) => void;
}): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleLogout = () => {
    callbacks.onLogout?.();
  };
  
  window.addEventListener('auth-logout', handleLogout);
  
  return () => {
    window.removeEventListener('auth-logout', handleLogout);
  };
}

/**
 * Check if email format is valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Sanitize user input for auth forms
 * Prevents basic XSS via angle brackets
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  return input.trim().replace(/[<>]/g, '');
}