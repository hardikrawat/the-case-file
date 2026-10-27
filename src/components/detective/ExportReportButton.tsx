'use client';

import React, { useState } from 'react';
import { Download, FileText, FileJson, ChevronDown } from 'lucide-react';
import type { AnalysisResult } from '@/types/detective';
import { toast } from 'sonner';

interface ExportReportButtonProps {
  analysis: AnalysisResult;
  boardTitle?: string;
}

function analysisToMarkdown(analysis: AnalysisResult, boardTitle: string): string {
  let md = `# Intelligence Report: ${boardTitle}\n`;
  md += `**Generated**: ${new Date(analysis.timestamp).toLocaleString()}\n`;
  md += `**Case Strength**: ${analysis.confidenceScore}/100\n\n`;
  
  md += `## Executive Summary\n${analysis.summary}\n\n`;
  
  if (analysis.hypotheses?.length > 0) {
    md += `## Hypotheses\n`;
    analysis.hypotheses.forEach((h, i) => {
      md += `### ${i + 1}. ${h.title} [${h.confidence.toUpperCase()}]\n`;
      md += `${h.summary}\n`;
      if (h.supportingEvidence?.length > 0) md += `- **Supporting**: ${h.supportingEvidence.join(', ')}\n`;
      if (h.contradictingEvidence?.length > 0) md += `- **Contradicting**: ${h.contradictingEvidence.join(', ')}\n`;
      if (h.missingEvidence?.length > 0) md += `- **Missing**: ${h.missingEvidence.join(', ')}\n`;
      md += '\n';
    });
  }
  
  if (analysis.timeline?.length > 0) {
    md += `## Timeline\n`;
    analysis.timeline.forEach(e => {
      md += `- **${e.date}** [${e.confidence}]: ${e.description}\n`;
    });
    md += '\n';
  }
  
  if (analysis.suggestedConnections?.length > 0) {
    md += `## Suggested Connections\n`;
    analysis.suggestedConnections.forEach(c => {
      md += `- ${c.sourceLabel} → ${c.targetLabel} [${c.confidence}]: ${c.reasoning}\n`;
    });
    md += '\n';
  }
  
  if (analysis.contradictions?.length > 0) {
    md += `## Red Flags / Contradictions\n`;
    analysis.contradictions.forEach(c => {
      md += `- ⚠️ ${c.nodeLabelA} vs ${c.nodeLabelB}: ${c.description}\n`;
    });
    md += '\n';
  }
  
  if (analysis.gaps?.length > 0) {
    md += `## Investigation Leads\n`;
    analysis.gaps.forEach(g => {
      md += `- [${g.urgency.toUpperCase()}] ${g.description}: ${g.reasoning}\n`;
    });
    md += '\n';
  }
  
  if (analysis.counterQuestions?.length > 0) {
    md += `## Lines of Inquiry\n`;
    analysis.counterQuestions.forEach(q => {
      md += `- [${q.urgency.toUpperCase()}] ${q.question}\n  _Context: ${q.context}_\n`;
    });
  }
  
  return md;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportReportButton({ analysis, boardTitle = 'Case' }: ExportReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const handleExportMarkdown = () => {
    const md = analysisToMarkdown(analysis, boardTitle);
    const safeName = boardTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    downloadFile(md, `${safeName}_report.md`, 'text/markdown');
    toast.success('Report exported as Markdown');
    setIsOpen(false);
  };
  
  const handleExportJSON = () => {
    const json = JSON.stringify(analysis, null, 2);
    const safeName = boardTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    downloadFile(json, `${safeName}_analysis.json`, 'application/json');
    toast.success('Analysis exported as JSON');
    setIsOpen(false);
  };
  
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--panel-border)] hover:bg-black/5 dark:hover:bg-white/5 text-[var(--panel-foreground)] transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Export Report
        <ChevronDown className="w-3 h-3" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-[var(--panel-background)] border border-[var(--panel-border)] rounded-md shadow-lg z-20 overflow-hidden">
          <button
            onClick={handleExportMarkdown}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5 text-[var(--panel-foreground)] transition-colors"
          >
            <FileText className="w-3.5 h-3.5" /> Markdown (.md)
          </button>
          <button
            onClick={handleExportJSON}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-black/5 dark:hover:bg-white/5 text-[var(--panel-foreground)] transition-colors"
          >
            <FileJson className="w-3.5 h-3.5" /> JSON (.json)
          </button>
        </div>
      )}
    </div>
  );
}
