import { SettingsCard } from '../SettingsCard';
import { CategoriesTab } from '../CategoriesTab';
import { TimelineCategoriesTab } from '../TimelineCategoriesTab';

export function CategoriesSettings() {
  return (
    <div className="space-y-6">
      <SettingsCard
        title="App Categories"
        description="Categorize apps to calculate productivity scores in analytics"
      >
        <CategoriesTab />
      </SettingsCard>

      <SettingsCard
        title="Timeline Categories"
        description="Customize how activities are grouped in the timeline"
      >
        <TimelineCategoriesTab />
      </SettingsCard>
    </div>
  );
}
