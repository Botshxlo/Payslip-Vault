import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6">
      <h1 className="font-heading text-4xl font-bold tracking-tight">404</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page could not be found.
      </p>
      <Button asChild variant="outline" size="sm" className="mt-6">
        <Link href="/">Go Home</Link>
      </Button>
    </div>
  );
}
