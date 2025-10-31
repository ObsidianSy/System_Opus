import React, { useState } from 'react';
import { CalendarIcon, ChevronDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useDateFilter, DATE_PRESETS } from '@/contexts/DateFilterContext';
import { format } from 'date-fns';

export const DateFilterSelector: React.FC = () => {
  const { preset, dateRange, setPreset, setDateRange, formatDisplayRange } = useDateFilter();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [tempRange, setTempRange] = useState<{ from?: Date; to?: Date }>({});

  const handlePresetSelect = (newPreset: string) => {
    setPreset(newPreset);
  };

  const handleCustomDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (!range) return;
    
    setTempRange(range);
    
    if (range.from && range.to) {
      setDateRange({
        startDate: range.from,
        endDate: range.to
      });
      setIsCalendarOpen(false);
      setTempRange({});
    }
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
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
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-calendar-portal="true"]')) {
              e.preventDefault();
            }
          }}
          onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-calendar-portal="true"]')) {
              e.preventDefault();
            }
          }}
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
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen} modal>
            <PopoverTrigger asChild>
              <DropdownMenuItem 
                onSelect={(e) => e.preventDefault()}
                className="cursor-pointer"
              >
                <CalendarIcon className="h-4 w-4 mr-2" />
                Selecionar período customizado
              </DropdownMenuItem>
            </PopoverTrigger>
            <PopoverContent 
              data-calendar-portal="true"
              className="w-auto p-0 glass-card z-[60]" 
              align="start"
              onOpenAutoFocus={(e) => e.preventDefault()}
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={dateRange.startDate}
                selected={{
                  from: tempRange.from || dateRange.startDate,
                  to: tempRange.to || dateRange.endDate
                }}
                onSelect={handleCustomDateSelect}
                numberOfMonths={2}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </DropdownMenuContent>
      </DropdownMenu>
      
      <div className="text-sm text-muted-foreground font-medium">
        {formatDisplayRange()}
      </div>
    </div>
  );
};