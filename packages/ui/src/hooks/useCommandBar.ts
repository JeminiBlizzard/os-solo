import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';

export interface SearchResult {
  type: 'navigation' | 'project' | 'server' | 'agent';
  title: string;
  subtitle?: string;
  route?: string;
  icon?: string;
  score: number;
}

export interface ClassificationResult {
  intent: 'navigate' | 'act' | 'query';
  entities: Array<{ type: string; value: string }>;
  confidence: number;
}

export interface ActionResult {
  requiresConfirmation: boolean;
  confirmationMessage?: string;
  result?: {
    success: boolean;
    message: string;
    data?: unknown;
  };
}

export interface QueryResult {
  answer: string;
  data?: unknown;
  visualization?: 'number' | 'chart' | 'table' | 'list';
}

export function useCommandBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [recentCommands, setRecentCommands] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    action: string;
    params?: Record<string, unknown>;
    message?: string;
  } | null>(null);

  const navigate = useNavigate();

  // Fetch recent commands when opening
  const fetchRecentCommands = useCallback(async () => {
    try {
      const response = await apiClient.get<{ recent: SearchResult[] }>(
        '/api/v1/command-bar/recent'
      );
      setRecentCommands(response.recent);
    } catch (error) {
      console.error('[command-bar] Failed to fetch recent commands:', error);
    }
  }, []);

  // Search as user types (debounced in component)
  const search = useCallback(async (q: string) => {
    if (!q || q.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);

    try {
      const response = await apiClient.get<{ results: SearchResult[] }>(
        `/api/v1/command-bar/search?q=${encodeURIComponent(q)}`
      );
      setSearchResults(response.results);
    } catch (error) {
      console.error('[command-bar] Search error:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Execute command when user selects a result or presses Enter
  const executeCommand = useCallback(
    async (result?: SearchResult) => {
      const commandQuery = query.trim();

      if (!commandQuery && !result) {
        return;
      }

      try {
        // If a navigation result was selected, navigate directly
        if (result?.type === 'navigation' && result.route) {
          navigate(result.route);
          setIsOpen(false);
          setQuery('');
          setQueryResult(null);
          await apiClient.post('/api/v1/command-bar/log', {
            query: result.title,
            resultType: 'navigation',
            resultSummary: `Navigated to ${result.route}`,
          });
          return;
        }

        // Classify the command to determine intent
        const classification = await apiClient.post<{
          classification: ClassificationResult;
        }>('/api/v1/command-bar/classify', {
          query: commandQuery,
        });

        const { intent, entities } = classification.classification;

        if (intent === 'navigate' && result?.route) {
          // Navigate to the result
          navigate(result.route);
          setIsOpen(false);
          setQuery('');
          setQueryResult(null);
        } else if (intent === 'query') {
          // Execute query and show results
          const queryResponse = await apiClient.post<QueryResult>(
            '/api/v1/command-bar/query',
            { query: commandQuery, entities }
          );
          setQueryResult(queryResponse);
        } else if (intent === 'act') {
          // Execute action (may require confirmation)
          const action = commandQuery.split(' ')[0];
          const params = { query: commandQuery };

          const actionResponse = await apiClient.post<ActionResult>(
            '/api/v1/command-bar/execute',
            { action, params, confirmed: false }
          );

          if (actionResponse.requiresConfirmation) {
            setPendingAction({
              action,
              params,
              message: actionResponse.confirmationMessage ?? '',
            });
          } else if (actionResponse.result) {
            if (actionResponse.result.success) {
              toast.success(actionResponse.result.message);
              setIsOpen(false);
              setQuery('');
              setQueryResult(null);
            } else {
              toast.error(actionResponse.result.message);
            }
          }
        }
      } catch (error) {
        console.error('[command-bar] Execute error:', error);
        toast.error('Failed to execute command');
      }
    },
    [query, navigate]
  );

  // Confirm a pending action
  const confirmAction = useCallback(async () => {
    if (!pendingAction) return;

    try {
      const actionResponse = await apiClient.post<ActionResult>(
        '/api/v1/command-bar/execute',
        {
          action: pendingAction.action,
          params: pendingAction.params,
          confirmed: true,
        }
      );

      if (actionResponse.result?.success) {
        toast.success(actionResponse.result.message);
        setIsOpen(false);
        setQuery('');
        setQueryResult(null);
        setPendingAction(null);
      } else {
        toast.error(actionResponse.result?.message || 'Action failed');
      }
    } catch (error) {
      console.error('[command-bar] Confirm action error:', error);
      toast.error('Failed to execute action');
    }
  }, [pendingAction]);

  // Cancel pending action
  const cancelAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  // Open command bar
  const open = useCallback(() => {
    setIsOpen(true);
    fetchRecentCommands();
  }, [fetchRecentCommands]);

  // Close command bar
  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
    setSearchResults([]);
    setQueryResult(null);
    setPendingAction(null);
  }, []);

  // Global keyboard listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          close();
        } else {
          open();
        }
      }

      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, open, close]);

  return {
    isOpen,
    open,
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
  };
}
