import { Mail, CreditCard, GitBranch, Webhook, MessageSquare } from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  stripe: CreditCard,
  github: GitBranch,
  webhook: Webhook,
  contact_form: MessageSquare,
};

const colorMap: Record<string, string> = {
  email: 'text-blue-500',
  stripe: 'text-purple-500',
  github: 'text-gray-60',
  webhook: 'text-green-500',
  contact_form: 'text-orange-500',
};

interface SourceIconProps {
  source: string;
  className?: string;
}

export function SourceIcon({ source, className = '' }: SourceIconProps) {
  const Icon = iconMap[source] ?? Webhook;
  const color = colorMap[source] ?? 'text-gray-60';

  return <Icon className={`${color} ${className}`} />;
}
