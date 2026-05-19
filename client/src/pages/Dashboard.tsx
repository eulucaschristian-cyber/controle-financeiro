import { trpc } from "@/lib/trpc";
import { PAYMENT_METHODS, type PaymentMethodKey } from "@shared/categories";
import { useCategories } from "@/hooks/useCategories";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, ChevronLeft, ChevronRight, CreditCard, Edit2, Settings, ChevronRight as ChevronRightIcon } from "lucide-react";
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
  const [, navigate] = useLocation();
  const { categoriesMap } = useCategories();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const billCycle = `${year}-${String(month).padStart(2, "0")}`;
  const summaryQuery = trpc.dashboard.summary.useQuery({ year, month });
  const walletQuery = trpc.dashboard.walletBalance.useQuery({ year, month });
  const transactionsQuery = trpc.transactions.list.useQuery({ year, month });
  const creditCardSummaryQuery = trpc.creditCard.summaryByBillCycle.useQuery({ billCycle });
  const creditCardCategoryQuery = trpc.creditCard.categorySummaryByBillCycle.useQuery({ billCycle });
  const cardSettingsQuery = trpc.cardSettings.get.useQuery();

  // Calcula a fatura ativa atual (baseada na data de hoje e no dia de fechamento do cartão)
  const activeBillCycle = useMemo(() => {
    const closingDay = cardSettingsQuery.data?.closingDay ?? 26;
    const d = now.getDate();
    const m = now.getMonth(); // 0-based
    const y = now.getFullYear();
    const monthsToAdd = d < closingDay ? 1 : 2;
    const totalMonths = m + monthsToAdd;
    const dueYear = y + Math.floor(totalMonths / 12);
    const dueMonth0 = totalMonths % 12;
    return `${dueYear}-${String(dueMonth0 + 1).padStart(2, "0")}`;
  }, [cardSettingsQuery.data?.closingDay]);

  const activeCreditCardSummaryQuery = trpc.creditCard.summaryByBillCycle.useQuery({ billCycle: activeBillCycle });
  const creditCardAvailableQuery = trpc.creditCard.availableBalance.useQuery();
  const utils = trpc.useUtils();

  const deleteMutation = trpc.transactions.delete.useMutation({
    onSuccess: () => {
      utils.transactions.list.invalidate();
      utils.dashboard.summary.invalidate();
    },
  });

  const summary = summaryQuery.data;
  const transactions = transactionsQuery.data ?? [];

  // Merge regular + credit card categories
  const mergedCategories = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of (summary?.categorySummary ?? [])) {
      map[cat.category] = (map[cat.category] || 0) + parseFloat(cat.total);
    }
    for (const cat of (creditCardCategoryQuery.data ?? [])) {
      map[cat.category] = (map[cat.category] || 0) + parseFloat(cat.total);
    }
    return Object.entries(map)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  }, [summary?.categorySummary, creditCardCategoryQuery.data]);

  const totalGeral = (summary?.totalSpent ?? 0) + parseFloat(creditCardSummaryQuery.data?.total ?? "0");


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

  return (
    <div className="space-y-4 pb-24">
      {/* ── Navegação de Mês ── */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={() => navigateMonth(-1)}
          className="h-9 w-9 flex items-center justify-center rounded-xl bg-card border border-border/50 shadow-sm hover:bg-accent/20 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h1 className="text-base font-bold capitalize text-center text-foreground">
          {monthLabel}
        </h1>
        <button
          onClick={() => navigateMonth(1)}
          className="h-9 w-9 flex items-center justify-center rounded-xl bg-card border border-border/50 shadow-sm hover:bg-accent/20 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* ── Card CARTEIRA (saldo acumulado) ── */}
          <div className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-70">💰 Carteira</p>
            <p className="text-4xl font-bold mt-2 tabular-nums">
              {walletQuery.data ? formatCurrency(walletQuery.data.balance) : "—"}
            </p>
            <div className="flex gap-4 mt-3 text-xs opacity-60">
              <span>↑ {walletQuery.data ? formatCurrency(walletQuery.data.totalIncome) : "—"} entradas</span>
              <span>↓ {walletQuery.data ? formatCurrency(walletQuery.data.totalExpenses + walletQuery.data.totalInvoicePayments) : "—"} saídas</span>
            </div>
          </div>

          {/* ── Cards Hoje + Débito ── */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border border-border/40 shadow-sm rounded-2xl bg-card">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hoje</p>
                <p className="text-2xl font-bold mt-2 tabular-nums text-foreground">{formatCurrency(todaySpent)}</p>
                <p className="text-xs text-muted-foreground mt-1">débito / pix</p>
              </CardContent>
            </Card>

            <Card className="border border-border/40 shadow-sm rounded-2xl bg-card">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Débito/Pix</p>
                <p className="text-2xl font-bold mt-2 tabular-nums text-foreground">{formatCurrency(summary?.totalSpent ?? 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">{transactions.length} lançamentos</p>
              </CardContent>
            </Card>
          </div>

          {/* ── Card Cartão de Crédito ── */}
          {cardSettingsQuery.data && (() => {
            const cardLimit = parseFloat(cardSettingsQuery.data.limit);
            const totalOutstanding = creditCardAvailableQuery.data?.totalOutstanding ?? 0;
            const availableCredit = Math.max(0, cardLimit - totalOutstanding);
            const faturaTotal = parseFloat(activeCreditCardSummaryQuery.data?.total ?? "0");
            const pct = Math.min((totalOutstanding / cardLimit) * 100, 100);
            const isAlert = pct >= 80;
            const [faturaYear, faturaMonthStr] = activeBillCycle.split("-");
            const faturaLabel = format(
              new Date(parseInt(faturaYear), parseInt(faturaMonthStr) - 1),
              "MMMM yyyy",
              { locale: ptBR }
            );
            return (
              <button
                className={`w-full text-left rounded-2xl p-5 shadow-sm border transition-all hover:shadow-md
                  ${isAlert
                    ? "bg-red-50 border-red-200 ring-1 ring-red-300"
                    : "bg-card border-border/40"
                  }`}
                onClick={() => window.location.href = '/credit-card/faturas'}
              >
                {isAlert && (
                  <p className="text-xs font-bold text-red-600 mb-3 flex items-center gap-1.5">
                    ⚠️ Limite acima de 80% — atenção!
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className={`h-4 w-4 ${isAlert ? "text-red-500" : "text-primary"}`} />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Cartão de Crédito
                      </p>
                    </div>
                    {/* Fatura atual — destaque principal */}
                    <p className="text-xs text-muted-foreground mb-1 capitalize">{faturaLabel}</p>
                    <p className={`text-3xl font-bold tabular-nums ${isAlert ? "text-red-600" : "text-foreground"}`}>
                      {formatCurrency(faturaTotal)}
                    </p>
                    {/* Limite e saldo disponível — info secundária */}
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      <span>Limite: <span className="font-medium text-foreground">{formatCurrency(cardLimit)}</span></span>
                      <span>Disponível: <span className="font-medium text-foreground">{formatCurrency(availableCredit)}</span></span>
                    </div>
                    <div className="mt-3 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isAlert ? "bg-red-500" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); window.location.href = '/credit-card/settings'; }}
                    className="ml-4 h-9 w-9 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </button>
            );
          })()}



          {/* ── Por Categoria ── */}
          {mergedCategories.length > 0 && (
            <Card className="border border-border/40 shadow-sm rounded-2xl bg-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Por Categoria</p>
                </div>
                <p className="text-[11px] text-muted-foreground mb-4">Débito + Cartão</p>
                <div className="space-y-2.5">
                  {mergedCategories.map((cat) => {
                    const catInfo = categoriesMap[cat.category];
                    const pct = totalGeral > 0 ? (cat.total / totalGeral) * 100 : 0;
                    return (
                      <button
                        key={cat.category}
                        onClick={() => navigate(`/categoria/${cat.category}/${year}/${month}`)}
                        className="w-full flex items-center gap-3 text-left hover:bg-muted/70 rounded-xl px-2 py-2 transition-colors group"
                      >
                        <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0 text-lg">
                          {catInfo?.emoji ?? "📦"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-semibold truncate">{catInfo?.label ?? cat.category}</span>
                            <div className="flex items-center gap-1 ml-2 shrink-0">
                              <span className="text-sm font-bold tabular-nums">{formatCurrency(cat.total)}</span>
                              <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary/70 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Lançamentos ── */}
          {groupedTransactions.length > 0 ? (
            <Card className="border border-border/40 shadow-sm rounded-2xl bg-card">
              <CardContent className="p-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">🧾 Lançamentos</p>
                <div className="space-y-5">
                  {groupedTransactions.map(([dateKey, dayTransactions]) => (
                    <div key={dateKey}>
                      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        {format(parseISO(dateKey), "EEEE, d 'de' MMMM", { locale: ptBR })}
                      </p>
                      <div className="space-y-1.5">
                        {dayTransactions.map((t) => {
                          const catInfo = categoriesMap[t.category];
                          const pmInfo = PAYMENT_METHODS[t.paymentMethod as PaymentMethodKey];
                          return (
                            <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/60 transition-colors group">
                              <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0 text-base">
                                {catInfo?.emoji}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate leading-tight">{t.description}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-xs text-muted-foreground">{pmInfo?.emoji} {pmInfo?.label}</span>
                                  {t.installments > 1 && (
                                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-semibold">
                                      {t.installmentNumber}/{t.installments}x
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 ml-2 shrink-0">
                                <p className="text-sm font-bold tabular-nums">{formatCurrency(parseFloat(t.amount))}</p>
                                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => { setEditingTransaction(t); setEditDialogOpen(true); }}
                                    className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-destructive">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Deletar lançamento?</AlertDialogTitle>
                                        <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteMutation.mutate({ id: t.id })} className="bg-destructive hover:bg-destructive/90">
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
            <Card className="border border-border/40 shadow-sm rounded-2xl bg-card">
              <CardContent className="p-10 text-center">
                <p className="text-3xl mb-3">📭</p>
                <p className="font-semibold text-foreground">Nenhum gasto este mês</p>
                <p className="text-sm text-muted-foreground mt-1">Toque em + para registrar seu primeiro lançamento</p>
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
          onSuccess={() => { setEditingTransaction(null); setEditDialogOpen(false); }}
        />
      )}
    </div>
  );
}
