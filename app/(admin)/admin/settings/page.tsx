import { requireRole } from '@/lib/auth/requireRole';
import { getSettings } from '@/lib/platformSettings';
import { SettingsForm } from './_components/SettingsForm';

export default async function AdminSettingsPage() {
  await requireRole('ADMIN');

  const settings = await getSettings();

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Platform Settings</h1>
        <p className="text-sm text-gray-400 mt-1">
          Changes take effect immediately for new sessions.
        </p>
      </div>
      <SettingsForm initial={settings} />
    </div>
  );
}
