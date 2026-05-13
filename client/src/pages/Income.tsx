import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, DollarSign, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function Income() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [date, setDate] = useState(format(now, "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("comissão");

  const incomeListQuery = trpc.income.list.useQuery({ year, month });
  const incomeSummaryQuery = trpc.income.summary.useQuery({ year, month });
  const utils = trpc.useUtils();

  const createMutation = trpc.income.create.useMutation({
    onSuccess: () => {
      utils.income.list.invalidate();
      utils.income.summary.invalidate();
      setDescription("");
      setAmount("");
      setDate(format(now, "yyyy-MM-dd"));
    },
  });

  const deleteMutation = trpc.income.delete.useMutation({
    onSuccess: () => {
      utils.income.list.invalidate();
      utils.income.summary.invalidate();
    },
  });

  const incomeList = incomeListQuery.data ?? [];
  const incomeSummary = incomeSummaryQuery.data;

  const navigateMonth = (direction: number) => {
    let newMonth = month + direction;
    let newYear = year;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    if (newMonth < 1) { newMonth = 12; newYear--; }
    setMonth(newMonth);
    setYear(newYear);
  };

  const monthLabel = format(new Date(year, month - 1), "MMMM yyyy", { locale: ptBR });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    createMutation.mutate({
      date,
      description,
      amount,
      source: source as "comissão" | "salário" | "freelance" | "outro",
    });
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold capitalize">{monthLabel}</h2>
        <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {incomeSummary && (
        <Card className="border-0 shadow-sm bg-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Renda Total</p>
                <p className="text-2xl font-bold mt-1 text-blue-600">
                  {formatCurrency(parseFloat(incomeSummary.total))}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {incomeSummary.count} entrada{incomeSummary.count > 1 ? "s" : ""}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full flex items-center justify-center bg-blue-100">
                <DollarSign className="h-6 w-6 text-blue-600" />
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
              <Label htmlFor="source" className="text-xs font-medium">Fonte</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger id="source" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comissão">Comissão</SelectItem>
                  <SelectItem value="salário">Salário</SelectItem>
                  <SelectItem value="freelance">Freelance</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description" className="text-xs font-medium">Descrição</Label>
              <Input
                id="description"
                placeholder="Ex: Comissão venda"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1"
              />
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

            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              {createMutation.isPending ? "Adicionando..." : "Adicionar Renda"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Entradas</p>
        {incomeList.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-8 text-center">
              <DollarSign className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma entrada registrada neste mês.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {incomeList.map((income) => (
              <Card key={income.id} className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{income.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(income.date + "T00:00:00"), "dd 'de' MMMM", { locale: ptBR })} • {income.source}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-bold text-green-600">
                      +{formatCurrency(parseFloat(income.amount))}
                    </p>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Deletar entrada?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja deletar esta entrada de renda?
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate({ id: income.id })}
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
    </div>
  );
}
