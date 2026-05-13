import { describe, it, expect } from 'vitest';

/**
 * Função auxiliar para calcular billCycle baseado na data
 * (copiada de db.ts para teste)
 */
function calculateBillCycle(date: string, closingDay: number = 26): string {
  // Parsear data manualmente para evitar problemas de timezone
  // Formato esperado: YYYY-MM-DD
  const [yearStr, monthStr, dayStr] = date.split('-');
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10) - 1;  // Converter para 0-indexed
  const year = parseInt(yearStr, 10);
  
  // Se o dia é ANTES do dia de fechamento, a fatura é deste mês
  // Se o dia é NO fechamento ou DEPOIS, a fatura é do próximo mês
  if (day < closingDay) {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  } else {
    // Fatura do próximo mês
    let billMonth = month + 1;  // Próximo mês (0-indexed)
    let billYear = year;
    
    if (billMonth >= 12) {
      billMonth = 0;  // Janeiro do próximo ano
      billYear = year + 1;
    }
    
    // Converter para 1-indexed para o formato YYYY-MM
    return `${billYear}-${String(billMonth + 1).padStart(2, '0')}`;
  }
}

describe('calculateBillCycle', () => {
  describe('Cenário do usuário: Compra em 26/02/2026 parcelada em 2x', () => {
    it('Compra em 25/02 (antes do fechamento) deve estar em Fevereiro', () => {
      const result = calculateBillCycle('2026-02-25', 26);
      expect(result).toBe('2026-02');
    });

    it('Compra em 26/02 (NO fechamento) deve estar em Março (próxima fatura)', () => {
      const result = calculateBillCycle('2026-02-26', 26);
      expect(result).toBe('2026-03');
    });

    it('Compra em 27/02 (depois do fechamento) deve estar em Março', () => {
      const result = calculateBillCycle('2026-02-27', 26);
      expect(result).toBe('2026-03');
    });

    it('Compra em 28/02 (depois do fechamento) deve estar em Março', () => {
      const result = calculateBillCycle('2026-02-28', 26);
      expect(result).toBe('2026-03');
    });
  });

  describe('Casos gerais', () => {
    it('Compra em 01/01 deve estar em Janeiro', () => {
      const result = calculateBillCycle('2026-01-01', 26);
      expect(result).toBe('2026-01');
    });

    it('Compra em 25/01 deve estar em Janeiro', () => {
      const result = calculateBillCycle('2026-01-25', 26);
      expect(result).toBe('2026-01');
    });

    it('Compra em 26/01 deve estar em Fevereiro (próxima fatura)', () => {
      const result = calculateBillCycle('2026-01-26', 26);
      expect(result).toBe('2026-02');
    });

    it('Compra em 31/01 deve estar em Fevereiro', () => {
      const result = calculateBillCycle('2026-01-31', 26);
      expect(result).toBe('2026-02');
    });
  });

  describe('Transição de ano', () => {
    it('Compra em 26/12 deve estar em Janeiro do próximo ano', () => {
      const result = calculateBillCycle('2025-12-26', 26);
      expect(result).toBe('2026-01');
    });

    it('Compra em 25/12 deve estar em Dezembro', () => {
      const result = calculateBillCycle('2025-12-25', 26);
      expect(result).toBe('2025-12');
    });
  });

  describe('Diferentes dias de fechamento', () => {
    it('Com closingDay=15, compra em 14/02 deve estar em Fevereiro', () => {
      const result = calculateBillCycle('2026-02-14', 15);
      expect(result).toBe('2026-02');
    });

    it('Com closingDay=15, compra em 15/02 deve estar em Março', () => {
      const result = calculateBillCycle('2026-02-15', 15);
      expect(result).toBe('2026-03');
    });

    it('Com closingDay=10, compra em 10/02 deve estar em Março', () => {
      const result = calculateBillCycle('2026-02-10', 10);
      expect(result).toBe('2026-03');
    });
  });
});
