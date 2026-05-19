import { useState, useRef } from "react";
import { ChevronLeft, AlertCircle, FileText } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useCategories } from "@/hooks/useCategories";

interface Parcela { atual: number; total: number; }
interface Transacao {
  date: string;
  billCycle?: string;
  amount: number;
  type: "expense" | "income";
  description: string;
  category: string;
  parcela: Parcela | null;
}

const fBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

function chvFatura(t: Transacao): string {
  if (t.billCycle) return t.billCycle;
  const d = new Date(t.date + "T12:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function labelFatura(chv: string): string {
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const [y, m] = chv.split("-");
  return `${meses[parseInt(m) - 1]}/${y}`;
}

const hoje = new Date();
const chvHoje = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

export default function ImportarExtrato() {
  const [, navigate] = useLocation();
  const { categoryOptions } = useCategories();
  const [etapa, setEtapa] = useState<"upload" | "revisao">("upload");
  const [texto, setTexto] = useState("");
  const [dataFatura, setDataFatura] = useState<string | null>(null);
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const inputFileRef = useRef<HTMLInputElement>(null);

  const analisarMutation = trpc.import.analisarTexto.useMutation({
    onSuccess: (data) => {
      if (!data.transactions || data.transactions.length === 0) {
        toast.error("Nenhuma transacao encontrada.");
        return;
      }
      setTransacoes(data.transactions as Transacao[]);
      if (data.dataFatura) {
        const partes = data.dataFatura.split("/");
        if (partes.length === 2) {
          setDataFatura(`${partes[1]}-${partes[0].padStart(2, "0")}`);
        }
      }
      setEtapa("revisao");
      toast.success(`${data.count} lancamentos identificados!`);
    },
    onError: (err) => toast.error("Erro ao analisar: " + err.message),
  });

  const confirmarMutation = trpc.import.confirmarTransacoes.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.importedCount} transacoes importadas!`);
      navigate("/credit-card/faturas");
    },
    onError: (err) => toast.error("Erro ao salvar: " + err.message),
  });

  function handleAnalisar() {
    if (!texto.trim()) return;
    analisarMutation.mutate({ texto });
  }

  function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const conteudo = ev.target?.result as string;
      setTexto(conteudo);
      analisarMutation.mutate({ texto: conteudo });
    };
    reader.readAsText(file);
  }

  function editarCampo(idx: number, campo: keyof Transacao, valor: any) {
    setTransacoes((prev) =>
      prev.map((t, i) =>
        i === idx ? { ...t, [campo]: campo === "amount" ? parseFloat(valor) || 0 : valor } : t
      )
    );
  }

  function removerLinha(idx: number) {
    setTransacoes((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleConfirmar() {
    confirmarMutation.mutate({ billCycle: dataFatura || undefined, transactions: transacoes });
  }

  const faturas = [...new Set(transacoes.map((t) => chvFatura(t)))].sort();
  const totalDesp = transacoes.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalRec = transacoes.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const semCategoria = transacoes.filter((t) => t.type === "expense" && t.category === "compras_online").length;

  if (etapa === "revisao") {
    return (
      <div className="max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => setEtapa("upload")} className="flex items-center gap-2 text-teal-600 mb-2 font-semibold">
              <ChevronLeft size={18} />Voltar
            </button>
            <h1 className="text-2xl font-bold">Revisar Importacao</h1>
            <p className="text-gray-500 text-sm">{transacoes.length} lancamentos em {faturas.length} fatura(s)</p>
          </div>
          <button onClick={handleConfirmar} disabled={confirmarMutation.isPending || transacoes.length === 0}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50">
            {confirmarMutation.isPending ? "Salvando..." : "Confirmar e lancar"}
          </button>
        </div>
        {semCategoria > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl flex items-center gap-2 text-sm text-yellow-800">
            <span className="font-bold">⚠️ {semCategoria} lançamento{semCategoria > 1 ? "s" : ""}</span> classificado{semCategoria > 1 ? "s" : ""} como "Compras Online" — revise se necessário.
          </div>
        )}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: "Despesas", value: fBRL(totalDesp), color: "text-red-600" },
            { label: "Creditos", value: fBRL(totalRec), color: "text-green-600" },
            { label: "Lancamentos", value: String(transacoes.length), color: "text-gray-800" },
            { label: "Faturas", value: String(faturas.length), color: "text-blue-600" },
          ].map((m) => (
            <div key={m.label} className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-400 uppercase mb-1">{m.label}</p>
              <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>
        {faturas.map((fat) => {
          const txFat = transacoes.filter((t) => chvFatura(t) === fat);
          const totalFat = txFat.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
          return (
            <div key={fat} className="bg-white rounded-xl border mb-4 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 flex items-center justify-between border-b">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm">Fatura {labelFatura(fat)}</span>
                  {fat === chvHoje && <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">Atual</span>}
                  {fat > chvHoje && <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">Futura</span>}
                  {fat < chvHoje && <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-0.5 rounded-full">Anterior</span>}
                </div>
                <span className="text-sm font-bold text-red-600">{fBRL(totalFat)}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    {["Data","Descricao","Parcela","Valor","Categoria","Tipo",""].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs text-gray-400 font-bold uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {txFat.map((t) => {
                    const idxGlobal = transacoes.indexOf(t);
                    return (
                      <tr key={idxGlobal} className={`border-b hover:bg-gray-50 ${t.category === "compras_online" && t.type === "expense" ? "bg-yellow-50/40" : ""}`}>
                        <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                          {new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-3 py-2">
                          <input value={t.description} onChange={(e) => editarCampo(idxGlobal, "description", e.target.value)}
                            className="border rounded px-2 py-1 text-xs w-full min-w-[160px]"/>
                        </td>
                        <td className="px-3 py-2">
                          {t.parcela ? <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{t.parcela.atual}/{t.parcela.total}</span> : <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" step="0.01" value={t.amount} onChange={(e) => editarCampo(idxGlobal, "amount", e.target.value)}
                            className={`border rounded px-2 py-1 text-xs w-20 font-bold ${t.type === "income" ? "text-green-600" : "text-red-600"}`}/>
                        </td>
                        <td className="px-3 py-2">
                          <select value={t.category} onChange={(e) => editarCampo(idxGlobal, "category", e.target.value)} className="border rounded px-2 py-1 text-xs max-w-[140px]">
                            {categoryOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select value={t.type} onChange={(e) => editarCampo(idxGlobal, "type", e.target.value)} className="border rounded px-2 py-1 text-xs">
                            <option value="expense">Despesa</option>
                            <option value="income">Receita</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => removerLinha(idxGlobal)} className="bg-red-100 text-red-600 rounded px-2 py-1 text-xs">x</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })}
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={() => setEtapa("upload")} className="border text-gray-600 font-semibold py-2 px-5 rounded-lg">Voltar</button>
          <button onClick={handleConfirmar} disabled={confirmarMutation.isPending || transacoes.length === 0}
            className="bg-teal-600 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50">
            {confirmarMutation.isPending ? "Salvando..." : "Confirmar e lancar tudo"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <button onClick={() => navigate("/")} className="flex items-center gap-2 text-teal-600 mb-6 font-semibold">
        <ChevronLeft size={20} />Voltar
      </button>
      <h1 className="text-2xl font-bold mb-1">Importar Fatura</h1>
      <p className="text-gray-500 text-sm mb-6">Cole o texto da fatura. O Claude identifica todos os lancamentos automaticamente.</p>
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <div>
          <p className="text-sm font-semibold mb-2">Colar texto da fatura</p>
          <p className="text-xs text-gray-400 mb-2">Abra o PDF no navegador, Ctrl+A, Ctrl+C e cole abaixo:</p>
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={10}
            placeholder="DEMONSTRATIVO DE DESPESAS..."
            className="w-full border rounded-lg p-3 text-xs font-mono resize-y"/>
          <button onClick={handleAnalisar} disabled={!texto.trim() || analisarMutation.isPending}
            className="mt-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50">
            {analisarMutation.isPending ? "Claude analisando..." : "Analisar com IA"}
          </button>
        </div>
        <div className="border-t pt-4">
          <p className="text-sm font-semibold mb-2">Upload de arquivo (.txt)</p>
          <div onClick={() => inputFileRef.current?.click()} className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-teal-500">
            <FileText className="mx-auto mb-2 text-teal-600" size={28} />
            <p className="text-sm font-semibold text-gray-600">Clique para selecionar .txt</p>
            <input ref={inputFileRef} type="file" accept=".txt,.csv" onChange={handleArquivo} className="hidden" />
          </div>
        </div>
      </div>
      {analisarMutation.isError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
          <AlertCircle className="text-red-500" size={20} />
          <p className="text-red-700 text-sm">{analisarMutation.error.message}</p>
        </div>
      )}
      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
        <p className="text-xs text-yellow-800"><strong>Dica:</strong> Abra o PDF no Chrome, Ctrl+A, Ctrl+C e cole acima.</p>
      </div>
    </div>
  );
}
