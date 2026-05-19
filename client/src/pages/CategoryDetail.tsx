import { trpc } from "@/lib/trpc";
import { CATEGORIES, PAYMENT_METHODS, type CategoryKey, type PaymentMethodKey } from "@shared/categories";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function CategoryDetail() {
  const [, navigate] = useLocation();
  const params = useParams<{ category: string; year: string; month: string }>();
  const category = params.category;
  const year = parseInt(params.year);
  const month = parseInt(params.month);
  const billCycle = `${year}-${String(month).padStart(2, "0")}`;

  const transactionsQuery = trpc.transactions.list.useQuery({ year, month });
  const creditCardListQuery = trpc.creditCard.listByBillCycle.useQuery({ billCycle });

  const catInfo = CATEGORIES[category as CategoryKey];

  const debitTxns = (transactionsQuery.data ?? []).filter((t) => t.category === category);
  const cardTxns = (creditCardListQuery.data ?? []).filter((t) => t.category === category);

  const totalDebit = debitTxns.reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalCard = cardTxns.reduce((s, t) => s + parseFloat(t.amount), 0);
  const totalGeral = totalDebit + totalCard;

  const isLoading = transactionsQuery.isLoading || creditCardListQuery.isLoading;

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-2xl">{catInfo?.emoji ?? "📦"}</span>
          <h1 className="text-xl font-bold">{catInfo?.label ?? category}</h1>
        </div>
        <span className="text-xl font-bold text-blue-700">{formatCurrency(totalGeral)}</span>
      </div>

      {/* Totais resumo */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-0 shadow-sm bg-emerald-50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Débito / Pix</p>
            <p className="text-lg font-bold text-emerald-700">{formatCurrency(totalDebit)}</p>
            <p className="text-xs text-muted-foreground">{debitTxns.length} lançamento{debitTxns.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-indigo-50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase font-bold mb-1">Cartão (fatura atual)</p>
            <p className="text-lg font-bold text-indigo-700">{formatCurrency(totalCard)}</p>
            <p className="text-xs text-muted-foreground">{cardTxns.length} lançamento{cardTxns.length !== 1 ? "s" : ""}</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Débito / Pix / Dinheiro */}
          {debitTxns.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  💵 Débito / Pix / Dinheiro
                </p>
                <div className="space-y-2">
                  {debitTxns.map((t) => {
                    const pmInfo = PAYMENT_METHODS[t.paymentMethod as PaymentMethodKey];
                    return (
                      <div key={t.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{t.description}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {pmInfo?.emoji} {pmInfo?.label} · {format(parseISO(t.date), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                        </div>
                        <p className="text-sm font-bold ml-3">{formatCurrency(parseFloat(t.amount))}</p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cartão de Crédito */}
          {cardTxns.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                  💳 Cartão de Crédito — fatura {String(month).padStart(2, "0")}/{year}
                </p>
                <div className="space-y-2">
                  {cardTxns.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{t.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(t.date + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
                          </p>
                          {t.installments > 1 && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">
                              {t.installmentNumber}/{t.installments}x
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm font-bold ml-3">{formatCurrency(parseFloat(t.amount))}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {debitTxns.length === 0 && cardTxns.length === 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Nenhum lançamento nesta categoria.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
