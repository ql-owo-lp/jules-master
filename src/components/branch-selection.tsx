'use client';

import React from 'react';
import { Label } from '@/components/ui/label';
import type { Branch } from '@/lib/types';
import { GitBranch } from 'lucide-react';
import { Combobox } from './ui/combobox';

type BranchSelectionProps = {
  branches: Branch[];
  selectedValue?: string;
  onBranchSelected: (branch?: string) => void;
  disabled?: boolean;
  id?: string;
};

export function BranchSelection({ branches, selectedValue, onBranchSelected, disabled, id = "branch" }: BranchSelectionProps) {

  const options = branches.map(branch => ({
    value: branch.displayName,
    label: branch.displayName
  }));

  const handleValueChange = (value: string | null) => {
    onBranchSelected(value ?? undefined);
  };

  return (
    <div className="grid w-full items-center gap-2">
      <Label htmlFor={id}>Branch</Label>
      <Combobox 
        id={id}
        options={options}
        selectedValue={selectedValue}
        onValueChange={handleValueChange}
        placeholder='Select a branch'
        searchPlaceholder='Search branches...'
        disabled={disabled || branches.length === 0}
        icon={<GitBranch className="h-4 w-4 text-muted-foreground" />}
        name="branch"
      />
    </div>
  );
}
