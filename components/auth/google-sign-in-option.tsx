import { Button } from "@/components/ui/button";

export function GoogleSignInOption({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;

  return (
    <>
      <div className="my-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] uppercase text-muted-foreground">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="submit"
        variant="outline"
        size="lg"
        className="h-10 w-full"
      >
        Continue with Google
      </Button>
    </>
  );
}
