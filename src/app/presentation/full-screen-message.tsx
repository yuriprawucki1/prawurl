import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export function FullScreenMessage({ title, description }: { title: string; description: string }) {
  return (
    <main className="grid min-h-screen place-items-center">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </main>
  );
}
