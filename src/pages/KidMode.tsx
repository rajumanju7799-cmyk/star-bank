import React from 'react';
import { Star, Zap, TrendingUp, Award, Home, LogOut } from 'lucide-react';
import { useStarBankStore } from '../store/starBankStore';
import { Badge, DailyRecord, SavingsGoal, Task } from '../types';

interface KidModeProps {
  onLogout: () => void;
}

export default function KidMode({ onLogout }: KidModeProps) {
  const [tab, setTab] = React.useState<'home' | 'history' | 'goals' | 'badges'>('home');

  const getTodayStars = useStarBankStore((state) => state.getTodayStars);
  const getTotalStars = useStarBankStore((state) => state.getTotalStars);
  const getAccountBalance = useStarBankStore((state) => state.getAccountBalance);
  const kids = useStarBankStore((state) => state.settings.kids);
  const activeKidId = useStarBankStore((state) => state.settings.activeKidId);
  const setActiveKid = useStarBankStore((state) => state.setActiveKid);
  const starToDollarRate = useStarBankStore((state) => state.settings.starToDollarRate);
  const dailyLimit = useStarBankStore((state) => state.settings.dailyStarLimit);
  const badges = useStarBankStore((state) => state.badges);
  const savingsGoals = useStarBankStore((state) => state.savingsGoals);
  const dailyRecords = useStarBankStore((state) => state.dailyRecords);
  const getTodayRecord = useStarBankStore((state) => state.getTodayRecord);

  const todayStars = getTodayStars();
  const totalStars = getTotalStars();
  const balance = getAccountBalance();
  const activeKid = kids.find((kid) => kid.id === activeKidId);
  const childName = activeKid?.name || 'Kid';
  const progressPercent = (todayStars / dailyLimit) * 100;
  const todayRecord = getTodayRecord();
  const completedToday = todayRecord.tasks.filter((task) => task.completed);
  const pendingToday = todayRecord.tasks.filter((task) => !task.completed);
  const allCompletedTaskNames = Array.from(
    new Set(
      dailyRecords
        .filter((record) => record.kidId === activeKidId)
        .flatMap((record) => record.tasks)
        .filter((task) => task.completed)
        .map((task) => task.name),
    ),
  );

  const allBadges = [
    { name: 'Early Bird', icon: '🌅', description: 'Wake up early 5 days' },
    { name: 'Homework Hero', icon: '📚', description: 'Complete homework 10 times' },
    { name: 'Super Listener', icon: '👂', description: 'Listen well all day 7 times' },
    { name: 'Saving Champion', icon: '🏆', description: 'Save $10' },
    { name: 'First Investor', icon: '📈', description: 'Invest for the first time' },
    { name: 'Generous Giver', icon: '❤️', description: 'Donate $5' },
  ];

  return (
    <div className="min-h-screen pb-20">
      {/* Floating Stars Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute text-4xl opacity-10 animate-bounce"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.1}s`,
            }}
          >
            ⭐
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4">
        {/* Welcome Banner */}
        <div className="mb-8 mt-6">
          <div className="max-w-sm mx-auto mb-4">
            <label className="block text-xs font-bold text-gray-600 mb-1 text-center">Kid Profile</label>
            <select
              value={activeKidId}
              onChange={(e) => setActiveKid(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 font-bold text-gray-800 bg-white"
            >
              {kids.map((kid) => (
                <option key={kid.id} value={kid.id}>{kid.name}</option>
              ))}
            </select>
          </div>

          <h1 className="text-4xl font-bold text-center gradient-text mb-2">
            Welcome, {childName}! 🎉
          </h1>
          <p className="text-center text-gray-600 text-lg">You're doing amazing!</p>
        </div>

        {/* Today's Stars Card */}
        <div className="bg-gradient-to-br from-yellow-200 via-yellow-100 to-orange-100 rounded-3xl p-8 shadow-2xl mb-6">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-yellow-300 rounded-full blur-2xl opacity-50 animate-pulse"></div>
                <Star className="w-32 h-32 text-yellow-600 fill-current relative animate-bounce" />
              </div>
            </div>
            <h2 className="text-5xl font-bold text-yellow-900 mb-2">{todayStars} ⭐</h2>
            <p className="text-xl text-yellow-800 mb-6">Stars Earned Today</p>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="bg-white rounded-full h-4 overflow-hidden border-2 border-yellow-600">
                <div
                  className="bg-gradient-to-r from-yellow-400 to-orange-400 h-full transition-all duration-500"
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                ></div>
              </div>
              <p className="text-sm text-yellow-800 mt-2">
                {todayStars} of {dailyLimit} stars (Today's Goal)
              </p>
            </div>

            {todayStars >= dailyLimit && (
              <div className="bg-green-100 border-2 border-green-400 rounded-2xl p-4 text-green-800 font-bold">
                🎊 Amazing! You've reached today's goal!
              </div>
            )}
          </div>
        </div>

        {/* Money Balance Card */}
        <div className="bg-gradient-to-br from-green-100 to-cyan-100 rounded-3xl p-6 shadow-xl mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-green-700">${balance.availableBalance}</div>
              <div className="text-sm text-green-600">Available</div>
            </div>
            <div className="border-l-2 border-r-2 border-green-300">
              <div className="text-3xl font-bold text-green-700">${balance.savingsBalance}</div>
              <div className="text-sm text-green-600">Savings</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-700">${balance.totalEarned}</div>
              <div className="text-sm text-green-600">Total Earned</div>
            </div>
          </div>
          <p className="text-xs text-gray-600 text-center mt-4">
            Every {starToDollarRate} ⭐ = $1 💰
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setTab('home')}
            className={`flex-shrink-0 px-6 py-3 rounded-full font-bold transition-all ${
              tab === 'home'
                ? 'bg-gradient-to-r from-star-500 to-star-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border-2 border-gray-300'
            }`}
          >
            <Home className="w-5 h-5 inline mr-2" /> Home
          </button>
          <button
            onClick={() => setTab('history')}
            className={`flex-shrink-0 px-6 py-3 rounded-full font-bold transition-all ${
              tab === 'history'
                ? 'bg-gradient-to-r from-star-500 to-star-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border-2 border-gray-300'
            }`}
          >
            <TrendingUp className="w-5 h-5 inline mr-2" /> History
          </button>
          <button
            onClick={() => setTab('goals')}
            className={`flex-shrink-0 px-6 py-3 rounded-full font-bold transition-all ${
              tab === 'goals'
                ? 'bg-gradient-to-r from-star-500 to-star-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border-2 border-gray-300'
            }`}
          >
            <Zap className="w-5 h-5 inline mr-2" /> Goals
          </button>
          <button
            onClick={() => setTab('badges')}
            className={`flex-shrink-0 px-6 py-3 rounded-full font-bold transition-all ${
              tab === 'badges'
                ? 'bg-gradient-to-r from-star-500 to-star-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border-2 border-gray-300'
            }`}
          >
            <Award className="w-5 h-5 inline mr-2" /> Badges
          </button>
        </div>

        {/* Tab Content */}
        {tab === 'home' && (
          <HomeTab
            totalStars={totalStars}
            completedToday={completedToday}
            pendingToday={pendingToday}
            allCompletedTaskNames={allCompletedTaskNames}
          />
        )}
        {tab === 'history' && <HistoryTab records={dailyRecords.filter((record) => record.kidId === activeKidId)} />}
        {tab === 'goals' && <GoalsTab goals={savingsGoals} />}
        {tab === 'badges' && <BadgesTab unlocked={badges} all={allBadges} />}

        {/* Logout Button */}
        <div className="mt-8 text-center">
          <button
            onClick={onLogout}
            className="px-8 py-3 bg-gray-400 hover:bg-gray-500 text-white rounded-full font-bold transition-all inline-flex items-center gap-2"
          >
            <LogOut className="w-5 h-5" /> Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

function HomeTab({
  totalStars,
  completedToday,
  pendingToday,
  allCompletedTaskNames,
}: {
  totalStars: number;
  completedToday: Task[];
  pendingToday: Task[];
  allCompletedTaskNames: string[];
}) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-100 rounded-2xl p-6">
        <div className="text-center">
          <div className="text-6xl mb-4">⭐</div>
          <h3 className="text-2xl font-bold text-blue-900 mb-2">Lifetime Stars</h3>
          <p className="text-4xl font-bold text-blue-700">{totalStars}</p>
        </div>
      </div>

      <div className="bg-purple-100 rounded-2xl p-6">
        <h3 className="text-xl font-bold text-purple-900 mb-4">Fun Facts!</h3>
        <div className="space-y-2 text-purple-800">
          <p>✨ You're a Little Starts Bank superstar!</p>
          <p>💪 Keep up the great work!</p>
          <p>🎯 Every⭐ gets you closer to your goals!</p>
        </div>
      </div>

      <div className="bg-yellow-50 rounded-2xl p-6 border-2 border-yellow-200">
        <h3 className="text-xl font-bold text-yellow-900 mb-4">Today's Task Board</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 border border-yellow-200">
            <p className="font-bold text-green-700 mb-2">Completed / Starred</p>
            {completedToday.length === 0 ? (
              <p className="text-sm text-gray-600">No stars yet today. You can do this! 💪</p>
            ) : (
              <div className="space-y-2">
                {completedToday.map((task) => (
                  <div key={task.id} className="flex justify-between items-center bg-green-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-800">{task.name}</span>
                    <span className="text-sm font-bold text-green-700">{task.stars} ⭐</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-4 border border-yellow-200">
            <p className="font-bold text-orange-700 mb-2">Pending Tasks</p>
            {pendingToday.length === 0 ? (
              <p className="text-sm text-gray-600">All done for today! Great job! 🎉</p>
            ) : (
              <div className="space-y-2">
                {pendingToday.map((task) => (
                  <div key={task.id} className="flex justify-between items-center bg-orange-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-800">{task.name}</span>
                    <span className="text-sm font-bold text-orange-700">{task.stars} ⭐</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border-2 border-blue-100">
        <h3 className="text-xl font-bold text-blue-900 mb-3">Tasks You've Completed</h3>
        {allCompletedTaskNames.length === 0 ? (
          <p className="text-sm text-gray-600">Complete tasks to build your achievement list.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allCompletedTaskNames.map((taskName) => (
              <span key={taskName} className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-bold">
                {taskName}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoryTab({ records }: { records: DailyRecord[] }) {
  const last7 = records.slice(-7).reverse();

  return (
    <div className="space-y-3">
      {last7.map((record) => (
        <div key={record.date} className="bg-white rounded-2xl p-4 shadow-md">
          <div className="flex justify-between items-center">
            <span className="font-bold text-gray-800">{new Date(record.date + 'T00:00').toLocaleDateString()}</span>
            <span className="text-2xl font-bold text-yellow-600">{record.totalStarsEarned} ⭐</span>
          </div>
        </div>
      ))}
      {last7.length === 0 && (
        <p className="text-center text-gray-600 py-8">No history yet. Start earning stars! 🌟</p>
      )}
    </div>
  );
}

function GoalsTab({ goals }: { goals: SavingsGoal[] }) {
  return (
    <div className="space-y-4">
      {goals.map((goal) => (
        <div key={goal.id} className="bg-white rounded-2xl p-6 shadow-md">
          <div className="flex justify-between items-start mb-3">
            <h4 className="font-bold text-lg text-gray-800">{goal.name}</h4>
            <span className="text-3xl">{goal.image || '🎯'}</span>
          </div>
          <div className="mb-3">
            <div className="bg-gray-200 rounded-full h-4 overflow-hidden">
              <div
                className="bg-gradient-to-r from-green-400 to-blue-500 h-full transition-all duration-500"
                style={{ width: `${(goal.currentAmount / goal.targetAmount) * 100}%` }}
              ></div>
            </div>
          </div>
          <p className="text-center text-sm text-gray-600">
            ${goal.currentAmount} of ${goal.targetAmount}
          </p>
        </div>
      ))}
      {goals.length === 0 && (
        <p className="text-center text-gray-600 py-8">No goals yet. Ask a parent to create one! 🎯</p>
      )}
    </div>
  );
}

function BadgesTab({
  unlocked,
  all,
}: {
  unlocked: Badge[];
  all: { name: string; icon: string; description: string }[];
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {all.map((badge, i) => {
        const isUnlocked = unlocked.some((b) => b.name === badge.name);
        return (
          <div
            key={i}
            className={`rounded-2xl p-6 text-center transition-transform ${
              isUnlocked
                ? 'bg-gradient-to-br from-yellow-200 to-orange-200 transform scale-105 shadow-lg'
                : 'bg-gray-200 opacity-50'
            }`}
          >
            <div className="text-5xl mb-2">{badge.icon}</div>
            <h4 className="font-bold text-sm text-gray-800">{badge.name}</h4>
            <p className="text-xs text-gray-600 mt-1">{badge.description}</p>
            {!isUnlocked && <p className="text-xs text-gray-500 mt-2">🔒 Locked</p>}
          </div>
        );
      })}
    </div>
  );
}

