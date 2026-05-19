import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, Save, Plus, Trash2, Tag } from "lucide-react";
import { useLocation } from "wouter";
import { useCategories } from "@/hooks/useCategories";
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

const EMOJI_OPTIONS = ["🛒","🏠","🚗","✈️","🎮","🎵","🍕","👗","💊","📚","🏋️","🐾","💼","🎁","🔧","💈","🌿","🏖️","🎯","⚽","🎬","🍺","☕","🧴","🎨","🏥","🚕","🛵","🌟","💡"];
const COLOR_OPTIONS = [
  { label: "Cinza", value: "bg-gray-100 text-gray-700" },
  { label: "Azul", value: "bg-blue-100 text-blue-700" },
  { label: "Verde", value: "bg-green-100 text-green-700" },
  { label: "Roxo", value: "bg-purple-100 text-purple-700" },
  { label: "Laranja", value: "bg-orange-100 text-orange-700" },
  { label: "Rosa", value: "bg-pink-100 text-pink-700" },
  { label: "Amarelo", value: "bg-yellow-100 text-yellow-700" },
  { label: "Vermelho", value: "bg-red-100 text-red-700" },
  { label: "Ciano", value: "bg-cyan-100 text-cyan-700" },
  { label: "Índigo", value: "bg-indigo-100 text-indigo-700" },
];

export default function Settings() {
  const [, setLocation] = useLocation();
  const settingsQuery = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();
  const { customList } = useCategories();

  const [dailyBudget, setDailyBudget] = useState("");

  // Novo formulário de categoria
  const [newLabel, setNewLabel] = useState("");
  const [newEmoji, setNewEmoji] = useState("🛒");
  const [newColor, setNewColor] = useState("bg-gray-100 text-gray-700");
  const [showAddForm, setShowAddForm] = useState(false);

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
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const createCategoryMutation = trpc.customCategories.create.useMutation({
    onSuccess: () => {
      utils.customCategories.list.invalidate();
      toast.success("Categoria criada!");
      setNewLabel("");
      setNewEmoji("🛒");
      setNewColor("bg-gray-100 text-gray-700");
      setShowAddForm(false);
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const deleteCategoryMutation = trpc.customCategories.delete.useMutation({
    onSuccess: () => {
      utils.customCategories.list.invalidate();
      toast.success("Categoria removida.");
    },
    onError: (err) => toast.error("Erro: " + err.message),
  });

  const handleSaveBudget = () => {
    const num = parseFloat(dailyBudget.replace(",", "."));
    if (isNaN(num) || num <= 0) { toast.error("Valor inválido!"); return; }
    updateMutation.mutate({ dailyBudget: num.toFixed(2) });
  };

  const handleCreateCategory = () => {
    if (!newLabel.trim()) { toast.error("Digite o nome da categoria."); return; }
    createCategoryMutation.mutate({ label: newLabel.trim(), emoji: newEmoji, color: newColor });
  };

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center gap-3 pt-2">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold">Configurações</h2>
      </div>

      {/* Teto Diário */}
      <Card className="border border-border/40 shadow-sm rounded-2xl">
        <CardContent className="p-4 space-y-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Teto Diário</p>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Valor máximo de gastos por dia (R$)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
              placeholder="66.00"
              className="h-11 text-base font-semibold"
            />
          </div>
          <Button onClick={handleSaveBudget} className="w-full" disabled={updateMutation.isPending}>
            <Save className="h-4 w-4 mr-2" />
            {updateMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </CardContent>
      </Card>

      {/* Categorias Customizadas */}
      <Card className="border border-border/40 shadow-sm rounded-2xl">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Categorias</p>
              <p className="text-xs text-muted-foreground mt-0.5">Crie suas próprias categorias de gasto</p>
            </div>
            <Button
              size="sm"
              variant={showAddForm ? "outline" : "default"}
              onClick={() => setShowAddForm(!showAddForm)}
              className="h-8 text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nova
            </Button>
          </div>

          {/* Formulário de criação */}
          {showAddForm && (
            <div className="rounded-xl border border-border/60 p-4 space-y-4 bg-muted/30">
              <p className="text-sm font-semibold">Nova categoria</p>

              <div>
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Ex: Viagem, Beleza, Presente..."
                  className="mt-1"
                  autoFocus
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Emoji</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {EMOJI_OPTIONS.map((e) => (
                    <button
                      key={e}
                      onClick={() => setNewEmoji(e)}
                      className={`h-9 w-9 flex items-center justify-center rounded-lg text-lg border-2 transition-all
                        ${newEmoji === e ? "border-primary bg-primary/10" : "border-transparent bg-muted hover:border-border"}`}
                    >
                      {e}
                    </button>
                  ))}
                  {/* Emoji customizado */}
                  <input
                    value={EMOJI_OPTIONS.includes(newEmoji) ? "" : newEmoji}
                    onChange={(e) => { if (e.target.value) setNewEmoji(e.target.value.slice(-2)); }}
                    placeholder="✏️"
                    className="h-9 w-16 text-center text-lg border rounded-lg bg-muted focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Cor</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setNewColor(c.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${c.value}
                        ${newColor === c.value ? "border-foreground/40 scale-105" : "border-transparent"}`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-2 p-3 rounded-xl bg-card border border-border/40">
                <span className="text-xs text-muted-foreground">Preview:</span>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${newColor}`}>
                  {newEmoji} {newLabel || "Nome da categoria"}
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleCreateCategory}
                  disabled={createCategoryMutation.isPending}
                  className="flex-1"
                >
                  {createCategoryMutation.isPending ? "Criando..." : "Criar categoria"}
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Lista de categorias customizadas */}
          {customList.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Suas categorias ({customList.length})</p>
              {customList.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/30">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cat.color}`}>
                    {cat.emoji} {cat.label}
                  </span>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover categoria "{cat.label}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          A categoria será removida. Lançamentos existentes com essa categoria não serão afetados.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteCategoryMutation.mutate({ id: cat.id })}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Tag className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma categoria customizada ainda</p>
              <p className="text-xs mt-1">Clique em "Nova" para criar a sua primeira</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
