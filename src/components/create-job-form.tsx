
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface CreateJobFormProps {
  // A callback function to be invoked when the form is submitted with a list of prompts.
  // It should return a promise that resolves when the job creation is complete.
  onCreateJobs: (prompts: string[]) => Promise<void>;
  // A boolean to determine if the form should be disabled, e.g., when an API key is not set.
  disabled?: boolean;
}

/**
 * A form component for creating new jobs. It includes a textarea for entering
 * multiple prompts (one per line) and a button to submit them. It also handles
 * loading states and displays toasts for success or error messages.
 *
 * @param {CreateJobFormProps} props - The props for the component.
 * @returns {JSX.Element} - The rendered form component.
 */
export function CreateJobForm({
  onCreateJobs,
  disabled = false,
}: CreateJobFormProps): JSX.Element {
  // State to hold the value of the textarea
  const [prompt, setPrompt] = useState('');
  // A transition to handle the loading state of the form submission
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  /**
   * Handles the form submission. It splits the textarea value into individual
   * prompts and calls the `onCreateJobs` callback.
   */
  const handleSubmit = () => {
    // Trim the prompt and return if it's empty
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    // Split the prompts by new lines and filter out any empty lines
    const prompts = trimmedPrompt.split('\n').filter(p => p.trim() !== '');

    // Start the transition to show the loading state
    startTransition(async () => {
      try {
        // Await the job creation process
        await onCreateJobs(prompts);
        // Clear the prompt input on successful submission
        setPrompt('');
        // Show a success toast
        toast({
          title: 'Jobs Created',
          description: 'Your new jobs have been successfully created.',
        });
      } catch (error) {
        // Show an error toast if the job creation fails
        toast({
          variant: 'destructive',
          title: 'Error Creating Jobs',
          description:
            'An error occurred while creating the jobs. Please try again.',
        });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Jobs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <Textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Enter one or more prompts, each on a new line..."
            // Disable the textarea if the form is disabled or pending
            disabled={disabled || isPending}
            rows={5}
          />
          <Button
            onClick={handleSubmit}
            // Disable the button if the form is disabled, pending, or the prompt is empty
            disabled={disabled || isPending || prompt.trim().length === 0}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Jobs'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
