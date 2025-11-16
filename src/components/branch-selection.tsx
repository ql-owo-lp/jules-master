'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { listBranches } from '@/app/sessions/actions';
import type { Source, Branch } from '@/lib/types';
import { AlertCircle, GitBranch } from 'lucide-react';

type BranchSelectionProps = {
  apiKey: string;
  source: Source | null;
  disabled?: boolean;
};

export function BranchSelection({ apiKey, source, disabled }: BranchSelectionProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isFetching, startFetching] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | undefined>();

  useEffect(() => {
    if (apiKey && source) {
      startFetching(async () => {
        try {
          setError(null);
          setBranches([]);
          setSelectedBranch(undefined);
          const fetchedBranches = await listBranches(apiKey, source.name);
          setBranches(fetchedBranches);
          const defaultBranch = fetchedBranches.find(b => b.isDefault) || fetchedBranches[0];
          if (defaultBranch) {
            setSelectedBranch(defaultBranch.name);
          }
        } catch (e) {
          setError('Failed to load branches.');
          console.error(e);
        }
      });
    } else {
      setBranches([]);
      setSelectedBranch(undefined);
    }
  }, [apiKey, source]);
  
  if (isFetching) {
    return (
      <div className="space-y-2">
        <Label htmlFor="branch-skeleton">Branch</Label>
        <Skeleton id="branch-skeleton" className="h-10 w-full" />
      </div>
    );
  }

  if (error) {
    return (
        <div className="space-y-2">
            <Label htmlFor="branch-error">Branch</Label>
            <div id="branch-error" className="flex items-center gap-2 text-sm text-destructive border border-destructive/50 rounded-md p-2 bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
            </div>
        </div>
    )
  }

  return (
    <div className="grid w-full items-center gap-2">
      <Label htmlFor="branch">Branch</Label>
      <Select
        onValueChange={setSelectedBranch}
        value={selectedBranch}
        disabled={disabled || !source || branches.length === 0 || isFetching}
        name="branch"
      >
        <SelectTrigger id="branch">
            <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Select a branch" />
            </div>
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch) => (
            <SelectItem key={branch.name} value={branch.name}>
              {branch.name.replace('refs/heads/', '')}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
