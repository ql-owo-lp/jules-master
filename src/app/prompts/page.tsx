"use client";

import { useState, useEffect } from "react";
import type { PredefinedPrompt } from "@/lib/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { BookText, Plus, Edit, Trash2, MoreHorizontal, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { addPrompt, updatePrompt, deletePrompt, getPrompts } from "./actions";
import { Skeleton } from "@/components/ui/skeleton";

export default function PredefinedPromptsPage() {
  const [prompts, setPrompts] = useState<PredefinedPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<PredefinedPrompt | null>(
    null
  );
  const [title, setTitle] = useState("");
  const [promptText, setPromptText] = useState("");
  const { toast } = useToast();

  const fetchPrompts = async () => {
    setIsLoading(true);
    const fetchedPrompts = await getPrompts();
    setPrompts(fetchedPrompts);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  const handleAddNew = () => {
    setCurrentPrompt(null);
    setTitle("");
    setPromptText("");
    setIsDialogOpen(true);
  };

  const handleEdit = (prompt: PredefinedPrompt) => {
    setCurrentPrompt(prompt);
    setTitle(prompt.title);
    setPromptText(prompt.prompt);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await deletePrompt(id);
    await fetchPrompts();
    toast({
      title: "Prompt deleted",
      description: "The predefined prompt has been removed.",
    });
  };

  const handleSave = async () => {
    if (!title.trim() || !promptText.trim()) {
      toast({
        variant: "destructive",
        title: "Missing fields",
        description: "Both title and prompt text are required.",
      });
      return;
    }

    if (currentPrompt?.id) {
      await updatePrompt(currentPrompt.id, { title, prompt: promptText });
      toast({
        title: "Prompt updated",
        description: "Your predefined prompt has been saved.",
      });
    } else {
      await addPrompt({ title, prompt: promptText });
      toast({
        title: "Prompt added",
        description: "Your new predefined prompt has been created.",
      });
    }

    await fetchPrompts();
    setIsDialogOpen(false);
  };

  return (
    <>
      <div className="flex flex-col flex-1 bg-background">
        <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
          <div className="container mx-auto max-w-4xl space-y-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <BookText className="h-6 w-6" />
                    <CardTitle>Predefined Prompts</CardTitle>
                  </div>
                  <CardDescription>
                    Manage your predefined prompts for session creation.
                  </CardDescription>
                </div>
                <Button onClick={handleAddNew}>
                  <Plus className="mr-2 h-4 w-4" /> Add New
                </Button>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : prompts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-10 border-2 border-dashed rounded-lg bg-background">
                    <p className="font-semibold text-lg">No Prompts Yet</p>
                    <p className="text-sm">
                      Click "Add New" to create your first predefined prompt.
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Prompt (Excerpt)</TableHead>
                          <TableHead className="w-[80px] text-right">
                            Actions
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {prompts.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">
                              {p.title}
                            </TableCell>
                            <TableCell className="text-muted-foreground max-w-sm truncate">
                              {p.prompt}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem onClick={() => handleEdit(p)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(p.id!)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {currentPrompt ? "Edit Prompt" : "Add New Prompt"}
            </DialogTitle>
            <DialogDescription>
              {currentPrompt
                ? "Update the details for your predefined prompt."
                : "Create a new reusable prompt for faster session creation."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="title" className="text-right">
                Title
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="col-span-3"
                placeholder="e.g., Create React Component"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="prompt-text" className="text-right pt-2">
                Prompt
              </Label>
              <Textarea
                id="prompt-text"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                className="col-span-3"
                rows={6}
                placeholder="Enter the full prompt text here..."
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSave}>Save Prompt</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
