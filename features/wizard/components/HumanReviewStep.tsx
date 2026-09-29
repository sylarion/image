'use client';

import React from 'react';
import { WizardQuestion } from '../engine/decision-engine';
import { HelpCircle, Check, ArrowRight } from 'lucide-react';

interface HumanReviewStepProps {
  question: WizardQuestion;
  onAnswer: (value: string) => void;
}

export function HumanReviewStep({
  question,
  onAnswer,
}: HumanReviewStepProps) {
  return (
    <div className="space-y-6 max-w-xl mx-auto py-8 animate-fade-in">
      <div className="space-y-2 text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <HelpCircle className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          {question.title}
        </h2>
        <p className="text-sm text-gray-400">
          {question.description}
        </p>
      </div>

      {/* Actionable simple options */}
      <div className="space-y-3 pt-2">
        {question.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onAnswer(opt.value)}
            className="w-full p-4 rounded-2xl bg-[#11131c] border border-[#1e2230] hover:border-blue-500 text-left transition-all hover:bg-[#151928] group flex items-center justify-between"
          >
            <span className="text-sm font-semibold text-white group-hover:text-blue-400 transition-colors">
              {opt.label}
            </span>
            <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-transform" />
          </button>
        ))}
      </div>
    </div>
  );
}
