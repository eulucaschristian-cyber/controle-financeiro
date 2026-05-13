import { trpc } from "@/lib/trpc";
import { CATEGORY_OPTIONS, PAYMENT_METHOD_OPTIONS } from "@shared/categories";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, Check, CreditCard } from "lucide-react";
import { format } from "date-fns";

export default function AddTransaction() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const today = format(new Date(), "yyyy-MM-dd");
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("debito");
  const [installments, setInstallments] = useState(1);

  const createMutation = trpc.transactions.create.useMutation({
    onSuccess: (data) => {
      utils.transactions.list.invalidate();
      utils.dashboard.summary.invalidate();
      if (installments > 1) {
        toast.success(`Gasto parcelado em ${installments}x registrado com sucesso!`);
      } else {
        toast.success("Gasto registrado com sucesso!");
      }
      setLocation("/");
    },
    onError: (err) => {
      toast.error("Erro ao registrar gasto: " + err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !description.trim() || !category || !amount || !paymentMethod) {
      toast.error("Preencha todos os campos!");
      return;
    }

    const numAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Valor inválido!");
      return;
    }

    createMutation.mutate({
      date,
      description: description.trim(),
      category: category as any,
      amount: numAmount.toFixed(2),
      paymentMethod: paymentMethod as any,
      installments: paymentMethod === "credito" ? installments : 1,
    });
  };

  const isCredit = paymentMethod === "credito";
  const installmentOptions = Array.from({ length: 12 }, (_, i) => i + 1);

  // Calculate installment value preview
  const numAmount = parseFloat(amount.replace(",", "."));
  const installmentValue = !isNaN(numAmount) && numAmount > 0 && installments > 1
    ? (numAmount / installments).toFixed(2)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold">Novo Gasto</h2>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Valor - Destaque Principal */}
            <div className="text-center py-4">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor Total</Label>
              <div className="flex items-center justify-center gap-1 mt-2">
                <span className="text-2xl font-bold text-muted-foreground">R$</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="text-4xl font-bold text-center border-0 shadow-none focus-visible:ring-0 p-0 h-auto max-w-48"
                  autoFocus
                />
              </div>
              {installmentValue && (
                <p className="text-sm text-primary font-medium mt-2">
                  {installments}x de R$ {installmentValue}
                </p>
              )}
            </div>

            {/* Método de Pagamento */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Forma de Pagamento</Label>
              <div className="grid grid-cols-4 gap-2">
                {PAYMENT_METHOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(opt.value);
                      if (opt.value !== "credito") setInstallments(1);
                    }}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center ${
                      paymentMethod === opt.value
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-transparent bg-muted/50 hover:bg-muted"
                    }`}
                  >
                    <span className="text-lg">{opt.label.split(" ")[0]}</span>
                    <span className="text-xs font-medium">{opt.label.split(" ").slice(1).join(" ")}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Parcelamento - Só aparece quando é Crédito */}
            {isCredit && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5" />
                  Parcelamento
                </Label>
                <div className="grid grid-cols-6 gap-1.5">
                  {installmentOptions.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setInstallments(n)}
                      className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
                        installments === n
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-muted/50 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {n}x
                    </button>
                  ))}
                </div>
                {installmentValue && (
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    Cada parcela: R$ {installmentValue} por mês
                  </p>
                )}
              </div>
            )}

            {/* Data */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-12"
              />
            </div>

            {/* Descrição */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição</Label>
              <Input
                type="text"
                placeholder="Ex: Almoço no restaurante"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="h-12"
              />
            </div>

            {/* Categoria */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="h-11">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? (
                "Salvando..."
              ) : (
                <>
                  <Check className="h-5 w-5 mr-2" />
                  {isCredit && installments > 1
                    ? `Salvar ${installments}x Parcelas`
                    : "Salvar Gasto"
                  }
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
