-- Zera TODOS os lançamentos do app (todos os usuários). IRREVERSÍVEL — faça backup antes.
-- Mantém: usuários, família, configurações (orçamento diário, cartão) e categorias personalizadas.
START TRANSACTION;
DELETE FROM `transactions`;               -- gastos (débito, pix, dinheiro)
DELETE FROM `income`;                     -- renda
DELETE FROM `credit_card_transactions`;   -- lançamentos do cartão / faturas importadas
DELETE FROM `invoice_payments`;           -- pagamentos de fatura
DELETE FROM `grocery_prices`;             -- histórico de preços de mercado
COMMIT;
