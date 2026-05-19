import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories } from "@/hooks/useCategories";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface CreditCardTransaction {
  id: number;
  date: string;
  description: string;
  category: string;
  amount: string;
  installments: number;
  installmentNumber: number;
}

interface EditCreditCardDialogProps {
  transaction: CreditCardTransaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditCreditCardDialog({
  transaction,
  open,
  onOpenChange,
  onSuccess,
}: EditCreditCardDialogProps) {
  const { categoryOptions } = useCategories();
  const [formData, setFormData] = useState({
    date: transaction?.date || "",
    description: transaction?.description || "",
    category: transaction?.category || "",
    amount: transaction?.amount || "",
  });

  const updateMutation = trpc.creditCard.update.useMutation({
    onSuccess: () => {
      toast.success("Lançamento atualizado com sucesso!");
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast.error(error.message || "Erro ao atualizar lançamento");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transaction) return;

    await updateMutation.mutateAsync({
      id: transaction.id,
      date: formData.date || undefined,
      description: formData.description || undefined,
      category: (formData.category as any) || undefined,
      amount: formData.amount || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle>Editar Lançamento</DialogTitle>
          <DialogDescription>
            Atualize os dados do lançamento de cartão de crédito
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
            />
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Ex: Compra no Supermercado"
            />
          </div>

          <div>
            <Label htmlFor="category">Categoria</Label>
            <Select
              value={formData.category}
              onValueChange={(value) =>
                setFormData({ ...formData, category: value })
              }
            >
              <SelectTrigger id="category">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="amount">Valor (R$)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              placeholder="0.00"
            />
          </div>

          {transaction && transaction.installments > 1 && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Parcelamento:</strong> {transaction.installmentNumber}/{transaction.installments}x
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
