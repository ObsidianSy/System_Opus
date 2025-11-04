import logger from '../config/logger';





export function parseExcelDate(dateValue: any): Date | null {
    if (!dateValue) return null;

    try {
        // Se já é Date, retornar
        if (dateValue instanceof Date) {
            return isNaN(dateValue.getTime()) ? null : dateValue;
        }

        // Se é número (serial date do Excel)
        if (typeof dateValue === 'number') {
            // Excel dates são dias desde 1/1/1900 (com bug do 1900)
            const excelEpoch = new Date(1899, 11, 30);
            const date = new Date(excelEpoch.getTime() + dateValue * 86400000);
            return isNaN(date.getTime()) ? null : date;
        }

        // Se é string, tentar parsear
        if (typeof dateValue === 'string') {
            // Tentar formato brasileiro DD/MM/YYYY HH:MM ou DD/MM/YYYY
            const brMatch = dateValue.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
            if (brMatch) {
                const day = parseInt(brMatch[1], 10);
                const month = parseInt(brMatch[2], 10) - 1; // Mês é 0-indexed
                const year = parseInt(brMatch[3], 10);
                const hour = brMatch[4] ? parseInt(brMatch[4], 10) : 0;
                const minute = brMatch[5] ? parseInt(brMatch[5], 10) : 0;

                const date = new Date(year, month, day, hour, minute);
                return isNaN(date.getTime()) ? null : date;
            }

            // Tentar formato ISO (YYYY-MM-DD)
            const parsed = new Date(dateValue);
            return isNaN(parsed.getTime()) ? null : parsed;
        }

        return null;
    } catch (error) {
        logger.warn('Erro ao parsear data', { dateValue });
        return null;
    }
}