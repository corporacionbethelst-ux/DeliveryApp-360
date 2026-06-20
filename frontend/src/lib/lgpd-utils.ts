/**
 * LGPD (Lei Geral de Proteção de Dados) utilities for Delivery360
 * Handles data anonymization, consent management, and privacy compliance
 * Safe for SSR environments
 */

export interface ConsentRecord {
  userId: string;
  type: ConsentType;
  granted: boolean;
  timestamp: Date;
  version: string;
  ipAddress?: string;
  userAgent?: string;
}

export type ConsentType = 
  | 'location_tracking'
  | 'data_processing'
  | 'marketing'
  | 'analytics'
  | 'third_party_sharing'
  | 'push_notifications';

/**
 * Anonymize personal data for privacy compliance
 * Handles missing fields gracefully
 */
export function anonymizeData(data: Record<string, any>): Record<string, any> {
  const anonymized = { ...data };
  
  // Mask email
  if (anonymized.email && typeof anonymized.email === 'string') {
    const [username, domain] = anonymized.email.split('@');
    if (username && domain) {
      anonymized.email = `${username.substring(0, 2)}***@${domain}`;
    }
  }
  
  // Mask phone
  if (anonymized.phone) {
    const phone = String(anonymized.phone).replace(/\D/g, '');
    anonymized.phone = `***${phone.slice(-4)}`;
  }
  
  // Mask CPF/CNPJ
  if (anonymized.document) {
    const doc = String(anonymized.document).replace(/\D/g, '');
    anonymized.document = `***${doc.slice(-4)}`;
  }
  
  // Mask address (Safe access to nested properties)
  if (anonymized.address) {
    const street = anonymized.street ?? anonymized.address?.split(',')[0] ?? 'Rua';
    anonymized.address = `${street}, ***`;
  }
  
  // Remove sensitive fields
  delete anonymized.password;
  delete anonymized.creditCard;
  delete anonymized.bankAccount;
  
  return anonymized;
}

/**
 * Hash sensitive data for secure storage
 * Safe for SSR: Checks for crypto API availability
 */
export async function hashData(data: string): Promise<string> {
  if (typeof window === 'undefined' || !crypto?.subtle) {
    // Fallback para SSR o entornos sin crypto.subtle (no recomendado para producción real sin polyfill)
    console.warn('Crypto API not available, using fallback hash (less secure)');
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if consent is required for a specific data processing activity
 */
export function requiresConsent(activity: string): boolean {
  const activitiesRequiringConsent = [
    'location_tracking',
    'marketing_communications',
    'third_party_data_sharing',
    'profiling',
    'automated_decision_making',
  ];
  
  return activitiesRequiringConsent.some(a => activity.toLowerCase().includes(a));
}

/**
 * Validate consent record
 */
export function validateConsent(consent: ConsentRecord): boolean {
  if (!consent.userId || !consent.type || !consent.timestamp) {
    return false;
  }
  
  // Consent must be less than 2 years old for most types
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  
  if (new Date(consent.timestamp) < twoYearsAgo) {
    return false;
  }
  
  return true;
}

/**
 * Get consent status for a user
 */
export function getConsentStatus(
  consents: ConsentRecord[],
  type: ConsentType
): boolean {
  const latestConsent = consents
    .filter(c => c.type === type)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  
  return latestConsent?.granted ?? false;
}

/**
 * Create consent record
 */
export function createConsentRecord(
  userId: string,
  type: ConsentType,
  granted: boolean,
  options?: {
    ipAddress?: string;
    userAgent?: string;
    version?: string;
  }
): ConsentRecord {
  return {
    userId,
    type,
    granted,
    timestamp: new Date(),
    version: options?.version || '1.0',
    ipAddress: options?.ipAddress,
    userAgent: options?.userAgent,
  };
}

/**
 * Sanitize input to prevent XSS attacks
 * Safe for SSR: Uses string replacement if DOM is not available
 */
export function sanitizeInput(input: string): string {
  if (!input) return '';
  
  if (typeof window === 'undefined') {
    // Fallback seguro para SSR sin acceso al DOM
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const div = document.createElement('div');
  div.textContent = input;
  return div.innerHTML;
}

/**
 * Mask data for display purposes
 */
export function maskData(value: string, visibleChars: number = 4, maskChar: string = '*'): string {
  if (!value || value.length <= visibleChars) {
    return maskChar.repeat(value?.length || 0);
  }
  
  const visiblePart = value.slice(-visibleChars);
  const maskedPart = maskChar.repeat(value.length - visibleChars);
  
  return `${maskedPart}${visiblePart}`;
}

/**
 * Check if data can be processed based on LGPD legal basis
 */
export function canProcessData(
  purpose: string,
  legalBasis: 'consent' | 'contract' | 'legal_obligation' | 'legitimate_interest',
  hasConsent: boolean = false
): boolean {
  switch (legalBasis) {
    case 'consent':
      return hasConsent;
    case 'contract':
      return ['order_fulfillment', 'delivery_tracking', 'payment_processing'].includes(purpose);
    case 'legal_obligation':
      return ['tax_reporting', 'audit_trail', 'fraud_prevention'].includes(purpose);
    case 'legitimate_interest':
      return ['service_improvement', 'security_monitoring'].includes(purpose);
    default:
      return false;
  }
}

/**
 * Generate privacy report for a user
 */
export function generatePrivacyReport(userData: Record<string, any>): {
  dataCategories: string[];
  processingPurposes: string[];
  retentionPeriods: Record<string, string>;
  thirdPartySharing: boolean;
} {
  const report = {
    dataCategories: [] as string[],
    processingPurposes: [] as string[],
    retentionPeriods: {} as Record<string, string>,
    thirdPartySharing: false,
  };

  // Identify data categories
  if (userData.email || userData.phone) {
    report.dataCategories.push('contact_information');
  }
  if (userData.location || userData.coordinates || userData.last_lat) {
    report.dataCategories.push('location_data');
  }
  if (userData.orders || userData.deliveries) {
    report.dataCategories.push('transaction_history');
  }
  if (userData.deviceId || userData.userAgent) {
    report.dataCategories.push('device_information');
  }

  // Identify processing purposes
  report.processingPurposes = [
    'service_delivery',
    'order_tracking',
    'customer_support',
  ];

  // Set retention periods
  report.retentionPeriods = {
    contact_information: '5 years after last activity',
    location_data: '90 days',
    transaction_history: '5 years (legal requirement)',
    device_information: '1 year',
  };

  return report;
}

/**
 * Export user data in portable format (LGPD Article 18)
 */
export function exportUserData(userData: Record<string, any>): string {
  return JSON.stringify(userData, null, 2);
}

/**
 * Prepare data for deletion request
 */
export function prepareForDeletion(userId: string): {
  requestId: string;
  timestamp: Date;
  status: 'pending' | 'processing' | 'completed';
} {
  return {
    requestId: `DEL-${userId}-${Date.now()}`,
    timestamp: new Date(),
    status: 'pending',
  };
}

/**
 * Log data access for audit trail (LGPD Article 37)
 */
export function logDataAccess(
  userId: string,
  accessedBy: string,
  dataType: string,
  purpose: string
): {
  logId: string;
  timestamp: Date;
  userId: string;
  accessedBy: string;
  dataType: string;
  purpose: string;
} {
  return {
    logId: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    userId,
    accessedBy,
    dataType,
    purpose,
  };
}

/**
 * Validate age for data processing (requires parental consent for minors)
 */
export function validateAge(birthDate: Date): {
  isAdult: boolean;
  age: number;
  requiresParentalConsent: boolean;
} {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return {
    isAdult: age >= 18,
    age,
    requiresParentalConsent: age < 18,
  };
}

/**
 * Check if data processing is within scope of original consent
 */
export function isWithinConsentScope(
  originalPurpose: string,
  newPurpose: string
): boolean {
  const compatiblePurposes: Record<string, string[]> = {
    'order_delivery': ['delivery_tracking', 'customer_notification', 'route_optimization'],
    'payment_processing': ['refund_processing', 'billing_records'],
    'customer_support': ['issue_resolution', 'feedback_collection'],
  };
  
  const compatible = compatiblePurposes[originalPurpose] || [];
  return compatible.includes(newPurpose) || originalPurpose === newPurpose;
}