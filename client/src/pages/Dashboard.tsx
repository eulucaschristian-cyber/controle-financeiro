import { trpc } from "@/lib/trpc";
import { CATEGORIES, PAYMENT_METHODS, type CategoryKey, type PaymentMethodKey } from "@shared/categories";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, TrendingUp, TrendingDown, Wallet, CalendarDays, ChevronLeft, ChevronRight, CreditCard, Edit2, Settings } from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { EditTransactionDialog } from "@/components/EditTransactionDialog";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
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

export default function Dashboard() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const summaryQuery = trpc.dashboard.summary.useQuery({ year, month });
  const transactionsQuery = trpc.transactions.list.useQuery({ year, month });
  const creditCardSummaryQuery = trpc.creditCard.summaryByBillCycle.useQuery({ billCycle: `${year}-${String(month).padStart(2, "0")}` });
  const cardSettingsQuery = trpc.cardSettings.get.useQuery();
  const utils = trpc.useUtils();

  const deleteMutation = trpc.transactions.delete.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate();
      utils.dashboard.summary.invalidate();
    },
  });

  const summary = summaryQuery.data;
  const transactions = transactionsQuery.data ?? [];

  const groupedTransactions = useMemo(() => {
    const groups: Record<string, typeof transactions> = {};
    for (const t of transactions) {
      const dateKey = t.date;
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(t);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [transactions]);

  const dailySpendingMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of transactions) {
      map[t.date] = (map[t.date] || 0) + parseFloat(t.amount);
    }
    return map;
  }, [transactions]);

  const navigateMonth = (direction: number) => {
    let newMonth = month + direction;
    let newYear = year;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1) { newMonth = 12; newYear--; }
    setMonth(newMonth);
    setYear(newYear);
  };

  const monthLabel = format(new Date(year, month - 1), "MMMM yyyy", { locale: ptBR });
  const isLoading = summaryQuery.isLoading || transactionsQuery.isLoading;

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todaySpent = dailySpendingMap[todayStr] || 0;
  const dailyBudget = summary?.dailyBudget ?? 66;
  const todayRemaining = dailyBudget - todaySpent;

  return (
    <div className="space-y-5 pb-24 px-2">
      {/* Month Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)} className="hover:bg-accent/20">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold capitalize text-center flex-1">📅 {monthLabel}</h1>
        <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)} className="hover:bg-accent/20">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Saldo Acumulado */}
            <Card className={`col-span-2 border-0 shadow-lg rounded-2xl ${(summary?.accumulatedBalance ?? 0) >= 0 ? "bg-gradient-to-br from-emerald-50 via-emerald-50 to-emerald-100" : "bg-gradient-to-br from-red-50 via-red-50 to-red-100"}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">💰 Saldo Acumulado</p>
                    <p className={`text-4xl font-bold mt-3 ${(summary?.accumulatedBalance ?? 0) >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                      {formatCurrency(summary?.accumulatedBalance ?? 0)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {(summary?.daysInMonth ?? 0)} dias × {formatCurrency(dailyBudget)} = {formatCurrency(summary?.monthlyBudget ?? 0)}
                    </p>
                  </div>
                  <div className={`h-16 w-16 rounded-full flex items-center justify-center ${(summary?.accumulatedBalance ?? 0) >= 0 ? "bg-emerald-200" : "bg-red-200"}`}>
                    {(summary?.accumulatedBalance ?? 0) >= 0 ? (
                      <TrendingUp className="h-8 w-8 text-emerald-700" />
                    ) : (
                      <TrendingDown className="h-8 w-8 text-red-700" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Hoje */}
            <Card className="border-0 shadow-lg rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100">
              <CardContent className="p-5">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">☀️ Hoje</p>
                <p className={`text-3xl font-bold mt-3 ${todayRemaining >= 0 ? "text-blue-700" : "text-red-700"}`}>
                  {formatCurrency(todayRemaining)}
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Gasto: {formatCurrency(todaySpent)}
                </p>
              </CardContent>
            </Card>

            {/* Total Gasto */}
            <Card className="border-0 shadow-lg rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100">
              <CardContent className="p-5">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">📊 Total</p>
                <p className="text-3xl font-bold mt-3 text-purple-700">{formatCurrency(summary?.totalSpent ?? 0)}</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Média: {formatCurrency(summary?.averageDaily ?? 0)}/dia
                </p>
              </CardContent>
            </Card>

            {/* Cartão de Crédito */}
            {creditCardSummaryQuery.data && cardSettingsQuery.data && (() => {
              const cardLimit = parseFloat(cardSettingsQuery.data.limit);
              const cardUsed = parseFloat(creditCardSummaryQuery.data.total);
              const percentageUsed = (cardUsed / cardLimit) * 100;
              const isAlertActive = percentageUsed >= 80;
              const cardColor = isAlertActive ? "from-red-50 to-red-100" : "from-indigo-50 to-indigo-100";
              const textColor = isAlertActive ? "text-red-700" : "text-indigo-700";
              const bgColor = isAlertActive ? "bg-red-200" : "bg-indigo-200";
              
              return (
              <Card className={`col-span-2 border-0 shadow-lg rounded-2xl bg-gradient-to-br ${cardColor} cursor-pointer hover:shadow-2xl transition-all ${isAlertActive ? "ring-2 ring-red-400" : ""}`} onClick={() => window.location.href = '/credit-card/faturas'}>
                <CardContent className="p-6">
                  {isAlertActive && (
                    <div className="mb-3 p-2 bg-red-200 border border-red-400 rounded-lg">
                      <p className="text-xs font-bold text-red-900">⚠️ ATENÇÃO: Limite de cartão acima de 80%!</p>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">💳 Cartão de Crédito</p>
                      <p className={`text-4xl font-bold mt-3 ${textColor}`}>{formatCurrency(cardLimit - cardUsed)}</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        Utilizado: {formatCurrency(cardUsed)} de {formatCurrency(cardLimit)} ({percentageUsed.toFixed(1)}%)
                      </p>
                    </div>
                    <div className="flex flex-col gap-3">
                      <div className="h-16 w-16 rounded-full flex items-center justify-center bg-indigo-200">
                        <CreditCard className="h-8 w-8 text-indigo-700" />
                      </div>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); window.location.href = '/credit-card/settings'; }} className="h-10 w-10 p-0 hover:bg-indigo-200">
                        <Settings className="h-5 w-5 text-indigo-700" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
            })()}
          </div>

          {/* Payment Method Breakdown */}
          {summary?.paymentMethodSummary && summary.paymentMethodSummary.length > 0 && (
            <Card className="border-0 shadow-lg rounded-2xl">
              <CardContent className="p-5">
                <p className="text-sm font-bold text-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                  💳 Por Forma de Pagamento
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {summary.paymentMethodSummary
                    .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))
                    .map((pm) => {
                      const pmInfo = PAYMENT_METHODS[pm.paymentMethod as PaymentMethodKey];
                      return (
                        <div key={pm.paymentMethod} className={`rounded-xl p-4 ${pmInfo?.color ?? "bg-muted"} shadow-sm`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-lg">{pmInfo?.emoji}</span>
                            <span className="text-sm font-semibold">{pmInfo?.label}</span>
                          </div>
                          <p className="text-lg font-bold">{formatCurrency(parseFloat(pm.total))}</p>
                          <p className="text-xs opacity-75 mt-1">{pm.count} lançamento{pm.count > 1 ? "s" : ""}</p>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Category Breakdown */}
          {summary?.categorySummary && summary.categorySummary.length > 0 && (
            <Card className="border-0 shadow-lg rounded-2xl">
              <CardContent className="p-5">
                <p className="text-sm font-bold text-foreground uppercase tracking-widest mb-4">📂 Por Categoria</p>
                <div className="space-y-3">
                  {summary.categorySummary
                    .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))
                    .map((cat) => {
                      const catInfo = CATEGORIES[cat.category as CategoryKey];
                      const percentage = summary.totalSpent > 0 ? (parseFloat(cat.total) / summary.totalSpent) * 100 : 0;
                      return (
                        <div key={cat.category} className="flex items-center gap-3">
                          <span className="text-xl w-8 text-center">{catInfo?.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-sm font-semibold truncate">{catInfo?.label}</span>
                              <span className="text-sm font-bold">{formatCurrency(parseFloat(cat.total))}</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{percentage.toFixed(0)}%</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transactions */}
          {groupedTransactions.length > 0 ? (
            <Card className="border-0 shadow-lg rounded-2xl">
              <CardContent className="p-5">
                <p className="text-sm font-bold text-foreground uppercase tracking-widest mb-4">📝 Lançamentos</p>
                <div className="space-y-4">
                  {groupedTransactions.map(([dateKey, dayTransactions]) => (
                    <div key={dateKey}>
                      <p className="text-xs font-bold text-muted-foreground uppercase mb-2">
                        {format(parseISO(dateKey), "EEEE, d 'de' MMMM", { locale: ptBR })}
                      </p>
                      <div className="space-y-2">
                        {dayTransactions.map((t) => {
                          const catInfo = CATEGORIES[t.category as CategoryKey];
                          const pmInfo = PAYMENT_METHODS[t.paymentMethod as PaymentMethodKey];
                          return (
                            <div key={t.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl hover:bg-muted transition-colors">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="text-lg">{catInfo?.emoji}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold truncate">{t.description}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs">{pmInfo?.emoji}</span>
                                    <span className="text-xs text-muted-foreground">{pmInfo?.label}</span>
                                    {t.installments > 1 && (
                                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
                                        {t.installmentNumber}/{t.installments}x
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-2">
                                <p className="text-sm font-bold">{formatCurrency(parseFloat(t.amount))}</p>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingTransaction(t);
                                      setEditDialogOpen(true);
                                    }}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Deletar lançamento?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Esta ação não pode ser desfeita.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteMutation.mutate({ id: t.id })}
                                          className="bg-destructive"
                                        >
                                          Deletar
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-lg rounded-2xl">
              <CardContent className="p-8 text-center">
                <p className="text-lg">📭 Nenhum gasto registrado neste mês.</p>
                <p className="text-sm text-muted-foreground mt-2">Use o botão "➕ Novo Gasto" para lançar seu primeiro gasto!</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {editingTransaction && (
        <EditTransactionDialog
          transaction={editingTransaction}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onSuccess={() => {
            setEditingTransaction(null);
            setEditDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}
