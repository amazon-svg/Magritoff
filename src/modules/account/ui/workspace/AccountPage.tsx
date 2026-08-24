/**
 * Adaptateur brownfield de la contribution workspace du module account.
 * La vue ne connaît ni AuthContext, ni PreferencesContext, ni Supabase.
 */
import { useState } from 'react';
import { useAuth } from '@/modules/account/ui/runtime/AuthContext';
import { usePreferences } from '@/modules/account/ui/runtime/PreferencesContext';
import { AccountSettingsView } from '@/modules/account/ui/workspace/AccountSettingsView';

export function DashboardAccount() {
  const { user, updateProfile } = useAuth();
  const { prefs, update } = usePreferences();
  const [fullName, setFullName] = useState<string>((user?.user_metadata?.full_name as string) ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const saveProfile = async () => {
    setSaving(true);
    setMessage(null);
    const { error } = await updateProfile({ fullName });
    setSaving(false);
    setMessage(error ? `Erreur : ${error.message}` : 'Profil mis à jour.');
  };

  return (
    <AccountSettingsView
      email={user?.email ?? ''}
      fullName={fullName}
      saving={saving}
      message={message}
      preferences={{
        theme: prefs.theme,
        language: prefs.language,
        defaultDeliveryZone: prefs.default_delivery_zone,
        notificationsEmail: prefs.notifications_email,
      }}
      onFullNameChange={setFullName}
      onSaveProfile={() => void saveProfile()}
      onThemeChange={(theme) => void update({ theme })}
      onLanguageChange={(language) => void update({ language })}
      onDeliveryZoneChange={(default_delivery_zone) => void update({ default_delivery_zone })}
      onNotificationsEmailChange={(notifications_email) => void update({ notifications_email })}
    />
  );
}
