// Testar função de parsear data do Excel

function parseExcelDate(dateValue) {
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
            const parsed = new Date(dateValue);
            return isNaN(parsed.getTime()) ? null : parsed;
        }

        return null;
    } catch (error) {
        console.warn(`⚠️ Erro ao parsear data: ${dateValue}`);
        return null;
    }
}

// Testes
console.log('🧪 Testando parseExcelDate:\n');

// Teste 1: String válida
const test1 = parseExcelDate('2025-01-15T10:30:00');
console.log('1. String válida:', test1);

// Teste 2: String inválida
const test2 = parseExcelDate('data inválida');
console.log('2. String inválida:', test2);

// Teste 3: Número do Excel (45658 = 2025-01-15)
const test3 = parseExcelDate(45658);
console.log('3. Serial Excel (45658):', test3);

// Teste 4: undefined
const test4 = parseExcelDate(undefined);
console.log('4. undefined:', test4);

// Teste 5: null
const test5 = parseExcelDate(null);
console.log('5. null:', test5);

// Teste 6: Date válida
const test6 = parseExcelDate(new Date('2025-11-03'));
console.log('6. Date válida:', test6);

// Teste 7: Date inválida
const test7 = parseExcelDate(new Date('invalid'));
console.log('7. Date inválida:', test7);

// Teste 8: String vazia
const test8 = parseExcelDate('');
console.log('8. String vazia:', test8);

console.log('\n✅ Testes concluídos!');
