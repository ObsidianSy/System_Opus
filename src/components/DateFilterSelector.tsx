import React, { useState } from 'react';
import { CalendarIcon, ChevronDownIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useDateFilter, DATE_PRESETS } from '@/contexts/DateFilterContext';
import { format } from 'date-fns';

export const DateFilterSelector: React.FC = () => {
  const { preset, dateRange, setPreset, setDateRange, formatDisplayRange } = useDateFilter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [tempRange, setTempRange] = useState<{ from?: Date; to?: Date }>({});
  const [calendarMonth, setCalendarMonth] = useState<Date>(dateRange?.startDate || new Date());

  const handlePresetSelect = (newPreset: string) => {
    setPreset(newPreset);
    setIsDropdownOpen(false);
  };

  const handleOpenCalendar = () => {
    setIsDropdownOpen(false);
    setTimeout(() => setIsDialogOpen(true), 50);
  };

  const handleCustomDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range) return;
    
    setTempRange(range);
    
    if (range.from && range.to) {
      setDateRange({
        startDate: range.from,
        endDate: range.to
      });
      setTempRange({});
    }
  };

  const handleMonthChange = (increment: number) => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(newMonth.getMonth() + increment);
    setCalendarMonth(newMonth);
  };

  const handleYearChange = (year: string) => {
    const newMonth = new Date(calendarMonth);
    newMonth.setFullYear(parseInt(year));
    setCalendarMonth(newMonth);
  };

  const handleMonthSelect = (month: string) => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(parseInt(month));
    setCalendarMonth(newMonth);
  };

  // Gerar anos (últimos 5 anos + próximos 2 anos)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => currentYear - 5 + i);

  // Meses em português
  const months = [
    { value: '0', label: 'Janeiro' },
    { value: '1', label: 'Fevereiro' },
    { value: '2', label: 'Março' },
    { value: '3', label: 'Abril' },
    { value: '4', label: 'Maio' },
    { value: '5', label: 'Junho' },
    { value: '6', label: 'Julho' },
    { value: '7', label: 'Agosto' },
    { value: '8', label: 'Setembro' },
    { value: '9', label: 'Outubro' },
    { value: '10', label: 'Novembro' },
    { value: '11', label: 'Dezembro' },
  ];

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="glass-card border-primary/20 hover:border-primary/40 transition-colors"
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            <span className="font-medium">
              {DATE_PRESETS[preset as keyof typeof DATE_PRESETS] || 'Período personalizado'}
            </span>
            <ChevronDownIcon className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="start" 
          className="glass-card"
        >
          {Object.entries(DATE_PRESETS).map(([key, label]) => (
            <DropdownMenuItem
              key={key}
              onClick={() => handlePresetSelect(key)}
              className={cn(
                "cursor-pointer transition-colors",
                preset === key && "bg-primary/10 text-primary font-medium"
              )}
            >
              {label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={handleOpenCalendar}
            className="cursor-pointer"
          >
            <CalendarIcon className="h-4 w-4 mr-2" />
            Selecionar período customizado
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="p-0 glass-card max-w-fit" onOpenAutoFocus={(e) => e.preventDefault()}>
          <div className="flex items-center justify-between gap-2 p-3 border-b">
            <Select
              value={calendarMonth.getMonth().toString()}
              onValueChange={handleMonthSelect}
            >
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[9999]">
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={calendarMonth.getFullYear().toString()}
              onValueChange={handleYearChange}
            >
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[9999]">
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleMonthChange(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleMonthChange(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Calendar
            initialFocus
            mode="range"
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            selected={{
              from: tempRange.from || dateRange?.startDate,
              to: tempRange.to || dateRange?.endDate
            }}
            onSelect={handleCustomDateSelect}
            numberOfMonths={2}
            className="pointer-events-auto"
          />
        </DialogContent>
      </Dialog>
      
      <div className="text-sm text-muted-foreground font-medium">
        {formatDisplayRange()}
      </div>
    </div>
  );
};