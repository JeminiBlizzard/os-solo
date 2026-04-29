import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <PageHeader title="Page Not Found" />
        <p className="text-gray-60 mb-4">
          The page you're looking for doesn't exist.
        </p>
        <Button onClick={() => navigate('/')}>Go to Dashboard</Button>
      </div>
    </div>
  );
}
