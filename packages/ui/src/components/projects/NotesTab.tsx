import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  useProjectNotes,
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  type ProjectNote,
} from '@/hooks/useProjects';
import { toast } from 'sonner';

interface NotesTabProps {
  projectId: number;
}

export function NotesTab({ projectId }: NotesTabProps) {
  const { data, isLoading } = useProjectNotes(projectId);
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const [editing, setEditing] = useState<ProjectNote | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);

  const notes = data?.notes ?? [];

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      await createNote.mutateAsync({ projectId, title: title.trim(), body });
      toast.success('Note created');
      setCreating(false);
      setTitle('');
      setBody('');
    } catch {
      // error toast handled by apiClient
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    try {
      await updateNote.mutateAsync({
        projectId,
        noteId: editing.id,
        title: title.trim() || 'Untitled',
        body,
      });
      toast.success('Note saved');
      setEditing(null);
      setTitle('');
      setBody('');
    } catch {
      // error toast handled by apiClient
    }
  };

  const handleDelete = async (note: ProjectNote) => {
    if (!confirm(`Delete "${note.title || 'Untitled'}"?`)) return;
    try {
      await deleteNote.mutateAsync({ projectId, noteId: note.id });
      toast.success('Note deleted');
      if (editing?.id === note.id) {
        setEditing(null);
        setTitle('');
        setBody('');
      }
    } catch {
      // error toast handled by apiClient
    }
  };

  const startEdit = (note: ProjectNote) => {
    setEditing(note);
    setCreating(false);
    setTitle(note.title || '');
    setBody(note.body || '');
    setPreview(false);
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setTitle('');
    setBody('');
    setPreview(false);
  };

  const cancel = () => {
    setEditing(null);
    setCreating(false);
    setTitle('');
    setBody('');
    setPreview(false);
  };

  const isEditorOpen = editing !== null || creating;

  if (isLoading) {
    return <div className="py-8 text-gray-60 text-center">Loading notes...</div>;
  }

  return (
    <div className="py-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-100">
          Notes {notes.length > 0 && <span className="text-gray-50 font-normal">({notes.length})</span>}
        </h3>
        {!isEditorOpen && (
          <Button onClick={startCreate} size="sm">
            New Note
          </Button>
        )}
      </div>

      {/* Editor */}
      {isEditorOpen && (
        <div className="border border-gray-30 p-4 mb-6 space-y-3">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title"
            className="text-base font-medium"
          />

          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setPreview(false)}
              className={`px-3 py-1 text-sm ${!preview ? 'border-b-2 border-brand-blue text-gray-100 font-medium' : 'text-gray-50'}`}
            >
              Write
            </button>
            <button
              onClick={() => setPreview(true)}
              className={`px-3 py-1 text-sm ${preview ? 'border-b-2 border-brand-blue text-gray-100 font-medium' : 'text-gray-50'}`}
            >
              Preview
            </button>
          </div>

          {preview ? (
            <div className="min-h-[200px] p-3 border border-gray-20 bg-gray-10 text-sm whitespace-pre-wrap font-mono">
              {body || 'Nothing to preview'}
            </div>
          ) : (
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your note in markdown..."
              className="min-h-[200px] font-mono text-sm"
            />
          )}

          <div className="flex gap-2">
            <Button
              onClick={editing ? handleUpdate : handleCreate}
              size="sm"
              disabled={createNote.isPending || updateNote.isPending}
            >
              {editing ? 'Save' : 'Create'}
            </Button>
            <Button onClick={cancel} variant="outline" size="sm">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 && !isEditorOpen ? (
        <div className="py-12 text-center">
          <p className="text-gray-50 mb-3">No notes yet</p>
          <Button onClick={startCreate} variant="outline" size="sm">
            Create your first note
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`flex items-start justify-between p-3 border cursor-pointer hover:bg-gray-10 ${
                editing?.id === note.id ? 'border-brand-blue bg-gray-10' : 'border-gray-20'
              }`}
              onClick={() => startEdit(note)}
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-100 truncate">
                  {note.title || 'Untitled'}
                </div>
                <div className="text-sm text-gray-50 truncate mt-0.5">
                  {note.body ? note.body.slice(0, 120) : 'Empty note'}
                </div>
                <div className="text-xs text-gray-40 mt-1">
                  {new Date(note.updatedAt).toLocaleDateString()} at{' '}
                  {new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-40 hover:text-red-500 ml-2 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(note);
                }}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
