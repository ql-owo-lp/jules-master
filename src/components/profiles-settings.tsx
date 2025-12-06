
import React, { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter
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
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Edit, Trash2, MoreHorizontal, Check, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getProfiles, createProfile, renameProfile, deleteProfile, switchProfile, Profile } from "@/app/profiles/actions";

export function ProfilesSettings() {
    const { toast } = useToast();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
    const [profileName, setProfileName] = useState("");

    useEffect(() => {
        loadProfiles();
    }, []);

    const loadProfiles = async () => {
        setIsLoading(true);
        try {
            const data = await getProfiles();
            setProfiles(data);
        } catch (error) {
            console.error("Failed to load profiles", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingProfile(null);
        setProfileName("");
        setDialogOpen(true);
    };

    const handleEdit = (profile: Profile) => {
        setEditingProfile(profile);
        setProfileName(profile.name);
        setDialogOpen(true);
    };

    const handleSave = () => {
        if (!profileName.trim()) return;

        startTransition(async () => {
            try {
                if (editingProfile) {
                    await renameProfile(editingProfile.id, profileName);
                    toast({ title: "Profile renamed" });
                } else {
                    await createProfile(profileName);
                    toast({ title: "Profile created" });
                }
                setDialogOpen(false);
                loadProfiles();
            } catch (error) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to save profile."
                });
            }
        });
    };

    const handleDelete = (id: string) => {
         // eslint-disable-next-line no-restricted-globals
         if (!confirm("Are you sure? This will delete all settings, jobs, and sessions associated with this profile.")) return;

         startTransition(async () => {
            try {
                await deleteProfile(id);
                toast({ title: "Profile deleted" });
                loadProfiles();
            } catch (error: any) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: error.message || "Failed to delete profile."
                });
            }
        });
    };

    const handleSwitch = (id: string) => {
        startTransition(async () => {
            try {
                await switchProfile(id);
                toast({ title: "Profile switched", description: "Reloading application..." });
                // We reload to ensure all data contexts are refreshed
                window.location.reload();
            } catch (error) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to switch profile."
                });
            }
        });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Profiles</CardTitle>
                        <CardDescription>Manage multiple profiles with different settings and API keys.</CardDescription>
                    </div>
                    <Button onClick={handleCreate} disabled={isPending}>
                        <Plus className="mr-2 h-4 w-4" /> Create Profile
                    </Button>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Status</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead>Created At</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {profiles.map((profile) => (
                                <TableRow key={profile.id} className={cn(profile.isActive && "bg-muted/50")}>
                                    <TableCell>
                                        {profile.isActive && <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3"/> Active</Badge>}
                                    </TableCell>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <User className="h-4 w-4 text-muted-foreground" />
                                            {profile.name}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {new Date(profile.createdAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {!profile.isActive && (
                                                <Button variant="outline" size="sm" onClick={() => handleSwitch(profile.id)} disabled={isPending}>
                                                    Switch
                                                </Button>
                                            )}
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" disabled={isPending}>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleEdit(profile)}>
                                                        <Edit className="mr-2 h-4 w-4" /> Rename
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleDelete(profile.id)}
                                                        className="text-destructive"
                                                        disabled={profile.isActive} // Cannot delete active profile
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingProfile ? "Rename Profile" : "Create Profile"}</DialogTitle>
                        <DialogDescription>
                            Enter a name for the profile.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">Name</Label>
                            <Input
                                id="name"
                                value={profileName}
                                onChange={(e) => setProfileName(e.target.value)}
                                className="col-span-3"
                                placeholder="My Profile"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSave} disabled={isPending}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
