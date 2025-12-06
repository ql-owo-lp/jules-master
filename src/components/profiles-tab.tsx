
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Edit, Trash2, CheckCircle } from 'lucide-react';

type Profile = {
    id: string;
    name: string;
    githubToken: string | null;
    julesApiKey: string | null;
    isActive: boolean;
    createdAt: string;
};

export function ProfilesTab() {
    const { toast } = useToast();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
    const [newProfileName, setNewProfileName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchProfiles = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/profiles');
            if (!res.ok) throw new Error('Failed to fetch profiles');
            const data = await res.json();
            setProfiles(data);
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to load profiles",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    const handleCreateOrUpdate = async () => {
        if (!newProfileName.trim()) return;
        setIsSubmitting(true);
        try {
            const action = editingProfile ? 'update' : 'create';
            const body = editingProfile
                ? { action, id: editingProfile.id, name: newProfileName }
                : { action, name: newProfileName };

            const res = await fetch('/api/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) throw new Error('Operation failed');

            await fetchProfiles();
            setIsDialogOpen(false);
            setEditingProfile(null);
            setNewProfileName("");
            toast({ title: "Success", description: "Profile saved successfully" });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to save profile",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSetActive = async (id: string) => {
        try {
            const res = await fetch('/api/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'set_active', id }),
            });
             if (!res.ok) throw new Error('Failed to set active profile');
             await fetchProfiles();
             toast({ title: "Profile Activated", description: "Switched to new profile." });
             // Reload page to reflect changes across the app
             window.location.reload();
        } catch (error) {
             toast({
                title: "Error",
                description: "Failed to switch profile",
                variant: "destructive",
            });
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this profile? All associated data might be lost.")) return;
        try {
             const res = await fetch('/api/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', id }),
            });
            if (!res.ok) {
                 const data = await res.json();
                 throw new Error(data.error || 'Failed to delete profile');
            }
            await fetchProfiles();
             toast({ title: "Profile Deleted", description: "Profile has been removed." });
        } catch (error: any) {
             toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        }
    }

    const openDialog = (profile?: Profile) => {
        if (profile) {
            setEditingProfile(profile);
            setNewProfileName(profile.name);
        } else {
            setEditingProfile(null);
            setNewProfileName("");
        }
        setIsDialogOpen(true);
    };

    if (loading) return <div><Loader2 className="animate-spin" /> Loading profiles...</div>;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Profiles</CardTitle>
                        <CardDescription>Manage multiple profiles for different settings and API keys.</CardDescription>
                    </div>
                    <Button onClick={() => openDialog()}>
                        <Plus className="mr-2 h-4 w-4" /> Add Profile
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
                                        {profile.isActive && <span className="flex items-center text-green-600"><CheckCircle className="w-4 h-4 mr-1" /> Active</span>}
                                    </TableCell>
                                    <TableCell>{new Date(profile.createdAt).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        {!profile.isActive && (
                                            <Button variant="outline" size="sm" onClick={() => handleSetActive(profile.id)}>Select</Button>
                                        )}
                                        <Button variant="ghost" size="icon" onClick={() => openDialog(profile)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(profile.id)} disabled={profile.isActive} className="text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingProfile ? 'Edit Profile' : 'Create Profile'}</DialogTitle>
                        <DialogDescription>
                            Enter a name for the profile.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Name
                            </Label>
                            <Input
                                id="name"
                                value={newProfileName}
                                onChange={(e) => setNewProfileName(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateOrUpdate} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin w-4 h-4" /> : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
