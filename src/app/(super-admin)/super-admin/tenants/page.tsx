import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TenantsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Tenants e Usuarios</h2>
          <p className="text-sm text-muted-foreground">
            Administre clientes, dominios e membros vinculados a cada tenant.
          </p>
        </div>
        <Button size="sm">Novo tenant</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Proxima implementacao</CardTitle>
          <CardDescription>
            Esta tela deve suportar CRUD completo com RLS e convites de usuario.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Combine tabelas de tenants, usuarios e associacoes para garantir escopo por tenant_id.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}