import { Navigate, Route, Routes } from 'react-router-dom';
import { SettingsSidebar } from '@/components/settings/SettingsSidebar';
import {
  CaptureSettings,
  DataSourcesSettings,
  AISettings,
  CategoriesSettings,
  GeneralSettings,
  BackfillSettings,
} from '@/components/settings/sections';

export function SettingsPage() {
  return (
    <div className="h-full flex -mx-4 sm:-mx-6 -my-6">
      <SettingsSidebar />
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl p-6">
          <Routes>
            <Route index element={<Navigate to="capture" replace />} />
            <Route path="capture" element={<CaptureSettings />} />
            <Route path="data-sources" element={<DataSourcesSettings />} />
            <Route path="ai" element={<AISettings />} />
            <Route path="categories" element={<CategoriesSettings />} />
            <Route path="general" element={<GeneralSettings />} />
            <Route path="backfill" element={<BackfillSettings />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
