import { ProductionStatus } from '@/types';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, Loader2, AlertCircle, FileEdit, Sparkles } from 'lucide-react';

interface StatusBadgeProps {
  status: ProductionStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  ProductionStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
> = {
  DRAFT: {
    label: 'Borrador',
    icon: FileEdit,
    className: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  },
  ANALYZING: {
    label: 'Analizando',
    icon: Loader2,
    className: 'bg-amber-950/60 text-amber-300 border-amber-800/60 animate-pulse',
  },
  READY: {
    label: 'Listo para producción',
    icon: Sparkles,
    className: 'bg-blue-950/60 text-blue-300 border-blue-800/60',
  },
  GENERATING: {
    label: 'Generando',
    icon: Loader2,
    className: 'bg-purple-950/60 text-purple-300 border-purple-800/60 animate-pulse',
  },
  VALIDATING: {
    label: 'Validando consistencia',
    icon: Clock,
    className: 'bg-cyan-950/60 text-cyan-300 border-cyan-800/60',
  },
  COMPLETED: {
    label: 'Completado',
    icon: CheckCircle2,
    className: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60',
  },
  PARTIAL: {
    label: 'Parcial',
    icon: AlertCircle,
    className: 'bg-amber-950/60 text-amber-300 border-amber-800/60',
  },
  CANCELLED: {
    label: 'Cancelado',
    icon: AlertCircle,
    className: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  },
  FAILED: {
    label: 'Error en proceso',
    icon: AlertCircle,
    className: 'bg-rose-950/60 text-rose-300 border-rose-800/60',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.DRAFT;
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border tracking-wide',
        config.className,
        className
      )}
    >
      <Icon className={cn('w-3.5 h-3.5', (status === 'ANALYZING' || status === 'GENERATING') && 'animate-spin')} />
      <span>{config.label}</span>
    </span>
  );
}
