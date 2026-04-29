import { Info } from 'lucide-react';

interface ComingSoonBannerProps {
  message?: string;
}

/**
 * ComingSoonBanner - A subtle info banner for scaffolded features
 *
 * Displays a non-blocking informational message at the top of pages
 * that are scaffolded but not yet fully functional.
 */
export function ComingSoonBanner({ message }: ComingSoonBannerProps) {
  const defaultMessage =
    "These admin pages are scaffolded for future multi-user support. Data shown is placeholder. " +
    "Contributions welcome -- see CONTRIBUTING.md for the multi-user wiring guide.";

  return (
    <div className="rounded-lg border border-blue-80 bg-blue-90 p-4 mb-6">
      <div className="flex gap-3">
        <Info className="h-5 w-5 text-blue-40 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-blue-30">
            {message || defaultMessage}
          </p>
        </div>
      </div>
    </div>
  );
}
