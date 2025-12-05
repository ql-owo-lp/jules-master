
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, CheckCircle2, UserCircle2, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

type Profile = {
  id: string;
  name: string;
  isSelected: boolean;
  createdAt: string;
};

interface ProfilesListProps {
  profiles: Profile[];
  onRefresh: () => void;
}

export function ProfilesList({ profiles, onRefresh }: ProfilesListProps) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;

    startTransition(async () => {
        try {
            const res = await fetch('/api/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newProfileName })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to create profile');
            }

            setNewProfileName("");
            setIsDialogOpen(false);
            onRefresh();
            toast({ title: "Profile created" });
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });
  };

  const handleRenameProfile = async () => {
    if (!editingProfile || !newProfileName.trim()) return;

    startTransition(async () => {
         try {
            const res = await fetch(`/api/profiles/${editingProfile.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newProfileName })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to update profile');
            }

            setEditingProfile(null);
            setNewProfileName("");
            setIsDialogOpen(false);
            onRefresh();
            toast({ title: "Profile updated" });
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });
  };

  const handleDeleteProfile = async () => {
    if (!profileToDelete) return;

    startTransition(async () => {
         try {
            const res = await fetch(`/api/profiles/${profileToDelete.id}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to delete profile');
            }

            setProfileToDelete(null);
            setIsDeleteDialogOpen(false);
            onRefresh();
            toast({ title: "Profile deleted" });
        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });
  }

  const handleSelectProfile = async (id: string) => {
    startTransition(async () => {
        try {
            const res = await fetch('/api/profiles/select', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });

             if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to select profile');
            }

            onRefresh();
            // We need to reload the page or trigger a re-fetch of settings
            // For now, refreshing the router might work to re-run effects in page
            router.refresh();
            // Also need to tell parent to re-fetch settings, which `onRefresh` effectively does if it triggers parent update
            // But here `onRefresh` only refreshes profiles list usually.
            // The parent `SettingsPage` should listen to profile changes?
            // Or we just reload the window for simplicity to ensure all contexts are updated.
            window.location.reload();

        } catch (error: any) {
             toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });
  };

  const openCreateDialog = () => {
      setEditingProfile(null);
      setNewProfileName("");
      setIsDialogOpen(true);
  }

  const openEditDialog = (profile: Profile) => {
      setEditingProfile(profile);
      setNewProfileName(profile.name);
      setIsDialogOpen(true);
  }

  const openDeleteDialog = (profile: Profile) => {
      setProfileToDelete(profile);
      setIsDeleteDialogOpen(true);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Profiles</CardTitle>
          <CardDescription>Manage different configurations.</CardDescription>
        </div>
        <Button onClick={openCreateDialog} disabled={isPending}>
          <Plus className="mr-2 h-4 w-4" /> Create Profile
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => (
              <TableRow key={profile.id}>
                <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                         <UserCircle2 className="h-4 w-4 text-muted-foreground"/>
                         {profile.name}
                    </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{new Date(profile.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                    {profile.isSelected && <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Active</Badge>}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  {!profile.isSelected && (
                      <Button variant="outline" size="sm" onClick={() => handleSelectProfile(profile.id)} disabled={isPending}>
                        Select
                      </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openEditDialog(profile)} disabled={isPending}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openDeleteDialog(profile)}
                    disabled={isPending || profile.isSelected || profiles.length <= 1}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{editingProfile ? 'Rename Profile' : 'Create Profile'}</DialogTitle>
                <DialogDescription>
                    {editingProfile ? 'Enter the new name for the profile.' : 'Enter a name for the new profile.'}
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} className="col-span-3" />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={editingProfile ? handleRenameProfile : handleCreateProfile} disabled={isPending}>Save</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
           <DialogContent>
            <DialogHeader>
                <DialogTitle>Delete Profile</DialogTitle>
                <DialogDescription>
                    Are you sure you want to delete the profile "{profileToDelete?.name}"? This action cannot be undone.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDeleteProfile} disabled={isPending}>Delete</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
