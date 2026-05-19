import { useState, useRef } from "react";
import { ChevronLeft, Camera, Upload, Loader2, Check } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { PAYMENT_METHOD_OPTIONS } from "@shared/categories";
import { useCategories } from "@/hooks/useCategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const fBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function ScanComprovante() {
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { categoryOptions } = useCategories();
  const [preview, setPreview] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<"capture" | "revisao">("capture");

  // Campos editáveis após extração
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("compras_online");
  const [paymentMethod, setPaymentMethod] = useState("debito");
  const [itens, setItens] = useState<string[]>([]);

  const scanMutation = trpc.import.scanComprovante.useMutation({
    onSuccess: (data) => {
      setDescription(data.description);
      setAmount(data.amount.toFixed(2).replace(".", ","));
      setDate(data.date);
      setCategory(data.category);
      setItens(data.itens);
      setEtapa("revisao");
      toast.success("Comprovante lido com sucesso!");
    },
    onError: (err) => toast.error("Erro ao ler comprovante: " + err.message),
  });

  const saveDebitMutation = trpc.transactions.create.useMutation({
    onSuccess: () => {
      toast.success("Gasto lançado!");
      navigate("/");
    },
    onError: (err) => toast.error("Erro ao salvar: " + err.message),
  });

  const saveCreditMutation = trpc.creditCard.create.useMutation({
    onSuccess: () => {
      toast.success("Lançado na fatura do cartão!");
      navigate("/credit-card");
    },
    onError: (err) => toast.error("Erro ao salvar: " + err.message),
  });

  const saveMutation = {
    isPending: saveDebitMutation.isPending || saveCreditMutation.isPending,
  };

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);

      // Extrai base64 puro (sem o prefixo "data:image/jpeg;base64,")
      const [header, base64] = dataUrl.split(",");
      const mimeType = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
      scanMutation.mutate({ imageBase64: base64, mimeType });
    };
    reader.readAsDataURL(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleSave() {
    const amountNum = parseFloat(amount.replace(",", "."));
    if (!description.trim() || isNaN(amountNum) || amountNum <= 0) {
      toast.error("Preencha descrição e valor.");
      return;
    }

    if (paymentMethod === "credito") {
      // Cartão de crédito → vai para a fatura (creditCardTransactions)
      saveCreditMutation.mutate({
        date,
        description: description.trim(),
        amount: amountNum.toFixed(2),
        category: category as any,
        installments: 1,
      });
    } else {
      // Débito, Pix, dinheiro → vai para lançamentos normais
      saveDebitMutation.mutate({
        date,
        description: description.trim(),
        amount: amountNum.toFixed(2),
        category: category as any,
        paymentMethod: paymentMethod as any,
        installments: 1,
      });
    }
  }

  if (etapa === "revisao") {
    return (
      <div className="max-w-lg space-y-4 pb-24">
        <button onClick={() => setEtapa("capture")} className="flex items-center gap-2 text-teal-600 font-semibold">
          <ChevronLeft size={18} /> Novo scan
        </button>
        <h1 className="text-2xl font-bold">Revisar Comprovante</h1>

        {/* Preview da foto */}
        {preview && (
          <img src={preview} alt="Comprovante" className="w-full max-h-48 object-contain rounded-xl border" />
        )}

        {/* Itens identificados */}
        {itens.length > 0 && (
          <Card className="border-0 shadow-sm bg-gray-50">
            <CardContent className="p-4">
              <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Itens identificados</p>
              <ul className="space-y-1">
                {itens.map((item, i) => (
                  <li key={i} className="text-xs text-gray-600">• {item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Formulário de edição */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-4">
            <div>
              <Label>Descrição</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <Label>Data</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background mt-1"
              >
                {categoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Forma de Pagamento</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {PAYMENT_METHOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPaymentMethod(opt.value)}
                    className={`p-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      paymentMethod === opt.value
                        ? "border-teal-500 bg-teal-50 text-teal-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3"
        >
          <Check className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? "Salvando..." : "Confirmar e lançar"}
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6 pb-24">
      <button onClick={() => navigate("/")} className="flex items-center gap-2 text-teal-600 font-semibold">
        <ChevronLeft size={20} /> Voltar
      </button>
      <div>
        <h1 className="text-2xl font-bold">Scan de Comprovante</h1>
        <p className="text-gray-500 text-sm mt-1">Tire foto do comprovante — o Claude extrai os dados automaticamente.</p>
      </div>

      {/* Estado: analisando */}
      {scanMutation.isPending ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-10 flex flex-col items-center gap-4">
            {preview && (
              <img src={preview} alt="Comprovante" className="w-full max-h-48 object-contain rounded-xl mb-2" />
            )}
            <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
            <p className="text-sm font-semibold text-gray-600">Claude analisando o comprovante...</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {/* Botão câmera */}
          <button
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.setAttribute("capture", "environment");
                inputRef.current.click();
              }
            }}
            className="w-full border-2 border-dashed border-teal-400 rounded-2xl p-10 flex flex-col items-center gap-3 hover:border-teal-500 hover:bg-teal-50 transition-all"
          >
            <Camera className="h-12 w-12 text-teal-600" />
            <p className="text-base font-bold text-teal-700">Tirar foto do comprovante</p>
            <p className="text-xs text-gray-400">Abre a câmera do celular</p>
          </button>

          {/* Botão upload */}
          <button
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.removeAttribute("capture");
                inputRef.current.click();
              }
            }}
            className="w-full border-2 border-dashed border-gray-300 rounded-2xl p-6 flex flex-col items-center gap-2 hover:border-gray-400 hover:bg-gray-50 transition-all"
          >
            <Upload className="h-8 w-8 text-gray-400" />
            <p className="text-sm font-semibold text-gray-500">Ou escolher imagem da galeria</p>
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      )}

      {scanMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {scanMutation.error.message}
        </div>
      )}
    </div>
  );
}
