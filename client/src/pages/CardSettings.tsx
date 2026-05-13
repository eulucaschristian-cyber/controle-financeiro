import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export default function CardSettingsPage() {
  const cardSettingsQuery = trpc.cardSettings.get.useQuery();
  const updateMutation = trpc.cardSettings.update.useMutation({
    onSuccess: () => {
      trpc.useUtils().cardSettings.get.invalidate();
    },
  });

  const [limit, setLimit] = useState<string>("");
  const [closingDay, setClosingDay] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [cardName, setCardName] = useState("");

  useEffect(() => {
    if (cardSettingsQuery.data) {
      setLimit(String(cardSettingsQuery.data.limit));
      setClosingDay(cardSettingsQuery.data.closingDay.toString());
      setDueDay(cardSettingsQuery.data.dueDay.toString());
      setCardName(cardSettingsQuery.data.cardName);
    }
  }, [cardSettingsQuery.data]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      limit: limit,
      closingDay: parseInt(closingDay),
      dueDay: parseInt(dueDay),
      cardName,
    });
  };

  if (cardSettingsQuery.isLoading) {
    return <div className="p-4">Carregando...</div>;
  }

  return (
    <div className="space-y-4 pb-24">
      <h2 className="text-2xl font-bold">Configurações do Cartão</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div>
              <Label htmlFor="cardName">Nome do Cartão</Label>
              <Input
                id="cardName"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="Ex: Porto Seguro"
              />
            </div>

            <div>
              <Label htmlFor="limit">Limite do Cartão</Label>
              <Input
                id="limit"
                type="number"
                step="0.01"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                placeholder="5000.00"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Valor atual: {formatCurrency(parseFloat(limit) || 0)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="closingDay">Dia de Fechamento</Label>
                <Input
                  id="closingDay"
                  type="number"
                  min="1"
                  max="31"
                  value={closingDay}
                  onChange={(e) => setClosingDay(e.target.value)}
                  placeholder="26"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Lançamentos após este dia entram na próxima fatura
                </p>
              </div>

              <div>
                <Label htmlFor="dueDay">Dia de Vencimento</Label>
                <Input
                  id="dueDay"
                  type="number"
                  min="1"
                  max="31"
                  value={dueDay}
                  onChange={(e) => setDueDay(e.target.value)}
                  placeholder="1"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateMutation.isPending ? "Salvando..." : "Salvar Configurações"}
            </Button>

            {updateMutation.isSuccess && (
              <p className="text-sm text-green-600">✓ Configurações salvas com sucesso!</p>
            )}
            {updateMutation.isError && (
              <p className="text-sm text-red-600">✗ Erro ao salvar configurações</p>
            )}
          </CardContent>
        </Card>
      </form>

      <Card className="border-0 shadow-sm bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <CreditCard className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900">Como funciona:</p>
              <ul className="text-xs text-blue-800 mt-2 space-y-1">
                <li>• Lançamentos até o dia {closingDay} entram na fatura atual</li>
                <li>• Lançamentos após o dia {closingDay} entram na próxima fatura</li>
                <li>• A fatura vence no dia {dueDay} do mês seguinte</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
