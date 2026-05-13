import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import AddTransaction from "./pages/AddTransaction";
import Settings from "./pages/Settings";
import Family from "./pages/Family";
import Income from "./pages/Income";
import CreditCardPage from "./pages/CreditCard";
import CardSettings from "./pages/CardSettings";
import Invoices from "./pages/Invoices";
import Reports from "./pages/Reports";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/add" component={AddTransaction} />
        <Route path="/income" component={Income} />
        <Route path="/credit-card" component={CreditCardPage} />
        <Route path="/credit-card/settings" component={CardSettings} />
        <Route path="/credit-card/faturas" component={Invoices} />
        <Route path="/reports" component={Reports} />
        <Route path="/family" component={Family} />
        <Route path="/settings" component={Settings} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
