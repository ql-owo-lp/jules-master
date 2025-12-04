
"use client";

import React, { useState, useTransition } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface CreateJobFormProps {
  createJob: (prompts: string[]) => Promise<any>;
  predefinedPrompts?: { title: string; prompt: string }[];
}

export function CreateJobForm({ createJob, predefinedPrompts }: CreateJobFormProps) {
  const [prompts, setPrompts] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const promptList = prompts.split('\n').filter(p => p.trim() !== '');
    if (promptList.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No prompts provided',
        description: 'Please enter at least one prompt.',
      });
      return;
    }

    startTransition(async () => {
      try {
        await createJob(promptList);
        setPrompts('');
        toast({
          title: 'Job Created',
          description: 'The job has been created successfully.',
        });
      } catch (error) {
        toast({
          variant: 'destructive',
          title: 'Failed to create job',
        });
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        value={prompts}
        onChange={(e) => setPrompts(e.target.value)}
        placeholder="Enter each prompt on a new line..."
        className="w-full h-40"
      />
      <div className="flex justify-between items-center">
        <div>
          {predefinedPrompts && predefinedPrompts.length > 0 && (
            <div className="flex gap-2">
              {predefinedPrompts.map((p) => (
                <Button
                  key={p.title}
                  variant="outline"
                  size="sm"
                  onClick={() => setPrompts(prompts + '\n' + p.prompt)}
                >
                  {p.title}
                </Button>
              ))}
            </div>
          )}
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating...' : 'Create Job'}
        </Button>
      </div>
    </form>
  );
}
