
"use client";

import React, { useState } from 'react';
import { useProfiles, Profile } from '@/hooks/use-profiles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { MoreHorizontal, Plus, Edit, Trash2, CheckCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

export function ProfilesTab() {
  const { profiles, activeProfile, addProfile, updateProfile, deleteProfile, switchProfile } = useProfiles();
  const { toast } = useToast();
  const [dialogState, setDialogState] = useState<{ isOpen: boolean; data: Profile | null }>({ isOpen: false, data: null });
  const [profileName, setProfileName] = useState('');

  const openDialog = (data: Profile | null = null) => {
    setDialogState({ isOpen: true, data });
    setProfileName(data?.name || '');
  };

  const closeDialog = () => {
    setDialogState({ isOpen: false, data: null });
  };

  const handleSave = () => {
    if (!profileName.trim()) {
      toast({ variant: 'destructive', title: 'Missing field', description: 'Profile name is required.' });
      return;
    }

    if (dialogState.data) {
      updateProfile(dialogState.data.id, profileName);
      toast({ title: 'Profile updated' });
    } else {
      addProfile(profileName);
      toast({ title: 'Profile added' });
    }
    closeDialog();
  };

  const handleDelete = (id: string) => {
    if (profiles.length <= 1) {
        toast({ variant: 'destructive', title: 'Cannot delete', description: 'You must have at least one profile.' });
        return;
    }
    deleteProfile(id);
    toast({ title: 'Profile deleted' });
  };

  const handleSwitch = (id: string) => {
    switchProfile(id);
    toast({ title: 'Profile switched' });
  }

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Profiles</h2>
            <Button onClick={() => openDialog()}>
                <Plus className="mr-2 h-4 w-4" /> Add New Profile
            </Button>
        </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.map((profile) => (
              <TableRow key={profile.id}>
                <TableCell className="font-medium">{profile.name}</TableCell>
                <TableCell>
                  {profile.isActive ? (
                    <div className="flex items-center text-green-600">
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Active
                    </div>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => handleSwitch(profile.id)}>
                        Set Active
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => openDialog(profile)}>
                        <Edit className="mr-2 h-4 w-4" /> Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(profile.id)}
                        className="text-destructive"
                        disabled={profiles.length <= 1}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

       <Dialog open={dialogState.isOpen} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{dialogState.data ? 'Edit Profile' : 'Add New Profile'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input
                id="name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="col-span-3"
                placeholder="e.g., Personal, Work"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
