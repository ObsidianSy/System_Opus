import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays, subMonths } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface DateFilterState {
  dateRange: DateRange | null; // null = sem filtro (todos os dados históricos)
  preset: string;
  timezone: string;
  setDateRange: (range: DateRange) => void;
  setPreset: (preset: string) => void;
  resetToAll: () => void; // Nova função para mostrar todos os dados históricos
  getQueryParams: () => { startDate: string; endDate: string } | null;
  formatDisplayRange: () => string;
}

export const DATE_PRESETS = {
  allTime: 'Todos os dados',
  today: 'Hoje',
  last7days: 'Últimos 7 dias', 
  currentMonth: 'Mês atual',
  previousMonth: 'Mês anterior',
  custom: 'Intervalo customizado'
};

const TIMEZONE = 'America/Sao_Paulo';

const getPresetRange = (preset: string): DateRange | null => {
  const now = toZonedTime(new Date(), TIMEZONE);
  
  if (preset === 'allTime') {
    return null; // Sem filtro de data
  }
  
  switch (preset) {
    case 'today':
      return {
        startDate: startOfDay(now),
        endDate: endOfDay(now)
      };
    case 'last7days':
      return {
        startDate: startOfDay(subDays(now, 6)),
        endDate: endOfDay(now)
      };
    case 'currentMonth':
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now)
      };
    case 'previousMonth':
      const prevMonth = subMonths(now, 1);
      return {
        startDate: startOfMonth(prevMonth),
        endDate: endOfMonth(prevMonth)
      };
    default:
      return {
        startDate: startOfMonth(now),
        endDate: endOfMonth(now)
      };
  }
};

const DateFilterContext = createContext<DateFilterState | undefined>(undefined);

export const DateFilterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [preset, setPresetState] = useState<string>('currentMonth');
  const [dateRange, setDateRangeState] = useState<DateRange | null>(getPresetRange('currentMonth'));

  // Persistir no localStorage
  useEffect(() => {
    const saved = localStorage.getItem('obsidian-date-filter');
    if (saved) {
      try {
        const { preset: savedPreset, startDate, endDate } = JSON.parse(saved);
        setPresetState(savedPreset);
        
        // Se for allTime, seta null
        if (savedPreset === 'allTime') {
          setDateRangeState(null);
        } else {
          setDateRangeState({
            startDate: new Date(startDate),
            endDate: new Date(endDate)
          });
        }
      } catch (error) {
        console.warn('Erro ao carregar filtro de data salvo:', error);
      }
    }
  }, []);

  const setDateRange = (range: DateRange) => {
    setDateRangeState(range);
    setPresetState('custom');
    localStorage.setItem('obsidian-date-filter', JSON.stringify({
      preset: 'custom',
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString()
    }));
  };

  const setPreset = (newPreset: string) => {
    setPresetState(newPreset);
    const range = getPresetRange(newPreset);
    setDateRangeState(range);
    
    if (newPreset === 'allTime') {
      // Não salva datas para allTime
      localStorage.setItem('obsidian-date-filter', JSON.stringify({
        preset: newPreset
      }));
    } else if (range) {
      localStorage.setItem('obsidian-date-filter', JSON.stringify({
        preset: newPreset,
        startDate: range.startDate.toISOString(),
        endDate: range.endDate.toISOString()
      }));
    }
  };

  const getQueryParams = () => {
    if (!dateRange) return null; // Sem filtro
    return {
      startDate: format(dateRange.startDate, 'yyyy-MM-dd'),
      endDate: format(dateRange.endDate, 'yyyy-MM-dd')
    };
  };

  const formatDisplayRange = () => {
    if (!dateRange) return 'Todos os dados históricos';
    
    const { startDate, endDate } = dateRange;
    const start = format(startDate, 'dd/MM');
    const end = format(endDate, 'dd/MM/yyyy');
    
    if (format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
      return format(startDate, 'dd/MM/yyyy');
    }
    
    return `${start} - ${end}`;
  };

  // Resetar filtro de data para mostrar TODOS os dados históricos (sem filtro)
  const resetToAll = () => {
    // Remove filtro do localStorage
    localStorage.removeItem('obsidian-date-filter');
    // Seta dateRange como null = sem filtro
    setDateRangeState(null);
    setPresetState('allTime');
  };

  return (
    <DateFilterContext.Provider
      value={{
        dateRange,
        preset,
        timezone: TIMEZONE,
        setDateRange,
        setPreset,
        resetToAll,
        getQueryParams,
        formatDisplayRange
      }}
    >
      {children}
    </DateFilterContext.Provider>
  );
};

export const useDateFilter = (): DateFilterState => {
  const context = useContext(DateFilterContext);
  if (!context) {
    throw new Error('useDateFilter must be used within a DateFilterProvider');
  }
  return context;
};