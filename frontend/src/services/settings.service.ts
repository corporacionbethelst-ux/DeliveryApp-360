import { api } from '@/lib/api';

export interface PlatformSettings {
  delivery_fee_base: number;
  commission_percentage: number;
  min_order_amount: number;
  active_zones: string[];
  support_email: string;
  maintenance_mode: boolean;
  updated_at?: string | null;
  updated_by_user_id?: string | null;
}

export type PlatformSettingsUpdate = Partial<Omit<PlatformSettings, 'updated_at' | 'updated_by_user_id'>>;

const normalizeSettings = (settings: PlatformSettings): PlatformSettings => ({
  ...settings,
  delivery_fee_base: Number(settings.delivery_fee_base ?? 0),
  commission_percentage: Number(settings.commission_percentage ?? 0),
  min_order_amount: Number(settings.min_order_amount ?? 0),
  active_zones: Array.isArray(settings.active_zones) ? settings.active_zones : [],
  support_email: settings.support_email || 'soporte@delivery.com',
  maintenance_mode: Boolean(settings.maintenance_mode),
});

const validateSettings = (settings: PlatformSettingsUpdate): void => {
  if (settings.commission_percentage !== undefined && (settings.commission_percentage < 0 || settings.commission_percentage > 100)) {
    throw new Error('La comisión debe estar entre 0 y 100');
  }
  if (settings.delivery_fee_base !== undefined && settings.delivery_fee_base < 0) {
    throw new Error('La tarifa base no puede ser negativa');
  }
  if (settings.min_order_amount !== undefined && settings.min_order_amount < 0) {
    throw new Error('El pedido mínimo no puede ser negativo');
  }
  if (settings.active_zones !== undefined && settings.active_zones.filter(Boolean).length === 0) {
    throw new Error('Debe existir al menos una zona activa');
  }
  if (settings.support_email !== undefined && !/\S+@\S+\.\S+/.test(settings.support_email)) {
    throw new Error('El correo de soporte no es válido');
  }
};

export const settingsService = {
  /** Obtener configuración global persistida de la plataforma. */
  getSettings: async (): Promise<PlatformSettings> => {
    try {
      return normalizeSettings(await api.get<PlatformSettings>('/settings'));
    } catch (error) {
      console.error('[SettingsService] Error fetching platform settings:', error);
      throw error;
    }
  },

  /** Actualizar configuración global y devolver el estado persistido. */
  updateSettings: async (settings: PlatformSettingsUpdate): Promise<PlatformSettings> => {
    validateSettings(settings);

    try {
      return normalizeSettings(await api.patch<PlatformSettings>('/settings', settings));
    } catch (error: any) {
      console.error('[SettingsService] Error updating platform settings:', error);
      throw new Error(error.response?.data?.detail || error.message || 'No se pudo guardar la configuración');
    }
  },
};
