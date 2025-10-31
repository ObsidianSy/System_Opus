// Utilitários para otimização de performance
import React from 'react';

// Debounce para busca
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(null, args), wait);
  };
};

// Throttle para scroll events
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Lazy loading para componentes
export const createLazyComponent = (importFunc: () => Promise<any>) => {
  return React.lazy(() => 
    importFunc().then(module => ({
      default: module.default || module
    }))
  );
};

// Memoização simples para cálculos
export const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
  const cache = new Map();
  return ((...args: any[]) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn.apply(null, args);
    cache.set(key, result);
    return result;
  }) as T;
};

// Detectar se o dispositivo tem recursos limitados
export const isLowEndDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  
  // @ts-ignore - deviceMemory pode não estar disponível
  const memory = navigator.deviceMemory;
  const cores = navigator.hardwareConcurrency;
  
  return memory && memory <= 4 || cores && cores <= 2;
};

// Utility para renderização virtual (viewport)
export const isElementInViewport = (element: Element): boolean => {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
};