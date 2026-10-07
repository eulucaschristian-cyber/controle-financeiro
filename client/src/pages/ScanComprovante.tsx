import { useState, useRef } from "react";
import { ChevronLeft, Camera, Upload, Loader2, Check, X, Tag, ImagePlus } from "lucide-react";
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

const MAX_FOTOS = 4;

type Foto = { dataUrl: string; base64: string; mimeType: string };
type Item = {
  rawName: string;
  productName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
};

// Reduz a foto do celular (às vezes 8MB+) para caber no limite da API sem perder legibilidade
function comprimirImagem(file: File, maxLado = 2400): Promise<Foto> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler a imagem"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Formato de imagem não suportado"));
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * escala);
        canvas.height = Math.round(img.height * escala);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve({ dataUrl, base64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function ScanComprovante() {
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { categoryOptions } = useCategories();
  const utils = trpc.useUtils();
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [etapa, setEtapa] = useState<"capture" | "revisao">("capture");

  // Campos editáveis após extração
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("compras_online");
  const [paymentMethod, setPaymentMethod] = useState("debito");
  const [store, setStore] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [salvarPrecos, setSalvarPrecos] = useState(true);

  const scanMutation = trpc.import.scanComprovante.useMutation({
    onSuccess: (data) => {
      setDescription(data.description);
      setAmount(data.amount.toFixed(2).replace(".", ","));
      setDate(data.date);
      setCategory(data.category);
      setStore(data.estabelecimento);
      setItens(data.itens);
      setSalvarPrecos(data.itens.length > 0);
      setEtapa("revisao");
      toast.success(`Comprovante lido! ${data.itens.length} itens encontrados.`);
    },
    onError: (err) => toast.error("Erro ao ler comprovante: " + err.message),
  });

  const salvarPrecosMutation = trpc.precos.salvarItens.useMutation();
  const saveDebitMutation = trpc.transactions.create.useMutation();
  const saveCreditMutation = trpc.creditCard.create.useMutation();

  const salvando =
    saveDebitMutation.isPending || saveCreditMutation.isPending || salvarPrecosMutation.isPending;

  async function handleFiles(files: FileList) {
    const livres = MAX_FOTOS - fotos.length;
    const lista = Array.from(files).slice(0, livres);
    if (files.length > livres) toast.warning(`Máximo de ${MAX_FOTOS} fotos por nota.`);
    try {
      const novas = await Promise.all(lista.map((f) => comprimirImagem(f)));
      setFotos((prev) => [...prev, ...novas]);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function abrirSeletor(camera: boolean) {
    if (!inputRef.current) return;
    if (camera) inputRef.current.setAttribute("capture", "environment");
    else inputRef.current.removeAttribute("capture");
    inputRef.current.click();
  }

  function analisar() {
    scanMutation.mutate({ imagens: fotos.map(({ base64, mimeType }) => ({ base64, mimeType })) });
  }

  function atualizarItem(idx: number, patch: Partial<Item>) {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  async function gravarPrecos(): Promise<boolean> {
    const validos = itens.filter((i) => i.productName.trim() && i.unitPrice > 0 && i.totalPrice > 0);
    if (validos.length === 0) return true;
    try {
      const r = await salvarPrecosMutation.mutateAsync({
        store: store.trim() || "Mercado",
        date,
        itens: validos,
      });
      utils.precos.invalidate();
      if (r.ignorados > 0) toast.info(`${r.ignorados} itens já estavam no histórico.`);
      return true;
    } catch (err: any) {
      toast.error("Erro ao salvar preços: " + err.message);
      return false;
    }
  }

  async function handleSoPrecos() {
    if (await gravarPrecos()) {
      toast.success("Preços salvos no histórico!");
      navigate("/precos");
    }
  }

  async function handleSave() {
    const amountNum = parseFloat(amount.replace(",", "."));
    if (!description.trim() || isNaN(amountNum) || amountNum <= 0) {
      toast.error("Preencha descrição e valor.");
      return;
    }

    try {
      if (paymentMethod === "credito") {
        // Cartão de crédito → vai para a fatura (creditCardTransactions)
        await saveCreditMutation.mutateAsync({
          date,
          description: description.trim(),
          amount: amountNum.toFixed(2),
          category: category as any,
          installments: 1,
        });
      } else {
        // Débito, Pix, dinheiro → vai para lançamentos normais
        await saveDebitMutation.mutateAsync({
          date,
          description: description.trim(),
          amount: amountNum.toFixed(2),
          category: category as any,
          paymentMethod: paymentMethod as any,
          installments: 1,
        });
      }
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
      return;
    }

    if (salvarPrecos && itens.length > 0) await gravarPrecos();
    toast.success(paymentMethod === "credito" ? "Lançado na fatura do cartão!" : "Gasto lançado!");
    navigate(paymentMethod === "credito" ? "/credit-card" : "/");
  }

  if (etapa === "revisao") {
    const somaItens = itens.reduce((s, i) => s + i.totalPrice, 0);
    return (
      <div className="max-w-lg space-y-4 pb-24">
        <button
          onClick={() => { setEtapa("capture"); setFotos([]); }}
          className="flex items-center gap-2 text-teal-600 font-semibold"
        >
          <ChevronLeft size={18} /> Novo scan
        </button>
        <h1 className="text-2xl font-bold">Revisar Comprovante</h1>

        {/* Preview das fotos */}
        {fotos.length > 0 && (
          <div className="flex gap-2 overflow-x-auto">
            {fotos.map((f, i) => (
              <img key={i} src={f.dataUrl} alt={`Foto ${i + 1}`} className="h-40 object-contain rounded-xl border" />
            ))}
          </div>
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

        {/* Itens da nota → histórico de preços */}
        {itens.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground uppercase">
                  Itens ({itens.length}) · {fBRL(somaItens)}
                </p>
                <label className="flex items-center gap-2 text-sm font-semibold text-teal-700">
                  <input
                    type="checkbox"
                    checked={salvarPrecos}
                    onChange={(e) => setSalvarPrecos(e.target.checked)}
                    className="h-4 w-4 accent-teal-600"
                  />
                  Salvar preços
                </label>
              </div>
              <div>
                <Label>Mercado</Label>
                <Input value={store} onChange={(e) => setStore(e.target.value)} />
              </div>
              {Math.abs(somaItens - (parseFloat(amount.replace(",", ".")) || 0)) > 0.05 && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
                  A soma dos itens não bate com o total da nota — confira se faltou algum item ou desconto.
                </p>
              )}
              <ul className="divide-y">
                {itens.map((it, i) => (
                  <li key={i} className="py-2 flex gap-2 items-start">
                    <div className="flex-1 min-w-0 space-y-1">
                      <Input
                        value={it.productName}
                        onChange={(e) => atualizarItem(i, { productName: e.target.value })}
                        className="h-8 text-sm font-semibold"
                      />
                      <p className="text-[11px] text-muted-foreground truncate">{it.rawName}</p>
                      <p className="text-xs text-gray-600">
                        {it.unit === "kg"
                          ? `${it.quantity.toLocaleString("pt-BR")} kg × ${fBRL(it.unitPrice)}/kg`
                          : `${it.quantity.toLocaleString("pt-BR")} × ${fBRL(it.unitPrice)}`}
                        {" = "}<span className="font-bold">{fBRL(it.totalPrice)}</span>
                      </p>
                    </div>
                    <button
                      onClick={() => setItens((prev) => prev.filter((_, j) => j !== i))}
                      className="p-1 text-gray-400 hover:text-red-500"
                      aria-label="Remover item"
                    >
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Button
          onClick={handleSave}
          disabled={salvando}
          className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3"
        >
          <Check className="h-4 w-4 mr-2" />
          {salvando ? "Salvando..." : salvarPrecos && itens.length > 0 ? "Lançar gasto e salvar preços" : "Confirmar e lançar"}
        </Button>
        {itens.length > 0 && (
          <Button onClick={handleSoPrecos} disabled={salvando} variant="outline" className="w-full font-semibold">
            <Tag className="h-4 w-4 mr-2" />
            Só salvar preços (gasto já lançado / vem na fatura)
          </Button>
        )}
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
        <p className="text-gray-500 text-sm mt-1">
          Tire foto do comprovante — o Claude extrai os dados e, em notas de mercado, guarda o preço de cada produto.
        </p>
      </div>

      {/* Estado: analisando */}
      {scanMutation.isPending ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-10 flex flex-col items-center gap-4">
            {fotos[0] && (
              <img src={fotos[0].dataUrl} alt="Comprovante" className="w-full max-h-48 object-contain rounded-xl mb-2" />
            )}
            <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
            <p className="text-sm font-semibold text-gray-600">Claude analisando o comprovante...</p>
          </CardContent>
        </Card>
      ) : fotos.length > 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {fotos.map((f, i) => (
              <div key={i} className="relative">
                <img src={f.dataUrl} alt={`Foto ${i + 1}`} className="w-full h-40 object-cover object-top rounded-xl border" />
                <button
                  onClick={() => setFotos((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute top-1 right-1 bg-white/90 rounded-full p-1 shadow"
                  aria-label="Remover foto"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {fotos.length < MAX_FOTOS && (
              <button
                onClick={() => abrirSeletor(true)}
                className="h-40 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-500 hover:bg-gray-50"
              >
                <ImagePlus className="h-6 w-6" />
                <span className="text-xs font-semibold text-center px-2">Mais uma parte da nota</span>
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Nota comprida? Fotografe em partes (de cima para baixo) — numa foto só o texto fica pequeno demais e a leitura erra.
          </p>
          <Button onClick={analisar} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3">
            Analisar nota ({fotos.length} {fotos.length === 1 ? "foto" : "fotos"})
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Botão câmera */}
          <button
            onClick={() => abrirSeletor(true)}
            className="w-full border-2 border-dashed border-teal-400 rounded-2xl p-10 flex flex-col items-center gap-3 hover:border-teal-500 hover:bg-teal-50 transition-all"
          >
            <Camera className="h-12 w-12 text-teal-600" />
            <p className="text-base font-bold text-teal-700">Tirar foto do comprovante</p>
            <p className="text-xs text-gray-400">Abre a câmera do celular</p>
          </button>

          {/* Botão upload */}
          <button
            onClick={() => abrirSeletor(false)}
            className="w-full border-2 border-dashed border-gray-300 rounded-2xl p-6 flex flex-col items-center gap-2 hover:border-gray-400 hover:bg-gray-50 transition-all"
          >
            <Upload className="h-8 w-8 text-gray-400" />
            <p className="text-sm font-semibold text-gray-500">Ou escolher imagem da galeria</p>
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
        className="hidden"
      />

      {scanMutation.isError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {scanMutation.error.message}
        </div>
      )}
    </div>
  );
}
