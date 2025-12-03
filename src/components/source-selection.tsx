
'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { listSources } from '@/app/sessions/actions';
import type { Source } from '@/lib/types';
import { AlertCircle, GitMerge } from 'lucide-react';
import { Combobox } from './ui/combobox';
import { useLocalStorage } from '@/hooks/use-local-storage';

type SourceSelectionProps = {
  onSourceSelected: (source: Source | null) => void;
  disabled?: boolean;
  selectedValue?: Source | null;
  sources: Source[];
  onSourcesLoaded: (sources: Source[]) => void;
};

export function SourceSelection({ onSourceSelected, disabled, selectedValue, sources, onSourcesLoaded }: SourceSelectionProps) {
  const [isFetching, startFetching] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [apiKey] = useLocalStorage<string | null>("jules-api-key", null);


  useEffect(() => {
    if (sources.length > 0) return;

    startFetching(async () => {
      try {
        setError(null);
        const fetchedSources = await listSources(apiKey);
        onSourcesLoaded(fetchedSources);
        // If there's no value from localstorage, select the first one.
        if (!selectedValue && fetchedSources.length > 0) {
          onSourceSelected(fetchedSources[0]);
        }
      } catch (e) {
        setError('Failed to load repositories.');
        console.error(e);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, sources]);


  if (isFetching && sources.length === 0) {
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
  
  const options = sources.map(source => ({
    value: source.name,
    label: `${source.githubRepo.owner}/${source.githubRepo.repo}`
  }));

  const handleSourceSelected = (sourceName: string | null) => {
    const selected = sources.find((s) => s.name === sourceName) || null;
    onSourceSelected(selected);
  }

  return (
    <div className="grid w-full items-center gap-2">
      <Combobox 
        options={options}
        selectedValue={selectedValue?.name}
        onValueChange={handleSourceSelected}
        placeholder='Select a repository'
        searchPlaceholder='Search repositories...'
        disabled={disabled || sources.length === 0}
        icon={<GitMerge className="h-4 w-4 text-muted-foreground" />}
      />
    </div>
  );
}
