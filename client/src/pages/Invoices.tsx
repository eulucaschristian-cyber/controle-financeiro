import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCategories } from "@/hooks/useCategories";
import { Trash2, ChevronLeft, ChevronRight, CreditCard, Eraser, CheckCircle2, Circle, Pencil, Check, X, PlusCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
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
  const { categoriesMap, categoryOptions } = useCategories();

  const cardSettingsQuery = trpc.cardSettings.get.useQuery();
  const currentBillCycle = `${displayYear}-${String(displayMonth).padStart(2, "0")}`;
  const creditCardListQuery = trpc.creditCard.listByBillCycle.useQuery({ billCycle: currentBillCycle });
  
  const utils = trpc.useUtils();

  // Estado do quick-add
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState("compras_online");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Calcula billCycle client-side — espelha exatamente o servidor:
  // dia < fechamento → vence mês+1 | dia >= fechamento → vence mês+2
  function calcBillCycle(dateStr: string, closingDay: number): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const month0 = m - 1;
    const monthsToAdd = d < closingDay ? 1 : 2;
    const totalMonths = month0 + monthsToAdd;
    const dueYear = y + Math.floor(totalMonths / 12);
    const dueMonth0 = totalMonths % 12;
    return `${dueYear}-${String(dueMonth0 + 1).padStart(2, "0")}`;
  }

  const addMutation = trpc.creditCard.create.useMutation({
    onSuccess: () => {
      const targetCycle = calcBillCycle(newDate, closingDay);
      const [ty, tm] = targetCycle.split("-");
      const monthNames = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
      const label = `${monthNames[parseInt(tm) - 1]}/${ty}`;

      if (targetCycle !== currentBillCycle) {
        toast.success(`Lançado na fatura de ${label} (conforme a data informada)`);
        // Navega para o mês correto
        setDisplayYear(parseInt(ty));
        setDisplayMonth(parseInt(tm));
      } else {
        toast.success("Gasto lançado na fatura!");
      }

      // Reseta form e fecha
      setNewDescription("");
      setNewAmount("");
      setNewCategory("compras_online");
      setNewDate(new Date().toISOString().slice(0, 10));
      setShowAddForm(false);

      utils.creditCard.listByBillCycle.invalidate();
      utils.creditCard.summaryByBillCycle.invalidate();
    },
    onError: (err) => toast.error("Erro ao lançar: " + err.message),
  });

  function handleAddSubmit() {
    const amount = parseFloat(newAmount.replace(",", "."));
    if (!newDescription.trim() || isNaN(amount) || amount <= 0 || !newDate) {
      toast.error("Preencha todos os campos.");
      return;
    }
    addMutation.mutate({
      date: newDate,
      description: newDescription.trim(),
      amount: amount.toFixed(2),
      category: newCategory,
      installments: 1,
    });
  }

  // Estado de edição inline
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDate, setEditDate] = useState("");

  function startEdit(t: { id: number; description: string; amount: string; category: string; date: string }) {
    setEditingId(t.id);
    setEditDescription(t.description);
    setEditAmount(parseFloat(t.amount).toFixed(2).replace(".", ","));
    setEditCategory(t.category);
    setEditDate(t.date);
  }
  function cancelEdit() { setEditingId(null); }

  const deleteMutation = trpc.creditCard.delete.useMutation({
    onSuccess: () => {
      utils.creditCard.listByBillCycle.invalidate();
      utils.creditCard.summaryByBillCycle.invalidate();
    },
  });

  const updateMutation = trpc.creditCard.update.useMutation({
    onSuccess: () => {
      toast.success("Lançamento atualizado!");
      setEditingId(null);
      utils.creditCard.listByBillCycle.invalidate();
      utils.creditCard.summaryByBillCycle.invalidate();
    },
    onError: () => toast.error("Erro ao atualizar."),
  });

  function saveEdit() {
    if (!editingId) return;
    const amount = parseFloat(editAmount.replace(",", "."));
    if (isNaN(amount) || amount <= 0) { toast.error("Valor inválido."); return; }
    updateMutation.mutate({
      id: editingId,
      description: editDescription,
      amount: amount.toFixed(2),
      category: editCategory,
      date: editDate,
    });
  }

  const limparFaturaMutation = trpc.import.limparFatura.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.deletedCount} lançamentos removidos.`);
      utils.creditCard.listByBillCycle.invalidate();
      utils.creditCard.summaryByBillCycle.invalidate();
    },
    onError: () => toast.error("Erro ao limpar fatura."),
  });

  const paymentQuery = trpc.invoice.getPayment.useQuery({ billCycle: currentBillCycle });
  const payment = paymentQuery.data;

  const [showPayForm, setShowPayForm] = useState(false);
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payAmount, setPayAmount] = useState("");

  const markPaidMutation = trpc.invoice.markPaid.useMutation({
    onSuccess: (data) => {
      if (data.diasAtraso > 0) {
        const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        const [ny, nm] = (data.nextBillCycle ?? "").split("-");
        const mesLabel = nm ? `${meses[parseInt(nm) - 1]}/${ny}` : "";
        toast.success(
          `Fatura paga! ${data.diasAtraso} dias de atraso — R$ ${data.juros.toFixed(2).replace(".", ",")} de juros lançado em ${mesLabel}.`,
          { duration: 6000 }
        );
      } else {
        toast.success("Fatura marcada como paga!");
      }
      setShowPayForm(false);
      utils.invoice.getPayment.invalidate();
      utils.creditCard.listByBillCycle.invalidate();
    },
    onError: () => toast.error("Erro ao registrar pagamento."),
  });

  const unmarkPaidMutation = trpc.invoice.unmarkPaid.useMutation({
    onSuccess: () => {
      toast.success("Pagamento removido.");
      utils.invoice.getPayment.invalidate();
    },
    onError: () => toast.error("Erro ao remover pagamento."),
  });

  function handleMarkPaid() {
    const amount = parseFloat(payAmount.replace(",", "."));
    if (!payDate || isNaN(amount) || amount <= 0) {
      toast.error("Informe data e valor válidos.");
      return;
    }
    markPaidMutation.mutate({
      billCycle: currentBillCycle,
      paidAt: payDate,
      paidAmount: amount.toFixed(2),
    });
  }

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

      {/* Status de Pagamento */}
      {payment ? (
        <Card className="border-0 shadow-sm bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-semibold text-green-800">Fatura Paga</p>
                  <p className="text-xs text-green-600">
                    {formatCurrency(parseFloat(payment.paidAmount))} em {format(new Date(payment.paidAt + "T12:00:00"), "dd/MM/yyyy")}
                  </p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-green-700 hover:text-red-600 text-xs">
                    Desfazer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover confirmação de pagamento?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A fatura voltará ao status "Pendente".
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => unmarkPaidMutation.mutate({ billCycle: currentBillCycle })} className="bg-red-600 hover:bg-red-700">
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div>
          {!showPayForm ? (
            <Button
              onClick={() => { setPayAmount(total.toFixed(2).replace(".", ",")); setShowPayForm(true); }}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
            >
              <Circle className="h-4 w-4 mr-2" />
              Marcar como Paga
            </Button>
          ) : (
            <Card className="border border-green-200 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold text-green-800">Confirmar pagamento</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Data do pagamento</Label>
                    <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs">Valor pago (R$)</Label>
                    <Input
                      type="text"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      placeholder="3.049,41"
                      className="text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleMarkPaid} disabled={markPaidMutation.isPending} className="flex-1 bg-green-600 hover:bg-green-700">
                    {markPaidMutation.isPending ? "Salvando..." : "Confirmar"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowPayForm(false)} className="flex-1">Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Limpar Fatura */}
      {transactions.length > 0 && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full text-red-600 border-red-200 hover:bg-red-50">
              <Eraser className="h-4 w-4 mr-2" />
              Limpar fatura ({transactions.length} lançamentos)
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Limpar fatura de {monthLabel}?</AlertDialogTitle>
              <AlertDialogDescription>
                Todos os {transactions.length} lançamentos desta fatura serão removidos. Use isso antes de re-importar para evitar duplicatas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => limparFaturaMutation.mutate({ billCycle: currentBillCycle })}
                className="bg-red-600 hover:bg-red-700"
              >
                Limpar tudo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

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

      {/* ── Quick-add gasto na fatura ── */}
      {!showAddForm ? (
        <Button
          onClick={() => setShowAddForm(true)}
          variant="outline"
          className="w-full border-dashed border-primary/40 text-primary hover:bg-primary/5 hover:border-primary"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Lançar gasto nesta fatura
        </Button>
      ) : (
        <Card className="border border-primary/30 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-primary" />
              Novo lançamento no cartão
            </p>

            <div>
              <Label className="text-xs text-muted-foreground">Descrição</Label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Ex: Mercado, Netflix, Farmácia..."
                className="mt-1"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                <Input
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="0,00"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Data da compra</Label>
                <Input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Categoria</Label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="mt-1 w-full border border-input rounded-md px-3 py-2 text-sm bg-background"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Preview do billCycle */}
            {newDate && (() => {
              const targetCycle = calcBillCycle(newDate, closingDay);
              const [ty, tm] = targetCycle.split("-");
              const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
              const label = `${monthNames[parseInt(tm) - 1]} ${ty}`;
              const isDiff = targetCycle !== currentBillCycle;
              return (
                <p className={`text-xs flex items-center gap-1.5 ${isDiff ? "text-amber-600 font-semibold" : "text-muted-foreground"}`}>
                  {isDiff ? "⚠️" : "📅"} Será lançado na fatura de <strong>{label}</strong>
                  {isDiff && " (diferente da fatura atual)"}
                </p>
              );
            })()}

            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleAddSubmit}
                disabled={addMutation.isPending}
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                <Check className="h-4 w-4 mr-1.5" />
                {addMutation.isPending ? "Salvando..." : "Confirmar"}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowAddForm(false); setNewDescription(""); setNewAmount(""); }}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-1.5" />
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                  const categoryInfo = categoriesMap[transaction.category];
                  const isParcelated = transaction.installments > 1;
                  const isEditing = editingId === transaction.id;

                  return (
                    <Card key={transaction.id} className="border-0 shadow-sm">
                      <CardContent className="p-3">
                        {isEditing ? (
                          // Formulário de edição inline
                          <div className="space-y-2">
                            <Input
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              placeholder="Descrição"
                              className="text-sm"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <Input
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                                placeholder="Valor"
                                className="text-sm"
                              />
                              <Input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="text-sm"
                              />
                            </div>
                            <select
                              value={editCategory}
                              onChange={(e) => setEditCategory(e.target.value)}
                              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                            >
                              {categoryOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                            <div className="flex gap-2 pt-1">
                              <Button onClick={saveEdit} disabled={updateMutation.isPending} className="flex-1 h-8 bg-teal-600 hover:bg-teal-700 text-xs">
                                <Check className="h-3 w-3 mr-1" />
                                {updateMutation.isPending ? "Salvando..." : "Salvar"}
                              </Button>
                              <Button onClick={cancelEdit} variant="outline" className="flex-1 h-8 text-xs">
                                <X className="h-3 w-3 mr-1" />
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // Visualização normal
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
                              <p className="text-xs text-muted-foreground">{categoryInfo?.label}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <p className="text-sm font-bold">{formatCurrency(parseFloat(transaction.amount))}</p>
                              <Button
                                variant="ghost" size="sm"
                                className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600"
                                onClick={() => startEdit(transaction)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
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
                        )}
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
