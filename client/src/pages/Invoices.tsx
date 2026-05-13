import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CATEGORIES, type CategoryKey } from "@shared/categories";
import { Trash2, ChevronLeft, ChevronRight, CreditCard } from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { trpc } from "@/lib/trpc";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function InvoicesPage() {
  const now = new Date();
  const [displayMonth, setDisplayMonth] = useState(now.getMonth() + 1);
  const [displayYear, setDisplayYear] = useState(now.getFullYear());

  const cardSettingsQuery = trpc.cardSettings.get.useQuery();
  const currentBillCycle = `${displayYear}-${String(displayMonth).padStart(2, "0")}`;
  const creditCardListQuery = trpc.creditCard.listByBillCycle.useQuery({ billCycle: currentBillCycle });
  
  const utils = trpc.useUtils();
  const deleteMutation = trpc.creditCard.delete.useMutation({
    onSuccess: () => {
      utils.creditCard.listByBillCycle.invalidate();
      utils.creditCard.summaryByBillCycle.invalidate();
    },
  });

  const transactions = creditCardListQuery.data ?? [];
  const closingDay = cardSettingsQuery.data?.closingDay ?? 26;
  const dueDay = cardSettingsQuery.data?.dueDay ?? 1;

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, typeof transactions> = {};
    for (const t of transactions) {
      const dateKey = t.date;
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(t);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [transactions]);

  // Calculate total
  const total = useMemo(() => {
    return transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
  }, [transactions]);

  const navigateMonth = (direction: number) => {
    let newMonth = displayMonth + direction;
    let newYear = displayYear;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1) { newMonth = 12; newYear--; }
    setDisplayMonth(newMonth);
    setDisplayYear(newYear);
  };

  const monthLabel = format(new Date(displayYear, displayMonth - 1), "MMMM yyyy", { locale: ptBR });

  return (
    <div className="space-y-4 pb-24">
      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold capitalize">Fatura: {monthLabel}</h2>
        <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Invoice Info */}
      <Card className="border-0 shadow-sm bg-blue-50">
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-muted-foreground uppercase">Fechamento</span>
              <span className="text-sm font-semibold">Dia {closingDay}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-muted-foreground uppercase">Vencimento</span>
              <span className="text-sm font-semibold">Dia {dueDay}</span>
            </div>
            <div className="flex justify-between items-center border-t pt-2 mt-2">
              <span className="text-xs font-medium text-muted-foreground uppercase">Total da Fatura</span>
              <span className="text-2xl font-bold text-blue-600">{formatCurrency(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      {creditCardListQuery.isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : groupedTransactions.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-muted-foreground">Nenhum lançamento nesta fatura</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {groupedTransactions.map(([date, dayTransactions]) => (
            <div key={date}>
              <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                {format(new Date(date + "T00:00:00"), "dd 'de' MMMM", { locale: ptBR })}
              </p>
              <div className="space-y-2">
                {dayTransactions.map((transaction) => {
                  const categoryInfo = CATEGORIES[transaction.category as CategoryKey];
                  const isParcelated = transaction.installments > 1;
                  
                  return (
                    <Card key={transaction.id} className="border-0 shadow-sm">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm">{categoryInfo?.emoji}</span>
                              <p className="text-sm font-semibold truncate">{transaction.description}</p>
                              {isParcelated && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                  {transaction.installmentNumber}/{transaction.installments}x
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {categoryInfo?.label}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-right">{formatCurrency(parseFloat(transaction.amount))}</p>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Deletar lançamento?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Tem certeza que deseja deletar "{transaction.description}"? Esta ação não pode ser desfeita.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate({ id: transaction.id })}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Deletar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
