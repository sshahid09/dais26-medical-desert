import { GenieChat } from '@databricks/appkit-ui/react';

export function AssistantPage() {
  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Ask the data</h2>
        <p className="text-sm text-muted-foreground">
          Natural-language questions over facilities, pincode geography, and NFHS-5 district health
          indicators — answered by the &ldquo;India Healthcare Desert Planner&rdquo; Genie space. Each
          answer shows the SQL it ran, so you can check the evidence.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-card">
        <GenieChat
          alias="planner"
          className="h-full"
          placeholder="e.g. Which districts have the fewest hospitals per 100k people?"
        />
      </div>
    </div>
  );
}
