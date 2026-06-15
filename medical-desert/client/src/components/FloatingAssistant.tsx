import { useState } from 'react';
import { GenieChat } from '@databricks/appkit-ui/react';
import { MessageCircle, X, Minus } from 'lucide-react';

export function FloatingAssistant() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3 print:hidden">
      {open && (
        <div
          className="flex h-[min(70vh,560px)] w-[min(92vw,400px)] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl"
          role="dialog"
          aria-label="Ask the data assistant"
        >
          <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
            <div className="leading-tight">
              <div className="text-sm font-semibold text-foreground">Ask the data</div>
              <div className="text-[11px] text-muted-foreground">India Healthcare Desert Planner · Genie</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Minimize assistant"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <GenieChat
              alias="planner"
              className="h-full"
              placeholder="e.g. Which districts have the fewest hospitals per 100k people?"
            />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={open ? 'Close assistant' : 'Open data assistant'}
        aria-expanded={open}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
