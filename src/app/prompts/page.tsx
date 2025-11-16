import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { BookText } from "lucide-react";

export default function PredefinedPromptsPage() {
  return (
    <div className="flex flex-col flex-1 bg-background">
      <main className="flex-1 overflow-auto p-4 sm:p-6 md:p-8">
        <div className="container mx-auto max-w-4xl space-y-8">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BookText className="h-6 w-6" />
                <CardTitle>Predefined Prompts</CardTitle>
              </div>
              <CardDescription>
                Manage your predefined prompts here. This feature is coming soon!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-10 border-2 border-dashed rounded-lg bg-background">
                <p className="font-semibold text-lg">Under Construction</p>
                <p className="text-sm">
                  This page will soon allow you to add, edit, and delete your own custom prompt suggestions.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
