import { useState } from 'react';
import { Settings, Lock, DollarSign, Target, Trash2, Palette, Bell } from 'lucide-react';
import { useStarBankStore } from '../store/starBankStore';
import { AppSettings, KidProfile } from '../types';

interface SettingsPageProps {
  onBack: () => void;
}

export default function SettingsPage({ onBack }: SettingsPageProps) {
  const currentSettings = useStarBankStore((state) => state.settings);
  const [parentPin, setParentPin] = useState(useStarBankStore((state) => state.settings.parentPin));
  const [starRate, setStarRate] = useState(useStarBankStore((state) => state.settings.starToDollarRate));
  const [dailyLimit, setDailyLimit] = useState(useStarBankStore((state) => state.settings.dailyStarLimit));
  const [defaultTasks, setDefaultTasks] = useState(useStarBankStore((state) => state.settings.defaultTasks));
  const [theme, setTheme] = useState(useStarBankStore((state) => state.settings.theme));
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    useStarBankStore((state) => state.settings.notificationsEnabled),
  );
  const [dailyNotificationHour, setDailyNotificationHour] = useState(
    useStarBankStore((state) => state.settings.dailyNotificationHour),
  );
  const [kids, setKids] = useState<KidProfile[]>(currentSettings.kids);
  const [activeKidId, setActiveKidId] = useState(currentSettings.activeKidId);
  const [newKidName, setNewKidName] = useState('');
  const [newTask, setNewTask] = useState('');
  const [saved, setSaved] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'denied',
  );

  const updateSettings = useStarBankStore((state) => state.updateSettings);
  const setActiveKid = useStarBankStore((state) => state.setActiveKid);

  const createLocalKidId = () => `kid-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const handleSave = () => {
    const cleanedKids = kids
      .map((kid) => ({ ...kid, name: kid.name.trim() }))
      .filter((kid) => kid.name.length > 0);

    const finalKids = cleanedKids.length > 0 ? cleanedKids : [{ id: 'kid-default', name: 'Child' }];
    const finalActiveKidId = finalKids.some((kid) => kid.id === activeKidId)
      ? activeKidId
      : finalKids[0].id;

    updateSettings({
      kids: finalKids,
      activeKidId: finalActiveKidId,
      parentPin: parentPin || '1234',
      starToDollarRate: Math.max(1, starRate),
      dailyStarLimit: Math.max(1, dailyLimit),
      defaultTasks,
      theme,
      notificationsEnabled,
      dailyNotificationHour: Math.min(23, Math.max(0, dailyNotificationHour)),
    });
    setActiveKid(finalActiveKidId);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      setNotificationStatus('denied');
      return;
    }
    const permission = await Notification.requestPermission();
    setNotificationStatus(permission);
  };

  const handleAddKid = () => {
    const name = newKidName.trim();
    if (!name) return;

    const newKid: KidProfile = {
      id: createLocalKidId(),
      name,
    };
    setKids((prev) => [...prev, newKid]);
    setActiveKidId(newKid.id);
    setNewKidName('');
  };

  const handleRemoveKid = (kidId: string) => {
    if (kids.length <= 1) return;

    const updatedKids = kids.filter((kid) => kid.id !== kidId);
    setKids(updatedKids);
    if (activeKidId === kidId && updatedKids.length > 0) {
      setActiveKidId(updatedKids[0].id);
    }
  };

  const handleKidNameChange = (kidId: string, name: string) => {
    setKids((prev) => prev.map((kid) => (kid.id === kidId ? { ...kid, name } : kid)));
  };

  const handleAddTask = () => {
    if (newTask.trim() && !defaultTasks.includes(newTask)) {
      setDefaultTasks([...defaultTasks, newTask]);
      setNewTask('');
    }
  };

  const handleRemoveTask = (index: number) => {
    setDefaultTasks(defaultTasks.filter((_, i) => i !== index));
  };

  const themeOptions: { value: AppSettings['theme']; label: string; preview: string }[] = [
    { value: 'sunny', label: 'Sunny Yellow', preview: 'from-yellow-200 via-amber-100 to-orange-100' },
    { value: 'sky', label: 'Sky Blue', preview: 'from-sky-200 via-cyan-100 to-indigo-100' },
    { value: 'forest', label: 'Forest Green', preview: 'from-green-200 via-emerald-100 to-lime-100' },
    { value: 'candy', label: 'Candy Pink', preview: 'from-pink-200 via-rose-100 to-fuchsia-100' },
  ];

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-8">
          <Settings className="w-8 h-8 text-star-600" />
          <h2 className="text-3xl font-bold text-gray-800">Settings</h2>
        </div>

        <div className="space-y-6">
          {/* Kids */}
          <div className="bg-white rounded-lg p-6 shadow-md">
            <label className="block text-sm font-bold text-gray-700 mb-3">Kids Profiles</label>
            <div className="space-y-3">
              {kids.map((kid) => (
                <div key={kid.id} className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg">
                  <input
                    type="radio"
                    checked={activeKidId === kid.id}
                    onChange={() => setActiveKidId(kid.id)}
                    title="Set active kid"
                  />
                  <input
                    type="text"
                    value={kid.name}
                    onChange={(e) => handleKidNameChange(kid.id, e.target.value)}
                    className="flex-1 p-2 border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={() => handleRemoveKid(kid.id)}
                    disabled={kids.length <= 1}
                    className="p-2 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors disabled:opacity-40"
                    title={kids.length <= 1 ? 'At least one kid is required' : 'Remove kid'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={newKidName}
                onChange={(e) => setNewKidName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddKid();
                  }
                }}
                placeholder="Add another kid"
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-star-500 focus:ring-2 focus:ring-star-200"
              />
              <button
                onClick={handleAddKid}
                className="px-4 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors"
              >
                Add Kid
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">Parent and Kid modes will use the selected active kid profile.</p>
          </div>

          {/* Parent PIN */}
          <div className="bg-white rounded-lg p-6 shadow-md">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
              <Lock className="w-4 h-4" /> Parent PIN
            </label>
            <input
              type="password"
              value={parentPin}
              onChange={(e) => setParentPin(e.target.value.slice(0, 4))}
              maxLength={4}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-star-500 focus:ring-2 focus:ring-star-200 font-mono text-2xl tracking-widest text-center"
              placeholder="XXXX"
            />
            <p className="text-xs text-gray-500 mt-2">4-digit PIN to access Parent Mode (numbers recommended)</p>
          </div>

          {/* Star to Dollar Conversion */}
          <div className="bg-white rounded-lg p-6 shadow-md">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
              <DollarSign className="w-4 h-4" /> Star Conversion Rate
            </label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={starRate}
                  onChange={(e) => setStarRate(parseInt(e.target.value) || 1)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-star-500 focus:ring-2 focus:ring-star-200"
                />
              </div>
              <p className="text-lg font-bold">{starRate} ⭐ = $1</p>
            </div>
          </div>

          {/* Daily Star Limit */}
          <div className="bg-white rounded-lg p-6 shadow-md">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
              <Target className="w-4 h-4" /> Daily Star Limit
            </label>
            <input
              type="number"
              min="1"
              max="100"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(parseInt(e.target.value) || 10)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-star-500 focus:ring-2 focus:ring-star-200"
            />
            <p className="text-xs text-gray-500 mt-2">Maximum stars that can be earned per day</p>
          </div>

          {/* Theme Selection */}
          <div className="bg-white rounded-lg p-6 shadow-md">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
              <Palette className="w-4 h-4" /> App Theme
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`text-left rounded-lg border-2 p-3 transition-all ${
                    theme === option.value
                      ? 'border-star-500 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`h-10 rounded-md bg-gradient-to-r ${option.preview} mb-2`} />
                  <p className="font-bold text-gray-800 text-sm">{option.label}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">Theme affects app background and header colors.</p>
          </div>

          {/* Notifications */}
          <div className="bg-white rounded-lg p-6 shadow-md">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
              <Bell className="w-4 h-4" /> Daily Notifications
            </label>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-3">
              <p className="text-sm text-gray-700">Enable daily summary reminders</p>
              <button
                onClick={() => setNotificationsEnabled((prev) => !prev)}
                className={`px-4 py-2 rounded-full text-sm font-bold transition-colors ${
                  notificationsEnabled ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-700'
                }`}
              >
                {notificationsEnabled ? 'On' : 'Off'}
              </button>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-3">
              <p className="text-sm text-gray-700">Browser notification permission</p>
              <button
                onClick={requestNotificationPermission}
                className="px-3 py-1 rounded-full text-sm font-bold bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              >
                {notificationStatus === 'granted' ? 'Granted' : 'Allow'}
              </button>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Reminder Hour (0-23)</label>
              <input
                type="number"
                min="0"
                max="23"
                value={dailyNotificationHour}
                onChange={(e) => setDailyNotificationHour(parseInt(e.target.value) || 18)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-star-500 focus:ring-2 focus:ring-star-200"
              />
              <p className="text-xs text-gray-500 mt-2">The app sends a daily summary when open around this hour.</p>
            </div>
          </div>

          {/* Default Tasks */}
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h3 className="font-bold text-gray-800 mb-4">Default Daily Tasks</h3>
            <div className="space-y-3 mb-4">
              {defaultTasks.map((task, index) => (
                <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                  <span className="text-gray-800">{task}</span>
                  <button
                    onClick={() => handleRemoveTask(index)}
                    className="p-2 hover:bg-red-100 hover:text-red-600 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAddTask();
                  }
                }}
                placeholder="Add a new task"
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-star-500 focus:ring-2 focus:ring-star-200"
              />
              <button
                onClick={handleAddTask}
                className="px-4 py-3 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 transition-colors"
              >
                Add Task
              </button>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex gap-4">
            <button
              onClick={handleSave}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-star-500 to-star-600 text-white rounded-lg font-bold hover:shadow-lg transition-all text-lg"
            >
              Save Settings
            </button>
            <button
              onClick={onBack}
              className="flex-1 px-6 py-3 bg-gray-400 text-white rounded-lg font-bold hover:bg-gray-500 transition-all text-lg"
            >
              Cancel
            </button>
          </div>

          {saved && (
            <div className="bg-green-100 border-l-4 border-green-500 p-4 rounded-lg">
              <p className="text-green-700 font-bold">✓ Settings saved successfully!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

