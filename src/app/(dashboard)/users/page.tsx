import UserManager from '@/components/UserManager';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Staff Management — Kassero',
  description: 'Manage store staff accounts, permissions, and roles.',
};

export default function UsersPage() {
  return <UserManager />;
}
