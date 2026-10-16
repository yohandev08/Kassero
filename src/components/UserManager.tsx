'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { UserProfile, UserRole } from '@/types';
import {
  fetchAllProfiles,
  updateUserRole,
  createStaffAccount,
} from '@/services/user.Service';
import { useAuth } from '@/context/AuthContext';
import { useAlert } from '@/context/AlertContext';
import {
  Users,
  ShieldCheck,
  Crown,
  User,
  PlusCircle,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Lock,
  Mail,
  Calendar,
  KeyRound,
  Loader2,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// UI Components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function UserManager(): React.JSX.Element {
  const { user, isSuperAdmin, refreshProfile } = useAuth();
  const { showAlert, showConfirm } = useAlert();

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  // Add Staff Modal State
  const [isAddStaffOpen, setIsAddStaffOpen] = useState<boolean>(false);
  const [newFullName, setNewFullName] = useState<string>('');
  const [newEmail, setNewEmail] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newRole, setNewRole] = useState<UserRole>('cashier');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Edit Role Modal State
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [targetRole, setTargetRole] = useState<UserRole>('cashier');
  const [isUpdatingRole, setIsUpdatingRole] = useState<boolean>(false);

  // Fetch all staff profiles
  const loadProfiles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await fetchAllProfiles();
    if (error) {
      console.error('Error fetching staff profiles:', error);
      showAlert(
        'Could not retrieve staff accounts. Make sure the profiles table is configured in Supabase.',
        'Failed to load staff list'
      );
    } else {
      setProfiles(data);
    }
    setLoading(false);
  }, [showAlert]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const executeRoleChange = async () => {
    if (!editingProfile) return;

    setIsUpdatingRole(true);
    const { error } = await updateUserRole(editingProfile.id, targetRole);
    setIsUpdatingRole(false);

    if (error) {
      showAlert(error.message, 'Role Update Failed');
    } else {
      showAlert(
        `${editingProfile.full_name || editingProfile.email} is now a ${targetRole.toUpperCase()}.`,
        'Role Updated Successfully'
      );
      setEditingProfile(null);
      await loadProfiles();
      if (editingProfile.id === user?.id) {
        await refreshProfile();
      }
    }
  };

  // Handle Role Change
  const handleConfirmRoleChange = () => {
    if (!editingProfile) return;

    // Guard against self-demotion if you're the only superadmin
    if (editingProfile.id === user?.id && targetRole !== 'superadmin') {
      showConfirm(
        'You are about to remove your own Superadmin privileges. You may lose access to this management dashboard. Proceed anyway?',
        () => {
          executeRoleChange();
        },
        'Demoting Your Own Account'
      );
      return;
    }

    executeRoleChange();
  };

  // Handle Add Staff
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newFullName) {
      showAlert('Please provide full name, email address, and a temporary password.', 'Missing Fields');
      return;
    }

    if (newPassword.length < 6) {
      showAlert('Password must be at least 6 characters long.', 'Password Too Short');
      return;
    }

    setIsSubmitting(true);
    const { success, error } = await createStaffAccount(
      newEmail.trim(),
      newPassword,
      newFullName.trim(),
      newRole
    );
    setIsSubmitting(false);

    if (!success || error) {
      showAlert(error?.message || 'Could not register staff in Supabase.', 'Failed to Create Staff Account');
    } else {
      showAlert(
        `Account for ${newFullName} (${newRole.toUpperCase()}) was created successfully. They can now sign in.`,
        'Staff Member Created!'
      );
      // Reset form and close dialog
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setNewRole('cashier');
      setIsAddStaffOpen(false);
      await loadProfiles();
    }
  };

  // Filter profiles based on search and selected role
  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch =
      (p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      p.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || p.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Role Counts
  const counts = {
    total: profiles.length,
    superadmins: profiles.filter((p) => p.role === 'superadmin').length,
    admins: profiles.filter((p) => p.role === 'admin').length,
    cashiers: profiles.filter((p) => p.role === 'cashier').length,
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4">
        <div className="bg-destructive/10 p-4 rounded-2xl text-destructive">
          <Lock className="w-12 h-12" />
        </div>
        <h2 className="text-xl font-black text-foreground">Access Restricted</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Staff & Role Management is only available to store Superadmins. Please contact the store owner if you require access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="bg-amber-500/15 p-2 rounded-xl text-amber-500">
              <Crown className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Staff & Role Management
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Control employee access levels across Kassero POS, Inventory, and Financial Analytics.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={loadProfiles}
            disabled={loading}
            className="rounded-xl h-10 font-bold gap-2 cursor-pointer"
          >
            <RotateCcw className={cn('w-4 h-4', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            onClick={() => setIsAddStaffOpen(true)}
            className="rounded-xl h-10 font-bold gap-2 cursor-pointer shadow-md shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Staff Member</span>
          </Button>
        </div>
      </div>

      {/* 2. Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
        <Card className="rounded-2xl border-border/50 shadow-xs bg-card">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Staff</span>
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Users className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <span className="text-2xl sm:text-3xl font-black">{counts.total}</span>
            <p className="text-[11px] text-muted-foreground mt-1">Registered store accounts</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-xs bg-card">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Cashiers</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <User className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
              {counts.cashiers}
            </span>
            <p className="text-[11px] text-muted-foreground mt-1">POS & Utang checkout access</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-xs bg-card">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Admins</span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <span className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">
              {counts.admins}
            </span>
            <p className="text-[11px] text-muted-foreground mt-1">Managers (Stock & Ledger)</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-xs bg-card">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Superadmins</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Crown className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 pt-0">
            <span className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
              {counts.superadmins}
            </span>
            <p className="text-[11px] text-muted-foreground mt-1">Owners (Full control & Analytics)</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Role Permissions Reference Card */}
      <Card className="rounded-2xl border-border/50 bg-primary/5 border-primary/20 overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                Store Hierarchy & Permission Matrix
              </h3>
              <p className="text-xs text-muted-foreground">
                Kassero enforces Role-Based Access Control (RBAC) to prevent unauthorized pricing edits and protect profit data.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-background border border-border/50">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Cashier:</span>
                <p className="text-muted-foreground text-[11px] mt-0.5">POS counter register & customer utang repayments.</p>
              </div>
              <div className="p-2.5 rounded-xl bg-background border border-border/50">
                <span className="font-bold text-blue-600 dark:text-blue-400">Store Admin:</span>
                <p className="text-muted-foreground text-[11px] mt-0.5">Inventory restocking, adding products & credit limits.</p>
              </div>
              <div className="p-2.5 rounded-xl bg-background border border-border/50">
                <span className="font-bold text-amber-600 dark:text-amber-400">Superadmin:</span>
                <p className="text-muted-foreground text-[11px] mt-0.5">Full access: Net profit analytics & staff management.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. Staff Accounts Table Card */}
      <Card className="rounded-2xl border-border/50 shadow-sm bg-card overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-black text-foreground">Staff Accounts</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                All registered employees and their assigned authorization level.
              </CardDescription>
            </div>

            {/* Filter and Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search staff name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 rounded-xl bg-muted/40 text-xs"
                />
              </div>

              <Select value={roleFilter} onValueChange={(val) => { if (val) setRoleFilter(val as 'all' | UserRole); }}>
                <SelectTrigger className="h-9 w-full sm:w-36 rounded-xl text-xs font-bold">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="cashier">Cashiers</SelectItem>
                  <SelectItem value="admin">Store Admins</SelectItem>
                  <SelectItem value="superadmin">Superadmins</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs font-semibold">Loading staff accounts...</p>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="text-center p-12 text-muted-foreground space-y-2">
              <Users className="w-10 h-10 mx-auto text-muted-foreground/50" />
              <p className="text-sm font-bold text-foreground">No accounts found</p>
              <p className="text-xs">Try adjusting your search query or role filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-xs font-bold uppercase tracking-wider pl-4 sm:pl-6">Employee</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider">Assigned Role</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider hidden md:table-cell">Account ID</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider hidden sm:table-cell">Registered</TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-right pr-4 sm:pr-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map((p) => {
                    const isSelf = p.id === user?.id;

                    return (
                      <TableRow key={p.id} className="hover:bg-muted/20 transition-colors">
                        <TableCell className="pl-4 sm:pl-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                              {(p.full_name || p.email)[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground truncate">
                                  {p.full_name || 'Unnamed Staff'}
                                </span>
                                {isSelf && (
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 font-bold border-primary/30 text-primary">
                                    You
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="w-3 h-3 text-muted-foreground/70" />
                                {p.email}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          {p.role === 'superadmin' && (
                            <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 gap-1.5 font-bold text-xs py-1 px-2.5">
                              <Crown className="w-3 h-3" />
                              Superadmin (Owner)
                            </Badge>
                          )}
                          {p.role === 'admin' && (
                            <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 gap-1.5 font-bold text-xs py-1 px-2.5">
                              <ShieldCheck className="w-3 h-3" />
                              Store Admin
                            </Badge>
                          )}
                          {p.role === 'cashier' && (
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 gap-1.5 font-bold text-xs py-1 px-2.5">
                              <User className="w-3 h-3" />
                              Cashier
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="hidden md:table-cell text-xs font-mono text-muted-foreground">
                          {p.id.slice(0, 8)}...{p.id.slice(-4)}
                        </TableCell>

                        <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                          {p.created_at
                            ? new Date(p.created_at).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })
                            : 'N/A'}
                        </TableCell>

                        <TableCell className="text-right pr-4 sm:pr-6">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingProfile(p);
                              setTargetRole(p.role);
                            }}
                            className="rounded-xl h-8 px-3 text-xs font-bold gap-1.5 cursor-pointer hover:bg-muted"
                          >
                            <span>Change Role</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. ADD STAFF DIALOG */}
      <Dialog open={isAddStaffOpen} onOpenChange={setIsAddStaffOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              <PlusCircle className="w-5 h-5 text-primary" />
              Register New Staff Account
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create a new user profile with specific authorization in Kassero.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateStaff} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Full Name
              </Label>
              <Input
                placeholder="e.g. Maria Santos"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                required
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Email Address
              </Label>
              <Input
                type="email"
                placeholder="cashier@kassero.store"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Temporary Password
              </Label>
              <Input
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="h-10 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Assigned Role
              </Label>
              <Select value={newRole} onValueChange={(val) => { if (val) setNewRole(val as UserRole); }}>
                <SelectTrigger className="h-10 rounded-xl text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="cashier">
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Cashier (POS & Counter)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-500" />
                      <span>Store Admin (Inventory & Restock)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="superadmin">
                    <div className="flex items-center gap-2">
                      <Crown className="w-3.5 h-3.5 text-amber-500" />
                      <span>Superadmin (Owner - Full Access)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddStaffOpen(false)}
                className="rounded-xl font-bold cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl font-bold cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                <span>Create Staff Account</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 6. EDIT ROLE DIALOG */}
      <Dialog open={!!editingProfile} onOpenChange={(open) => !open && setEditingProfile(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-black">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Update Authorization Role
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Modify permissions for {editingProfile?.full_name || editingProfile?.email}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 text-xs space-y-1">
              <div className="font-bold text-foreground">Current Account:</div>
              <div className="text-muted-foreground">{editingProfile?.email}</div>
              <div className="text-muted-foreground font-medium">
                Current Role: <span className="font-bold uppercase text-foreground">{editingProfile?.role}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Select New Role
              </Label>
              <Select value={targetRole} onValueChange={(val) => { if (val) setTargetRole(val as UserRole); }}>
                <SelectTrigger className="h-11 rounded-xl text-xs font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="cashier">
                    <div className="py-1">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <User className="w-3.5 h-3.5" /> Cashier
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Restricted to POS checkout and utang recording.
                      </p>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="py-1">
                      <div className="font-bold flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                        <ShieldCheck className="w-3.5 h-3.5" /> Store Admin (Manager)
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Access to POS, Customer Ledger, and Inventory Restocking.
                      </p>
                    </div>
                  </SelectItem>
                  <SelectItem value="superadmin">
                    <div className="py-1">
                      <div className="font-bold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <Crown className="w-3.5 h-3.5" /> Superadmin (Owner)
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Unrestricted access to all modules, profit analytics, and user management.
                      </p>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingProfile(null)}
              className="rounded-xl font-bold cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRoleChange}
              disabled={isUpdatingRole || targetRole === editingProfile?.role}
              className="rounded-xl font-bold cursor-pointer gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isUpdatingRole ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Save Changes</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
