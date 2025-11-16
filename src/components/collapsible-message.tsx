
"use client";

import { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

const LINE_LIMIT = 10;

type CollapsibleMessageProps = {
    content?: string;
    isPreformatted?: boolean;
};

export function CollapsibleMessage({ content, isPreformatted = false }: CollapsibleMessageProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const lineCount = useMemo(() => ((content || '').match(/\n/g) || '').length + 1, [content]);
    const isCollapsible = lineCount > LINE_LIMIT;

    if (!content) {
        return null;
    }

    const Wrapper = ({ children }: { children: React.ReactNode }) => 
        isPreformatted ? (
            <pre className={cn(
                'whitespace-pre-wrap bg-muted text-foreground p-2 rounded-md font-mono text-xs',
                 isCollapsible && !isExpanded && 'line-clamp-[10]'
            )}>
                <code>{children}</code>
            </pre>
        ) : (
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                className={cn(
                    'whitespace-pre-wrap', 
                    isCollapsible && !isExpanded && 'line-clamp-[10]'
                )}
                components={{
                    pre: ({node, ...props}) => <pre {...props} className="bg-muted text-foreground p-2 rounded-md" />,
                    code: ({node, ...props}) => <code {...props} className="bg-muted text-foreground px-1 rounded-md" />,
                }}
             >
                {content}
            </ReactMarkdown>
        );


    return (
        <div className="relative prose prose-sm dark:prose-invert max-w-none">
             <Wrapper>{content}</Wrapper>

            {isCollapsible && (
                 <Button
                    variant="link"
                    size="sm"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-0 h-auto text-accent"
                >
                    {isExpanded ? (
                        <>
                            <ChevronUp className="mr-1 h-4 w-4" /> Show less
                        </>
                    ) : (
                        <>
                            <ChevronDown className="mr-1 h-4 w-4" /> Show more
                        </>
                    )}
                </Button>
            )}
        </div>
    );
}
