'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { Branch } from '@/lib/types';
import { GitBranch } from 'lucide-react';
import { useEffect, useState } from 'react';

type BranchSelectionProps = {
  branches: Branch[];
  defaultBranchName?: string;
  disabled?: boolean;
};

export function BranchSelection({ branches, defaultBranchName, disabled }: BranchSelectionProps) {
  const [selectedBranch, setSelectedBranch] = useState<string | undefined>();

  useEffect(() => {
    setSelectedBranch(defaultBranchName);
  }, [defaultBranchName]);


  return (
    <div className="grid w-full items-center gap-2">
      <Label htmlFor="branch">Branch</Label>
      <Select
        onValueChange={setSelectedBranch}
        value={selectedBranch}
        disabled={disabled || branches.length === 0}
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
            <SelectItem key={branch.displayName} value={branch.displayName}>
              {branch.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
