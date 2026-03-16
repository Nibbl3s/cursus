'use client';

import ReactMarkdown from 'react-markdown';

interface AssignmentBriefProps {
  brief: string;
}

export function AssignmentBrief({ brief }: AssignmentBriefProps) {
  return (
    <div className="prose prose-invert prose-sm max-w-none">
      <ReactMarkdown>{brief}</ReactMarkdown>
    </div>
  );
}
