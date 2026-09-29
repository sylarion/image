import { NextResponse } from 'next/server';
import { getRealRuntimeConfigurationIssue } from '@/lib/ai/config';

export async function GET() {
  const reason = getRealRuntimeConfigurationIssue();
  const available = reason === null;
  return NextResponse.json({
    available,
    reason: reason || undefined,
  });
}
