import { Badge } from "@repo/design-system/components/ui/badge";

export function BetaBanner() {
  return (
    <Badge className="hidden shrink-0 sm:inline-flex" variant="secondary">
      Beta
    </Badge>
  );
}
