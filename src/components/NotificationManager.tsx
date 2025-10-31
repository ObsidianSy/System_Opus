import { useEffect } from 'react';
import { toast } from 'sonner';

// Manager de notificações para evitar toasts duplicados
class NotificationManager {
  private activeToasts = new Set<string>();
  private toastTimeout = 5000; // 5 segundos

  show(id: string, message: string, type: 'success' | 'error' | 'info' | 'loading' = 'info') {
    if (this.activeToasts.has(id)) {
      return; // Toast já ativo
    }

    this.activeToasts.add(id);

    const toastConfig = {
      id,
      duration: type === 'loading' ? Infinity : this.toastTimeout,
    };

    switch (type) {
      case 'success':
        toast.success(message, toastConfig);
        break;
      case 'error':
        toast.error(message, toastConfig);
        break;
      case 'loading':
        toast.loading(message, toastConfig);
        break;
      default:
        toast.info(message, toastConfig);
    }

    if (type !== 'loading') {
      setTimeout(() => {
        this.activeToasts.delete(id);
      }, this.toastTimeout);
    }
  }

  dismiss(id: string) {
    toast.dismiss(id);
    this.activeToasts.delete(id);
  }

  clear() {
    this.activeToasts.clear();
    toast.dismiss();
  }
}

export const notificationManager = new NotificationManager();

// Hook para limpar notificações no unmount
export const useNotificationCleanup = () => {
  useEffect(() => {
    return () => {
      notificationManager.clear();
    };
  }, []);
};