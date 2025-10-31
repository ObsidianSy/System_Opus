import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subDays, subMonths } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface DateFilterState {
  dateRange: DateRange;
  preset: string;
  timezone: string;
  setDateRange: (range: DateRange) => void;
  setPreset: (preset: string) => void;
  getQueryParams: () => { startDate: string; endDate: string };
  formatDisplayRange: () => string;
}

export const DATE_PRESETS = {
  today: 'Hoje',
  last7days: 'Últimos 7 dias', 
  currentMonth: 'Mês atual',
  previousMonth: 'Mês anterior',
  custom: 'Intervalo customizado'
};

const TIMEZONE = 'America/Sao_Paulo';

const getPresetRange = (preset: string): DateRange => {
  const now = toZonedTime(new Date(), TIMEZONE);
  
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
  const [dateRange, setDateRangeState] = useState<DateRange>(getPresetRange('currentMonth'));

  // Persistir no localStorage
  useEffect(() => {
    const saved = localStorage.getItem('obsidian-date-filter');
    if (saved) {
      try {
        const { preset: savedPreset, startDate, endDate } = JSON.parse(saved);
        setPresetState(savedPreset);
        setDateRangeState({
          startDate: new Date(startDate),
          endDate: new Date(endDate)
        });
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
    localStorage.setItem('obsidian-date-filter', JSON.stringify({
      preset: newPreset,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString()
    }));
  };

  const getQueryParams = () => ({
    startDate: format(dateRange.startDate, 'yyyy-MM-dd'),
    endDate: format(dateRange.endDate, 'yyyy-MM-dd')
  });

  const formatDisplayRange = () => {
    const { startDate, endDate } = dateRange;
    const start = format(startDate, 'dd/MM');
    const end = format(endDate, 'dd/MM/yyyy');
    
    if (format(startDate, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd')) {
      return format(startDate, 'dd/MM/yyyy');
    }
    
    return `${start} - ${end}`;
  };

  return (
    <DateFilterContext.Provider
      value={{
        dateRange,
        preset,
        timezone: TIMEZONE,
        setDateRange,
        setPreset,
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