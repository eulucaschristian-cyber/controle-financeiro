import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, Save } from "lucide-react";
import { useLocation } from "wouter";

export default function Settings() {
  const [, setLocation] = useLocation();
  const settingsQuery = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();

  const [dailyBudget, setDailyBudget] = useState("");

  useEffect(() => {
    if (settingsQuery.data) {
      setDailyBudget(settingsQuery.data.dailyBudget);
    }
  }, [settingsQuery.data]);

  const updateMutation = trpc.settings.update.useMutation({
    onSuccess: () => {
      utils.settings.get.invalidate();
      utils.dashboard.summary.invalidate();
      toast.success("Teto diário atualizado!");
    },
    onError: (err) => {
      toast.error("Erro: " + err.message);
    },
  });

  const handleSave = () => {
    const num = parseFloat(dailyBudget.replace(",", "."));
    if (isNaN(num) || num <= 0) {
      toast.error("Valor inválido!");
      return;
    }
    updateMutation.mutate({ dailyBudget: num.toFixed(2) });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold">Configurações</h2>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-4 space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Teto Diário (R$)
            </Label>
            <Input
              type="text"
              inputMode="decimal"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
              placeholder="66.00"
              className="h-12 text-lg font-semibold"
            />
            <p className="text-xs text-muted-foreground">
              Este é o valor máximo que você pode gastar por dia em gastos variáveis.
              O saldo acumulado será calculado com base neste valor.
            </p>
          </div>

          <Button
            onClick={handleSave}
            className="w-full h-12 text-base font-semibold"
            disabled={updateMutation.isPending}
          >
            <Save className="h-5 w-5 mr-2" />
            Salvar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
