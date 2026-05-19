import { describe, it, expect } from 'vitest';
import { calculateBillCycle, getClosingDayForMonth } from './db';

describe('getClosingDayForMonth', () => {
  it('Janeiro (31 dias) com intervalo 5 → fecha dia 27', () => {
    expect(getClosingDayForMonth(2026, 0, 5)).toBe(27); // Jan=0
  });
  it('Fevereiro (28 dias) com intervalo 5 → fecha dia 24', () => {
    expect(getClosingDayForMonth(2026, 1, 5)).toBe(24); // Feb=1
  });
  it('Março (31 dias) com intervalo 5 → fecha dia 27', () => {
    expect(getClosingDayForMonth(2026, 2, 5)).toBe(27);
  });
  it('Abril (30 dias) com intervalo 5 → fecha dia 26', () => {
    expect(getClosingDayForMonth(2026, 3, 5)).toBe(26);
  });
  it('Maio (31 dias) com intervalo 5 → fecha dia 27', () => {
    expect(getClosingDayForMonth(2026, 4, 5)).toBe(27);
  });
});

describe('calculateBillCycle — retorna mês de VENCIMENTO', () => {
  describe('Compras em Abril (fecha dia 26, vence dia 1 de Maio)', () => {
    it('05/04 (antes do fechamento) → vence em Maio', () => {
      expect(calculateBillCycle('2026-04-05', { closingInterval: 5 })).toBe('2026-05');
    });
    it('25/04 (antes do fechamento) → vence em Maio', () => {
      expect(calculateBillCycle('2026-04-25', { closingInterval: 5 })).toBe('2026-05');
    });
    it('26/04 (no fechamento) → vence em Junho', () => {
      expect(calculateBillCycle('2026-04-26', { closingInterval: 5 })).toBe('2026-06');
    });
    it('30/04 (após fechamento) → vence em Junho', () => {
      expect(calculateBillCycle('2026-04-30', { closingInterval: 5 })).toBe('2026-06');
    });
  });

  describe('Compras em Março (fecha dia 27, vence dia 1 de Abril)', () => {
    it('26/03 (antes do fechamento) → vence em Abril', () => {
      expect(calculateBillCycle('2026-03-26', { closingInterval: 5 })).toBe('2026-04');
    });
    it('27/03 (no fechamento) → vence em Maio', () => {
      expect(calculateBillCycle('2026-03-27', { closingInterval: 5 })).toBe('2026-05');
    });
    it('30/03 (após fechamento) → vence em Maio', () => {
      expect(calculateBillCycle('2026-03-30', { closingInterval: 5 })).toBe('2026-05');
    });
  });

  describe('Transição de ano (Dezembro → Janeiro)', () => {
    it('25/12 (antes do fechamento 27) → vence em Janeiro', () => {
      expect(calculateBillCycle('2025-12-25', { closingInterval: 5 })).toBe('2026-01');
    });
    it('27/12 (no fechamento) → vence em Fevereiro', () => {
      expect(calculateBillCycle('2025-12-27', { closingInterval: 5 })).toBe('2026-02');
    });
  });

  describe('Fallback com closingDay fixo', () => {
    it('25/02 com closingDay=26 → vence em Março', () => {
      expect(calculateBillCycle('2026-02-25', { closingDay: 26 })).toBe('2026-03');
    });
    it('26/02 (no fechamento) com closingDay=26 → vence em Abril', () => {
      expect(calculateBillCycle('2026-02-26', { closingDay: 26 })).toBe('2026-04');
    });
    it('01/01 com closingDay=26 → vence em Fevereiro', () => {
      expect(calculateBillCycle('2026-01-01', { closingDay: 26 })).toBe('2026-02');
    });
    it('31/01 com closingDay=26 → vence em Março', () => {
      expect(calculateBillCycle('2026-01-31', { closingDay: 26 })).toBe('2026-03');
    });
  });
});
