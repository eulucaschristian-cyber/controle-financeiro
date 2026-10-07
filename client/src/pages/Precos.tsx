import { useEffect, useState } from "react";
import { Search, Loader2, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Trash2, ScanLine } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const fBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fData = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
};

function Variacao({ atual, anterior }: { atual: number; anterior: number }) {
  const pct = ((atual - anterior) / anterior) * 100;
  if (Math.abs(pct) < 0.5) {
    return <span className="inline-flex items-center gap-1 text-xs text-gray-500"><Minus size={12} /> igual</span>;
  }
  const subiu = pct > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${subiu ? "text-red-600" : "text-emerald-600"}`}>
      {subiu ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      {subiu ? "+" : ""}{pct.toFixed(0)}%
    </span>
  );
}

function Historico({ productName, unit }: { productName: string; unit: string }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.precos.historico.useQuery({ productName });
  const excluir = trpc.precos.excluir.useMutation({
    onSuccess: () => {
      utils.precos.invalidate();
      toast.success("Registro removido");
    },
  });

  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-teal-600 mx-auto my-2" />;
  return (
    <ul className="mt-3 divide-y border-t">
      {(data ?? []).map((h) => (
        <li key={h.id} className="py-2 flex items-center gap-2 text-sm">
          <span className="w-16 text-xs text-gray-500">{fData(h.purchaseDate)}</span>
          <span className="flex-1 min-w-0 truncate text-gray-700">{h.store}</span>
          <span className="font-semibold">
            {fBRL(parseFloat(h.unitPrice))}{unit === "kg" ? "/kg" : ""}
          </span>
          <button
            onClick={() => excluir.mutate({ id: h.id })}
            className="p-1 text-gray-300 hover:text-red-500"
            aria-label="Excluir registro"
          >
            <Trash2 size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function Precos() {
  const [, navigate] = useLocation();
  const [termo, setTermo] = useState("");
  const [termoBusca, setTermoBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setTermoBusca(termo), 250);
    return () => clearTimeout(t);
  }, [termo]);

  const { data, isLoading } = trpc.precos.buscar.useQuery({ termo: termoBusca });

  return (
    <div className="max-w-lg space-y-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Preços de Mercado</h1>
        <p className="text-gray-500 text-sm mt-1">Quanto você pagou da última vez em cada produto.</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={termo}
          onChange={(e) => setTermo(e.target.value)}
          placeholder="Buscar produto (ex: leite, arroz 5kg)"
          className="pl-9 h-11"
          autoFocus
        />
      </div>

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-teal-600 mx-auto mt-8" />
      ) : !data || data.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-sm text-gray-500">
              {termoBusca ? `Nenhum produto encontrado para "${termoBusca}".` : "Nenhum preço registrado ainda."}
            </p>
            {!termoBusca && (
              <Button onClick={() => navigate("/scan")} className="bg-teal-600 hover:bg-teal-700 text-white">
                <ScanLine className="h-4 w-4 mr-2" /> Escanear uma nota de mercado
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.map((p) => {
            const sufixo = p.unit === "kg" ? "/kg" : "";
            const expandido = aberto === p.productName;
            return (
              <Card key={p.productName} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <button
                    onClick={() => setAberto(expandido ? null : p.productName)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{p.productName}</p>
                        <p className="text-xs text-gray-500">
                          {p.ultimo.store} · {fData(p.ultimo.date)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-teal-700">{fBRL(p.ultimo.preco)}{sufixo}</p>
                        {p.anterior && <Variacao atual={p.ultimo.preco} anterior={p.anterior.preco} />}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                      <span>
                        {p.menor.preco < p.ultimo.preco
                          ? `Menor: ${fBRL(p.menor.preco)}${sufixo} no ${p.menor.store} (${fData(p.menor.date)})`
                          : p.compras > 1 ? "Último é o menor preço registrado" : "1 compra registrada"}
                      </span>
                      {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </div>
                  </button>
                  {expandido && <Historico productName={p.productName} unit={p.unit} />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
