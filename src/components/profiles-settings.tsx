
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Trash2, Plus, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ProfilesSettingsProps {
    currentProfileId: string;
    onProfileSelect: (profileId: string) => void;
}

export function ProfilesSettings({ currentProfileId, onProfileSelect }: ProfilesSettingsProps) {
    const { toast } = useToast();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newProfileName, setNewProfileName] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    const fetchProfiles = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/profiles');
            if (response.ok) {
                const data = await response.json();
                setProfiles(data);
            }
        } catch (error) {
            console.error("Failed to fetch profiles", error);
             toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to fetch profiles.",
            });
        } finally {
            setIsLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        fetchProfiles();
    }, [fetchProfiles]);

    const handleCreateProfile = async () => {
        if (!newProfileName.trim()) return;
        setIsCreating(true);
        try {
            const response = await fetch('/api/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newProfileName }),
            });

            if (response.ok) {
                const newProfile = await response.json();
                setProfiles([...profiles, newProfile]);
                setNewProfileName("");
                toast({ title: "Profile created" });
            } else {
                 toast({ variant: "destructive", title: "Error", description: "Failed to create profile." });
            }
        } catch (error) {
            console.error("Failed to create profile", error);
            toast({ variant: "destructive", title: "Error", description: "Failed to create profile." });
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteProfile = async (id: string) => {
        if (id === 'default') {
             toast({ variant: "destructive", title: "Error", description: "Cannot delete default profile." });
             return;
        }
        if (id === currentProfileId) {
             toast({ variant: "destructive", title: "Error", description: "Cannot delete currently active profile." });
             return;
        }

        try {
             // Correctly construct the URL with query parameter
            const response = await fetch(`/api/profiles?id=${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                setProfiles(profiles.filter(p => p.id !== id));
                toast({ title: "Profile deleted" });
            } else {
                toast({ variant: "destructive", title: "Error", description: "Failed to delete profile." });
            }
        } catch (error) {
            console.error("Failed to delete profile", error);
             toast({ variant: "destructive", title: "Error", description: "Failed to delete profile." });
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Manage Profiles</CardTitle>
                    <CardDescription>Create and switch between different configuration profiles.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-end gap-4">
                        <div className="grid w-full max-w-sm items-center gap-1.5">
                            <Label htmlFor="new-profile">New Profile Name</Label>
                            <Input
                                id="new-profile"
                                placeholder="e.g. Work, Personal"
                                value={newProfileName}
                                onChange={(e) => setNewProfileName(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleCreateProfile} disabled={isCreating || !newProfileName.trim()}>
                            {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Create Profile
                        </Button>
                    </div>

                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Profile Name</TableHead>
                                    <TableHead>Created At</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-4">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ) : profiles.map((profile) => (
                                    <TableRow key={profile.id} className={cn(profile.id === currentProfileId && "bg-muted/50")}>
                                        <TableCell className="font-medium flex items-center gap-2">
                                            {profile.name}
                                            {profile.id === 'default' && <span className="text-xs text-muted-foreground">(Default)</span>}
                                            {profile.id === currentProfileId && <Check className="h-4 w-4 text-green-500" />}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-sm">
                                            {new Date(profile.createdAt).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right space-x-2">
                                            {profile.id !== currentProfileId && (
                                                <Button variant="outline" size="sm" onClick={() => onProfileSelect(profile.id)}>
                                                    Switch to
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteProfile(profile.id)}
                                                disabled={profile.id === 'default' || profile.id === currentProfileId}
                                                className="text-destructive hover:text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
