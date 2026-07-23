import { Button } from "@/components/ui/button";

export function GoogleSignInOption({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;

  return (
    <Button
      type="submit"
      variant="outline"
      size="lg"
      className="h-10 w-full"
    >
      Continue with Google
    </Button>
  );
}
