'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { listSources } from '@/app/sessions/actions';
import type { Source } from '@/lib/types';
import { AlertCircle, GitMerge } from 'lucide-react';

type SourceSelectionProps = {
  apiKey: string;
  onSourceSelected: (source: Source | null) => void;
  disabled?: boolean;
};

export function SourceSelection({ apiKey, onSourceSelected, disabled }: SourceSelectionProps) {
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedValue, setSelectedValue] = useState<string | undefined>();
  const [isFetching, startFetching] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (apiKey) {
      startFetching(async () => {
        try {
          setError(null);
          const fetchedSources = await listSources(apiKey);
          setSources(fetchedSources);
          if (fetchedSources.length > 0) {
            const defaultSource = fetchedSources[0];
            setSelectedValue(defaultSource.name);
            onSourceSelected(defaultSource); // Immediately notify parent of default
          } else {
            setSelectedValue(undefined);
            onSourceSelected(null);
          }
        } catch (e) {
          setError('Failed to load repositories.');
          console.error(e);
        }
      });
    } else {
      setSources([]);
      setSelectedValue(undefined);
      onSourceSelected(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const handleValueChange = (sourceName: string) => {
    setSelectedValue(sourceName);
    const selected = sources.find((s) => s.name === sourceName) || null;
    onSourceSelected(selected);
  };
  
  if (isFetching) {
    return (
      <div className="space-y-2">
        <Skeleton id="repository-skeleton" className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return (
        <div className="space-y-2">
            <div id="repository-error" className="flex items-center gap-2 text-sm text-destructive border border-destructive/50 rounded-md p-2 bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
            </div>
        </div>
    )
  }

  return (
    <div className="grid w-full items-center gap-2">
      <Select
        onValueChange={handleValueChange}
        disabled={disabled || sources.length === 0}
        value={selectedValue}
        name="repository"
      >
        <SelectTrigger id="repository">
          <div className="flex items-center gap-2">
            <GitMerge className="h-4 w-4 text-muted-foreground" />
            <SelectValue placeholder="Select a repository" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {sources.map((source) => (
            <SelectItem key={source.name} value={source.name}>
              {source.githubRepo.owner}/{source.githubRepo.repo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
