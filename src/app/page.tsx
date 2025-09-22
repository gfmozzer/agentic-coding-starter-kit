import { SignInButton } from "@/components/auth/sign-in-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSessionContext } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const session = await getSessionContext();

  if (session) {
    return redirect(session.role === "super-admin" ? "/super-admin" : "/operator");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted px-4">
      <Card className="w-full max-w-xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Translator Pro</CardTitle>
          <p className="text-sm text-muted-foreground">
            Acesse a console multi-tenant para configurar workflows de traducao com revisoes humanas.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Faca login para definir workflows como Super-Admin ou operar traducoes como Operador.</p>
            <p>A autenticacao usa Google OAuth. Apenas contas autorizadas terao acesso.</p>
          </div>
          <div className="flex justify-end">
            <SignInButton />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}