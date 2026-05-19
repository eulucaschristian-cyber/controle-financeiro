import { type CategoryKey } from "@shared/categories";
import { useCategories } from "@/hooks/useCategories";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, CreditCard, ChevronLeft, ChevronRight, Edit2 } from "lucide-react";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EditCreditCardDialog } from "@/components/EditCreditCardDialog";
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

function getCurrentBillCycle(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

function getNextBillCycle(): string {
  const now = new Date();
  now.setMonth(now.getMonth() + 1);
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `${year}-${String(month).padStart(2, "0")}`;
}

export default function CreditCardPage() {
  const now = new Date();
  const { categoryOptions } = useCategories();
  const [date, setDate] = useState(format(now, "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<CategoryKey>("compras_online");
  const [installments, setInstallments] = useState("1");
  const [billCycle, setBillCycle] = useState(getCurrentBillCycle());
  const [editingTransaction, setEditingTransaction] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const cardSettingsQuery = trpc.cardSettings.get.useQuery();
  const creditCardQuery = trpc.creditCard.listByBillCycle.useQuery({ billCycle });
  const creditCardSummaryQuery = trpc.creditCard.summaryByBillCycle.useQuery({ billCycle });
  const utils = trpc.useUtils();

  const createMutation = trpc.creditCard.create.useMutation({
    onSuccess: () => {
      utils.creditCard.listByBillCycle.invalidate();
      utils.creditCard.summaryByBillCycle.invalidate();
      setDescription("");
      setAmount("");
      setCategory("compras_online");
      setInstallments("1");
      setDate(format(now, "yyyy-MM-dd"));
    },
  });

  const deleteMutation = trpc.creditCard.delete.useMutation({
    onSuccess: () => {
      utils.creditCard.listByBillCycle.invalidate();
      utils.creditCard.summaryByBillCycle.invalidate();
    },
  });

  const cardSettings = cardSettingsQuery.data;
  const creditCardList = creditCardQuery.data ?? [];
  const creditCardSummary = creditCardSummaryQuery.data;

  const billCycles = useMemo(() => {
    const current = getCurrentBillCycle();
    const next = getNextBillCycle();
    return [
      { value: current, label: `Fatura Atual (${current})` },
      { value: next, label: `Próxima Fatura (${next})` },
    ];
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    const parsedInstallments = parseInt(installments);
    console.log('Enviando compra:', { date, description, amount, category, installments: parsedInstallments });
    
    createMutation.mutate({
      date,
      description,
      amount,
      category,
      installments: parsedInstallments,
    }, {
      onSuccess: () => {
        // Reset form after successful submission
        setDescription("");
        setAmount("");
        setCategory("compras_online");
        setInstallments("1");
        setDate(format(new Date(), "yyyy-MM-dd"));
      }
    });
  };

  const closingDay = cardSettings?.closingDay ?? 26;
  const dueDay = cardSettings?.dueDay ?? 1;
  const limit = cardSettings?.limit ? parseFloat(cardSettings.limit) : 5000;
  const used = creditCardSummary ? parseFloat(creditCardSummary.total) : 0;
  const available = limit - used;

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cartão de Crédito</h2>
      </div>

      {cardSettings && (
        <Card className="border-0 shadow-sm bg-purple-50">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Limite Disponível</p>
                  <p className={`text-2xl font-bold mt-1 ${available >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(available)}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-full flex items-center justify-center bg-purple-100">
                  <CreditCard className="h-6 w-6 text-purple-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Limite Total</p>
                  <p className="font-semibold">{formatCurrency(limit)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Utilizado</p>
                  <p className="font-semibold">{formatCurrency(used)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Fechamento</p>
                  <p className="font-semibold">Dia {closingDay}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Vencimento</p>
                  <p className="font-semibold">Dia {dueDay}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label htmlFor="date" className="text-xs font-medium">Data</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="description" className="text-xs font-medium">Descrição</Label>
              <Input
                id="description"
                placeholder="Ex: Supermercado"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="category" className="text-xs font-medium">Categoria</Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryKey)}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
              >
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="amount" className="text-xs font-medium">Valor</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="installments" className="text-xs font-medium">Parcelamento</Label>
              <input
                type="number"
                id="installments"
                min="1"
                max="12"
                value={installments}
                onChange={(e) => {
                  console.log('Input changed:', e.target.value);
                  setInstallments(e.target.value);
                }}
                className="w-full mt-1 px-3 py-2 border rounded-md text-sm"
                placeholder="Número de parcelas"
              />
            </div>

            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              {createMutation.isPending ? "Adicionando..." : "Adicionar Compra"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Compras - {billCycle}
        </p>
        {creditCardList.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8 text-center">
              <CreditCard className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma compra registrada nesta fatura.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {creditCardList.map((transaction) => (
              <Card key={transaction.id} className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{transaction.description}</p>
                      {transaction.installments > 1 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                          {transaction.installmentNumber}/{transaction.installments}x
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {transaction.category} • {format(new Date(transaction.date + "T00:00:00"), "dd 'de' MMMM", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold">
                      {formatCurrency(parseFloat(transaction.amount))}
                    </p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingTransaction(transaction);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Edit2 className="h-4 w-4 text-blue-600" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Deletar compra?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja deletar esta compra do cartão?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate({ id: transaction.id })}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Deletar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <EditCreditCardDialog
        transaction={editingTransaction}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={() => {
          utils.creditCard.listByBillCycle.invalidate();
          utils.creditCard.summaryByBillCycle.invalidate();
        }}
      />
    </div>
  );
}
