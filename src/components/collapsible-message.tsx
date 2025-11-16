
"use client";

import { useState, useMemo } from 'react';
import { Button } from './ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const LINE_LIMIT = 4;

type CollapsibleMessageProps = {
    content?: string;
    isPreformatted?: boolean;
};

export function CollapsibleMessage({ content, isPreformatted = false }: CollapsibleMessageProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const lineCount = useMemo(() => {
        if (!content) return 0;
        return (content.match(/\n/g) || []).length + 1;
    }, [content]);
    
    const isCollapsible = lineCount > LINE_LIMIT;

    if (!content || !content.trim()) {
        return null;
    }

    const displayedContent = useMemo(() => {
        if (!isCollapsible || isExpanded) {
            return content;
        }
        return content.split('\n').slice(0, LINE_LIMIT).join('\n');
    }, [content, isCollapsible, isExpanded]);
    
    const Wrapper = ({ children }: { children: React.ReactNode }) => 
        isPreformatted ? (
            <pre className="whitespace-pre-wrap bg-muted text-foreground p-2 rounded-md font-mono text-xs overflow-auto">
                <code>{children}</code>
            </pre>
        ) : (
            <div className="whitespace-pre-wrap">{children}</div>
        );

    return (
        <div>
            <Wrapper>{displayedContent}</Wrapper>
            {isCollapsible && (
                <Button
                    variant="link"
                    size="sm"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="p-0 h-auto text-xs"
                >
                    {isExpanded ? (
                        <>
                            <ChevronUp className="mr-1 h-3 w-3" />
                            Show less
                        </>
                    ) : (
                        <>
                            <ChevronDown className="mr-1 h-3 w-3" />
                            Show more ({lineCount - LINE_LIMIT} lines)
                        </>
                    )}
                </Button>
            )}
        </div>
    );
}
