import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Download } from "lucide-react";
import { trpc } from "@/lib/trpc";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function getMonthName(month: number, year: number): string {
  const date = new Date(year, month - 1);
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function generatePDF(monthName: string, currentIncome: number, currentExpenses: number, currentCreditCard: number, totalExpenses: number, balance: number) {
  // Criar conteúdo HTML para o PDF
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Relatório - ${monthName}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; text-align: center; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .card { padding: 15px; border-radius: 5px; }
        .income { background-color: #e8f5e9; }
        .expenses { background-color: #ffebee; }
        .balance { background-color: #e3f2fd; }
        .label { font-weight: bold; color: #666; font-size: 12px; }
        .value { font-size: 24px; font-weight: bold; margin-top: 10px; }
        .breakdown { margin-top: 20px; }
        .breakdown-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
      </style>
    </head>
    <body>
      <h1>Relatório Financeiro - ${monthName}</h1>
      
      <div class="section summary">
        <div class="card income">
          <div class="label">💰 Renda Total</div>
          <div class="value">R$ ${currentIncome.toFixed(2).replace('.', ',')}</div>
        </div>
        <div class="card expenses">
          <div class="label">💸 Gastos Totais</div>
          <div class="value">R$ ${totalExpenses.toFixed(2).replace('.', ',')}</div>
        </div>
      </div>
      
      <div class="section">
        <div class="card balance">
          <div class="label">${balance >= 0 ? '✅ Saldo Positivo' : '⚠️ Saldo Negativo'}</div>
          <div class="value">R$ ${balance.toFixed(2).replace('.', ',')}</div>
        </div>
      </div>
      
      <div class="section breakdown">
        <h3>Detalhamento de Gastos</h3>
        <div class="breakdown-item">
          <span>Gastos em Dinheiro/PIX:</span>
          <strong>R$ ${currentExpenses.toFixed(2).replace('.', ',')}</strong>
        </div>
        <div class="breakdown-item">
          <span>Gastos no Cartão:</span>
          <strong>R$ ${currentCreditCard.toFixed(2).replace('.', ',')}</strong>
        </div>
        <div class="breakdown-item">
          <span>Percentual Gasto da Renda:</span>
          <strong>${currentIncome > 0 ? ((totalExpenses / currentIncome) * 100).toFixed(1) : 0}%</strong>
        </div>
      </div>
      
      <div style="margin-top: 40px; text-align: center; color: #999; font-size: 12px;">
        <p>Relatório gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
      </div>
    </body>
    </html>
  `;
  
  // Criar blob e download
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `relatorio-${monthName.toLowerCase().replace(' ', '-')}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Fetch income data
  const incomeQuery = trpc.income.list.useQuery({
    year: currentYear,
    month: currentMonth,
  });
  const expensesQuery = trpc.transactions.list.useQuery({
    year: currentYear,
    month: currentMonth,
  });
  const creditCardQuery = trpc.creditCard.listByBillCycle.useQuery({
    billCycle: `${currentYear}-${String(currentMonth).padStart(2, "0")}`,
  });

  // Calculate monthly data
  const monthlyData = useMemo(() => {
    if (!incomeQuery.data || !expensesQuery.data) return [];

    const months: Record<string, { month: string; income: number; expenses: number; creditCard: number }> = {};

    // Process income
    incomeQuery.data.forEach((income) => {
      const date = new Date(income.date);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const key = `${year}-${String(month).padStart(2, "0")}`;

      if (!months[key]) {
        months[key] = {
          month: getMonthName(month, year),
          income: 0,
          expenses: 0,
          creditCard: 0,
        };
      }

      months[key].income += parseFloat(income.amount);
    });

    // Process expenses
    expensesQuery.data.forEach((expense) => {
      const date = new Date(expense.date);
      const month = date.getMonth() + 1;
      const year = date.getFullYear();
      const key = `${year}-${String(month).padStart(2, "0")}`;

      if (!months[key]) {
        months[key] = {
          month: getMonthName(month, year),
          income: 0,
          expenses: 0,
          creditCard: 0,
        };
      }

      months[key].expenses += parseFloat(expense.amount);
    });

    // Process credit card transactions
    if (creditCardQuery.data) {
      creditCardQuery.data.forEach((transaction) => {
        const date = new Date(transaction.date);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        const key = `${year}-${String(month).padStart(2, "0")}`;

        if (!months[key]) {
          months[key] = {
            month: getMonthName(month, year),
            income: 0,
            expenses: 0,
            creditCard: 0,
          };
        }

        months[key].creditCard += parseFloat(transaction.amount);
      });
    }

    return Object.values(months).sort((a, b) => {
      const aDate = new Date(a.month);
      const bDate = new Date(b.month);
      return aDate.getTime() - bDate.getTime();
    });
  }, [incomeQuery.data, expensesQuery.data, creditCardQuery.data]);

  // Get current month data
  const currentMonthData = monthlyData.find((d) => d.month.includes(currentYear.toString()));
  const currentIncome = currentMonthData?.income || 0;
  const currentExpenses = currentMonthData?.expenses || 0;
  const currentCreditCard = currentMonthData?.creditCard || 0;
  const totalExpenses = currentExpenses + currentCreditCard;
  const balance = currentIncome - totalExpenses;

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const isLoading = incomeQuery.isLoading || expensesQuery.isLoading || creditCardQuery.isLoading;

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">📊 Relatórios</h1>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" size="sm" onClick={handlePrevMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-lg font-semibold min-w-48 text-center">
          {getMonthName(currentMonth, currentYear)}
        </span>
        <Button variant="outline" size="sm" onClick={handleNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Download Button */}
      <div className="flex justify-end">
        <Button 
          onClick={() => generatePDF(
            getMonthName(currentMonth, currentYear),
            currentIncome,
            currentExpenses,
            currentCreditCard,
            totalExpenses,
            balance
          )}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Download className="h-4 w-4 mr-2" />
          Baixar Relatório (HTML)
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-green-50 to-green-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">💰 Renda Total</p>
                <p className="text-2xl font-bold text-green-900 mt-2">{formatCurrency(currentIncome)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-red-50 to-red-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700 font-medium">💸 Gastos Totais</p>
                <p className="text-2xl font-bold text-red-900 mt-2">{formatCurrency(totalExpenses)}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Balance Card */}
      <Card className={`border-0 shadow-sm ${balance >= 0 ? "bg-gradient-to-br from-blue-50 to-blue-100" : "bg-gradient-to-br from-orange-50 to-orange-100"}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium ${balance >= 0 ? "text-blue-700" : "text-orange-700"}`}>
                {balance >= 0 ? "✅ Saldo Positivo" : "⚠️ Saldo Negativo"}
              </p>
              <p className={`text-3xl font-bold mt-2 ${balance >= 0 ? "text-blue-900" : "text-orange-900"}`}>
                {formatCurrency(balance)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Gastos em Dinheiro/PIX</p>
            <p className="text-xl font-bold text-red-600 mt-2">{formatCurrency(currentExpenses)}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Gastos no Cartão</p>
            <p className="text-xl font-bold text-orange-600 mt-2">{formatCurrency(currentCreditCard)}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">% Gasto da Renda</p>
            <p className="text-xl font-bold text-purple-600 mt-2">
              {currentIncome > 0 ? ((totalExpenses / currentIncome) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {!isLoading && monthlyData.length > 0 && (
        <>
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>📈 Comparação Renda vs Gastos (Últimos 12 Meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyData.slice(-12)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="income" fill="#10b981" name="Renda" />
                  <Bar dataKey="expenses" fill="#ef4444" name="Gastos (Dinheiro/PIX)" />
                  <Bar dataKey="creditCard" fill="#f97316" name="Gastos (Cartão)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>💹 Saldo Mensal (Últimos 12 Meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={monthlyData.slice(-12).map((d) => ({
                    ...d,
                    balance: d.income - (d.expenses + d.creditCard),
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    stroke="#3b82f6"
                    name="Saldo"
                    strokeWidth={2}
                    dot={{ fill: "#3b82f6", r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}

      {isLoading && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Carregando dados...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
