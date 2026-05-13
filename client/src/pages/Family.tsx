import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Copy, LogOut, UserPlus, Crown, User, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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

export default function Family() {
  const { user } = useAuth();
  const familyQuery = trpc.family.get.useQuery();
  const membersQuery = trpc.family.members.useQuery();
  const utils = trpc.useUtils();

  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [copied, setCopied] = useState(false);

  const createMutation = trpc.family.create.useMutation({
    onSuccess: () => {
      toast.success("Família criada com sucesso!");
      utils.family.get.invalidate();
      utils.family.members.invalidate();
      setFamilyName("");
    },
    onError: (err) => toast.error(err.message),
  });

  const joinMutation = trpc.family.join.useMutation({
    onSuccess: (data) => {
      toast.success(`Você entrou na família "${data.familyName}"!`);
      utils.family.get.invalidate();
      utils.family.members.invalidate();
      setInviteCode("");
    },
    onError: (err) => toast.error(err.message),
  });

  const leaveMutation = trpc.family.leave.useMutation({
    onSuccess: () => {
      toast.success("Você saiu da família.");
      utils.family.get.invalidate();
      utils.family.members.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const family = familyQuery.data;
  const members = membersQuery.data ?? [];

  const copyInviteCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Código copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar. Copie manualmente.");
    }
  };

  if (familyQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-xl bg-muted animate-pulse" />
        <div className="h-48 rounded-xl bg-muted animate-pulse" />
      </div>
    );
  }

  // User is in a family
  if (family) {
    return (
      <div className="space-y-4 pb-24">
        {/* Family Info */}
        <Card className="border-0 shadow-sm bg-emerald-50">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-emerald-800">{family.familyName}</h2>
                <p className="text-xs text-emerald-600">Modo Família Ativo</p>
              </div>
            </div>

            {/* Invite Code */}
            <div className="bg-white rounded-lg p-4 mb-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Código de Convite
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-lg px-4 py-3 text-center">
                  <span className="text-2xl font-mono font-bold tracking-[0.3em] text-emerald-700">
                    {family.inviteCode}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 shrink-0"
                  onClick={() => copyInviteCode(family.inviteCode)}
                >
                  {copied ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Compartilhe este código com sua esposa para ela entrar na família
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Members */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              Membros ({members.length})
            </p>
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {member.role === "admin" ? (
                      <Crown className="h-5 w-5 text-amber-500" />
                    ) : (
                      <User className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.userName || "Sem nome"}
                      {member.userId === user?.id && (
                        <span className="text-xs text-muted-foreground ml-1">(você)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{member.userEmail}</p>
                  </div>
                  <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${member.role === "admin" ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
                    {member.role === "admin" ? "Admin" : "Membro"}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Leave Family */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50">
              <LogOut className="h-4 w-4 mr-2" />
              Sair da Família
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sair da família?</AlertDialogTitle>
              <AlertDialogDescription>
                Ao sair, você não verá mais os gastos compartilhados. Seus lançamentos continuarão salvos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => leaveMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Sair
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // User is NOT in a family
  return (
    <div className="space-y-4 pb-24">
      <div className="text-center py-6">
        <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
          <Users className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold mb-2">Modo Família</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Compartilhe o controle de gastos com sua esposa. Os dois verão os mesmos lançamentos e o mesmo saldo acumulado.
        </p>
      </div>

      {/* Create Family */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3">Criar uma Família</h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="familyName" className="text-xs">Nome da Família</Label>
              <Input
                id="familyName"
                placeholder="Ex: Família Santos"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                className="mt-1"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => createMutation.mutate({ name: familyName })}
              disabled={!familyName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Criando..." : "Criar Família"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3 px-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">ou</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Join Family */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3">Entrar em uma Família</h3>
          <div className="space-y-3">
            <div>
              <Label htmlFor="inviteCode" className="text-xs">Código de Convite</Label>
              <Input
                id="inviteCode"
                placeholder="Ex: ABC123"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="mt-1 text-center font-mono text-lg tracking-widest"
                maxLength={8}
              />
            </div>
            <Button
              className="w-full"
              variant="outline"
              onClick={() => joinMutation.mutate({ inviteCode })}
              disabled={!inviteCode.trim() || joinMutation.isPending}
            >
              {joinMutation.isPending ? "Entrando..." : "Entrar na Família"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
