import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ResponseComposerProps {
  initialDraft: string | null;
  onSend: (body: string) => void;
  onSaveDraft: (body: string) => void;
  isSending: boolean;
  disabled?: boolean;
}

export function ResponseComposer({
  initialDraft,
  onSend,
  onSaveDraft,
  isSending,
  disabled = false,
}: ResponseComposerProps) {
  const [draft, setDraft] = useState(initialDraft || '');
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setDraft(initialDraft || '');
    setIsDirty(false);
  }, [initialDraft]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    setIsDirty(true);
  };

  const handleSend = () => {
    if (draft.trim()) {
      onSend(draft);
    }
  };

  const handleSaveDraft = () => {
    onSaveDraft(draft);
    setIsDirty(false);
  };

  return (
    <div className="space-y-3">
      <Textarea
        value={draft}
        onChange={handleChange}
        placeholder="Type your response..."
        rows={6}
        className="resize-none"
        disabled={disabled}
      />

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-60">
          {initialDraft && !isDirty && 'Pre-filled from AI draft'}
          {isDirty && 'Unsaved changes'}
        </div>

        <div className="flex gap-2">
          {isDirty && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={disabled}
            >
              Save Draft
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!draft.trim() || isSending || disabled}
          >
            {isSending ? 'Sending...' : 'Send Response'}
          </Button>
        </div>
      </div>
    </div>
  );
}
