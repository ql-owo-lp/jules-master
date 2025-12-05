
import { Users, Check, Edit, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useState, useTransition } from "react";
import { useToast } from "@/hooks/use-toast";

type Profile = {
  id: string;
  name: string;
  isSelected: boolean;
  createdAt: string;
};

interface ProfilesTabProps {
  profiles: Profile[];
  onProfilesChanged: () => void;
}

export function ProfilesTab({ profiles, onProfilesChanged }: ProfilesTabProps) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [newName, setNewName] = useState("");

  const handleCreate = () => {
    if (!newName.trim()) return;
    startTransition(async () => {
        try {
            const res = await fetch('/api/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create profile');
            }
            toast({ title: "Profile created" });
            setNewName("");
            setIsCreateOpen(false);
            onProfilesChanged();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        }
    });
  };

  const handleRename = () => {
      if (!selectedProfile || !newName.trim()) return;
      startTransition(async () => {
          try {
              const res = await fetch(`/api/profiles/${selectedProfile.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: newName }),
              });
              if (!res.ok) {
                  const data = await res.json();
                  throw new Error(data.error || 'Failed to rename profile');
              }
              toast({ title: "Profile renamed" });
              setNewName("");
              setIsRenameOpen(false);
              setSelectedProfile(null);
              onProfilesChanged();
          } catch (error: any) {
              toast({ variant: "destructive", title: "Error", description: error.message });
          }
      });
  };

  const handleDelete = (id: string) => {
      if (!confirm("Are you sure you want to delete this profile? This action cannot be undone.")) return;
      startTransition(async () => {
          try {
              const res = await fetch(`/api/profiles/${id}`, {
                  method: 'DELETE',
              });
              if (!res.ok) {
                  const data = await res.json();
                  throw new Error(data.error || 'Failed to delete profile');
              }
              toast({ title: "Profile deleted" });
              onProfilesChanged();
          } catch (error: any) {
              toast({ variant: "destructive", title: "Error", description: error.message });
          }
      });
  };

  const handleSelect = (id: string) => {
      startTransition(async () => {
          try {
              const res = await fetch('/api/profiles/select', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ id }),
              });
              if (!res.ok) {
                  const data = await res.json();
                  throw new Error(data.error || 'Failed to select profile');
              }
              toast({ title: "Profile selected" });
              onProfilesChanged();
              // Reload page to reflect new settings everywhere?
              // The parent component should probably re-fetch settings when profiles change.
              // But settings are fetched in `SettingsPage` using `useEffect`.
              // We might need to trigger a re-fetch of everything.
              // A full reload is safest for now to ensure all contexts (EnvProvider etc) update if they depend on it.
              window.location.reload();
          } catch (error: any) {
              toast({ variant: "destructive", title: "Error", description: error.message });
          }
      });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6" />
            <CardTitle>Profiles</CardTitle>
          </div>
          <CardDescription>Manage different configuration sets.</CardDescription>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Profile
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {profiles.map((profile) => (
                    <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.name}</TableCell>
                        <TableCell>
                            {profile.isSelected && <Badge variant="secondary"><Check className="w-3 h-3 mr-1"/> Active</Badge>}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                            {new Date(profile.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                            {!profile.isSelected && (
                                <Button variant="outline" size="sm" onClick={() => handleSelect(profile.id)} disabled={isPending}>
                                    Select
                                </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => {
                                setSelectedProfile(profile);
                                setNewName(profile.name);
                                setIsRenameOpen(true);
                            }} disabled={isPending}>
                                <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(profile.id)} disabled={isPending || profile.isSelected || profiles.length <= 1}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Create Profile</DialogTitle>
                <DialogDescription>Add a new profile with default settings.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                    <Label htmlFor="name">Profile Name</Label>
                    <Input id="name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Work, Personal" />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!newName.trim() || isPending}>Create</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Rename Profile</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                    <Label htmlFor="rename">Profile Name</Label>
                    <Input id="rename" value={newName} onChange={(e) => setNewName(e.target.value)} />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
                <Button onClick={handleRename} disabled={!newName.trim() || isPending}>Save</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

    </Card>
  );
}
