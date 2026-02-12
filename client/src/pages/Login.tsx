import { useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient } from "@/lib/queryClient";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const supabaseClient = supabase;

  if (!isSupabaseConfigured || !supabaseClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-lg w-full rounded-3xl border border-muted/30 bg-card/90 p-8 text-center">
          <h1 className="text-2xl font-semibold mb-4">Supabase login is not configured</h1>
          <p className="text-sm text-muted-foreground">
            Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to enable the built-in auth flow. In the meantime you can still{" "}
            <a className="text-primary underline" href="/api/login">
              log in via the legacy provider
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    setIsSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    toast({
      title: "Signed in",
      description: "Welcome back!",
    });
    navigate("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-6 rounded-3xl border border-muted/30 bg-card/90 p-8 shadow-lg"
      >
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">Use your Supabase credentials to access Outlet Auctions.</p>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
