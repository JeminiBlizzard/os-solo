import { useEffect, useCallback } from 'react';
import { useCommandBar } from '@/hooks/useCommandBar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';

export function CommandBar() {
  const {
    isOpen,
    close,
    query,
    setQuery,
    searchResults,
    recentCommands,
    isSearching,
    search,
    executeCommand,
    queryResult,
    pendingAction,
    confirmAction,
    cancelAction,
  } = useCommandBar();

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 150);

    return () => clearTimeout(timer);
  }, [query, search]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (searchResults.length > 0) {
          executeCommand(searchResults[0]);
        } else {
          executeCommand();
        }
      }
    },
    [searchResults, executeCommand]
  );

  // Show results: recent commands if no query, otherwise search results
  const displayResults = query.trim().length === 0 ? recentCommands : searchResults;

  return (
    <>
      {/* Main command bar dialog */}
      <Dialog open={isOpen && !pendingAction} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-2xl p-0 gap-0">
          {/* Search input */}
          <div className="p-4 border-b border-gray-20">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search or type a command..."
              className="text-lg h-12 border-0 focus-visible:ring-0 shadow-none"
              autoFocus
            />
          </div>

          {/* Results or query answer */}
          <div className="max-h-96 overflow-y-auto">
            {queryResult ? (
              // Query result display
              <div className="p-6">
                <div className="text-2xl font-semibold mb-2">{queryResult.answer}</div>
                {queryResult.data && (
                  <pre className="text-xs text-gray-60 mt-4 p-4 bg-gray-10 rounded overflow-x-auto">
                    {JSON.stringify(queryResult.data, null, 2)}
                  </pre>
                )}
              </div>
            ) : displayResults.length > 0 ? (
              // Search results
              <div className="p-2">
                {query.trim().length === 0 && (
                  <div className="px-4 py-2 text-xs text-gray-60 font-medium">
                    Recent commands
                  </div>
                )}
                {displayResults.map((result, index) => (
                  <button
                    key={`${result.type}-${result.title}-${index}`}
                    onClick={() => executeCommand(result)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-10 rounded flex items-center gap-3 transition-colors"
                  >
                    {result.icon && (
                      <div className="w-8 h-8 rounded bg-gray-20 flex items-center justify-center text-gray-60">
                        {result.icon}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{result.title}</div>
                      {result.subtitle && (
                        <div className="text-sm text-gray-60 truncate">{result.subtitle}</div>
                      )}
                    </div>
                    {result.type && (
                      <div className="text-xs text-gray-50 uppercase tracking-wide px-2 py-1 bg-gray-10 rounded">
                        {result.type}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : query.trim().length > 0 && !isSearching ? (
              // No results
              <div className="p-6 text-center text-gray-60">
                <div className="text-lg mb-2">No results found</div>
                <div className="text-sm">
                  Try searching for pages, projects, servers, or agents
                </div>
              </div>
            ) : isSearching ? (
              // Loading
              <div className="p-6 text-center text-gray-60">
                <div className="text-sm">Searching...</div>
              </div>
            ) : null}
          </div>

          {/* Footer hint */}
          <div className="p-3 border-t border-gray-20 flex items-center justify-between text-xs text-gray-60">
            <div className="flex items-center gap-4">
              <div>
                <kbd className="px-2 py-1 bg-gray-10 border border-gray-20 rounded">↵</kbd>{' '}
                to select
              </div>
              <div>
                <kbd className="px-2 py-1 bg-gray-10 border border-gray-20 rounded">Esc</kbd>{' '}
                to close
              </div>
            </div>
            <div>
              <kbd className="px-2 py-1 bg-gray-10 border border-gray-20 rounded">
                {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+K
              </kbd>{' '}
              to toggle
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog for destructive actions */}
      <Dialog open={!!pendingAction} onOpenChange={(open) => !open && cancelAction()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Action</DialogTitle>
            <DialogDescription>{pendingAction?.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={cancelAction}>
              Cancel
            </Button>
            <Button onClick={confirmAction} className="bg-red-600 hover:bg-red-700 text-white">
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
