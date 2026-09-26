import { GarmentValidationResult } from '@/types';
import { cn } from '@/lib/utils';
import { ShieldCheck, AlertTriangle, XCircle } from 'lucide-react';

interface VisualScoreProps {
  score: GarmentValidationResult;
  compact?: boolean;
}

export function VisualScore({ score, compact = false }: VisualScoreProps) {
  const isApproved = score.overallScore >= 90;
  const isReview = score.overallScore >= 75 && score.overallScore < 90;

  const badgeColor = isApproved 
    ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/50' 
    : isReview 
    ? 'text-amber-400 bg-amber-950/40 border-amber-800/50' 
    : 'text-rose-400 bg-rose-950/40 border-rose-800/50';

  const Icon = isApproved ? ShieldCheck : isReview ? AlertTriangle : XCircle;

  if (compact) {
    return (
      <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono font-medium backdrop-blur-sm", badgeColor)}>
        <Icon className="w-3.5 h-3.5" />
        <span>{score.overallScore}% Garment Lock</span>
      </div>
    );
  }

  return (
    <div className="p-3.5 rounded-xl bg-[#090a0f]/80 border border-[#1e2230] space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 font-medium">Consistencia</span>
          {score.referenceStatus && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono border ${
              score.referenceStatus === 'REFERENCE_VERIFIED'
                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/40'
                : 'bg-amber-950/40 text-amber-400 border-amber-800/40'
            }`}>
              {score.referenceStatus === 'REFERENCE_VERIFIED' ? '✓ REF' : '~ INFERRED'}
            </span>
          )}
        </div>
        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-semibold border", badgeColor)}>
          <Icon className="w-3.5 h-3.5" />
          {score.overallScore}%
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-gray-400">
            <span>Color</span>
            <span className="font-mono text-gray-200">{score.colorAccuracyScore}%</span>
          </div>
          <div className="w-full h-1 bg-[#1a1d28] rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${score.colorAccuracyScore}%` }} />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-gray-400">
            <span>Forma</span>
            <span className="font-mono text-gray-200">{score.shapeScore}%</span>
          </div>
          <div className="w-full h-1 bg-[#1a1d28] rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${score.shapeScore}%` }} />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-gray-400">
            <span>Estampado</span>
            <span className="font-mono text-gray-200">{score.patternScore}%</span>
          </div>
          <div className="w-full h-1 bg-[#1a1d28] rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${score.patternScore}%` }} />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[11px] text-gray-400">
            <span>Detalles</span>
            <span className="font-mono text-gray-200">{score.detailScore}%</span>
          </div>
          <div className="w-full h-1 bg-[#1a1d28] rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${score.detailScore}%` }} />
          </div>
        </div>
      </div>

      {score.issues && score.issues.length > 0 && (
        <div className="pt-1 text-[11px] text-amber-400/90 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
          <span>{score.issues.join(', ')}</span>
        </div>
      )}
    </div>
  );
}
