import { useState } from 'react';
import { Plus, Trash2, Check, X, AlertCircle } from 'lucide-react';
import { useStarBankStore } from '../store/starBankStore';
import { Task } from '../types';

const normalizeTaskType = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

export default function ParentMode() {
  const [tab, setTab] = useState<'tasks' | 'rewards' | 'reports'>('tasks');
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskStars, setNewTaskStars] = useState(1);
  const [subtractStars, setSubtractStars] = useState('');
  const [subtractReason, setSubtractReason] = useState('');
  const [starFeedback, setStarFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const getTodayRecord = useStarBankStore((state) => state.getTodayRecord);
  const addTask = useStarBankStore((state) => state.addTask);
  const completeTask = useStarBankStore((state) => state.completeTask);
  const deleteTask = useStarBankStore((state) => state.deleteTask);
  const subtractStarsAction = useStarBankStore((state) => state.subtractStars);
  const getTodayStars = useStarBankStore((state) => state.getTodayStars);
  const getTotalStars = useStarBankStore((state) => state.getTotalStars);
  const dailyLimit = useStarBankStore((state) => state.settings.dailyStarLimit);
  const kids = useStarBankStore((state) => state.settings.kids);
  const activeKidId = useStarBankStore((state) => state.settings.activeKidId);
  const setActiveKid = useStarBankStore((state) => state.setActiveKid);
  const withdrawalRequests = useStarBankStore((state) => state.withdrawalRequests);
  const approveWithdrawal = useStarBankStore((state) => state.approveWithdrawal);
  const rejectWithdrawal = useStarBankStore((state) => state.rejectWithdrawal);

  const record = getTodayRecord();
  const todayStars = getTodayStars();
  const totalStars = getTotalStars();
  const pendingRequests = withdrawalRequests.filter((r) => r.status === 'pending');
  const activeKid = kids.find((kid) => kid.id === activeKidId);

  const handleAddTask = () => {
    if (newTaskName.trim() && newTaskStars > 0) {
      addTask(newTaskName, newTaskStars);
      setNewTaskName('');
      setNewTaskStars(1);
      setShowAddTask(false);
    }
  };

  const handleSubtractStars = () => {
    if (subtractStars && parseInt(subtractStars) > 0 && subtractReason.trim()) {
      subtractStarsAction(parseInt(subtractStars), subtractReason);
      setSubtractStars('');
      setSubtractReason('');
    }
  };

  const getTaskBlockReason = (task: Task) => {
    if (task.completed) {
      return 'Already completed today';
    }

    const alreadyCompletedThisType = record.tasks.some(
      (other) =>
        other.id !== task.id
        && other.completed
        && (other.taskType || normalizeTaskType(other.name)) === (task.taskType || normalizeTaskType(task.name)),
    );
    if (alreadyCompletedThisType) {
      return 'This task type already got a star today';
    }

    if (todayStars + task.stars > dailyLimit) {
      return 'Would exceed daily star limit';
    }

    return null;
  };

  const handleCompleteTask = (task: Task) => {
    const result = completeTask(task.id);
    setStarFeedback({
      type: result.success ? 'success' : 'error',
      message: result.message,
    });
  };

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Summary Cards */}
        <div className="bg-white rounded-lg p-4 shadow-md mb-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <p className="font-bold text-gray-700">Managing dashboard for:</p>
          <select
            value={activeKidId}
            onChange={(e) => {
              setActiveKid(e.target.value);
              setStarFeedback(null);
            }}
            className="border border-gray-300 rounded-lg px-3 py-2 font-bold text-gray-800 bg-white"
          >
            {kids.map((kid) => (
              <option key={kid.id} value={kid.id}>{kid.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-md">
            <p className="text-gray-600 text-sm mb-1">Today's Stars</p>
            <p className="text-3xl font-bold text-star-600">{todayStars}/{dailyLimit}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-md">
            <p className="text-gray-600 text-sm mb-1">Total Stars</p>
            <p className="text-3xl font-bold text-blue-600">{totalStars}</p>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-md">
            <p className="text-gray-600 text-sm mb-1">Pending Requests</p>
            <p className="text-3xl font-bold text-orange-600">{pendingRequests.length}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b-2 border-gray-300 overflow-x-auto">
          <button
            onClick={() => setTab('tasks')}
            className={`px-4 py-3 font-bold transition-colors ${
              tab === 'tasks'
                ? 'border-b-4 border-star-600 text-star-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Today's Tasks
          </button>
          <button
            onClick={() => setTab('rewards')}
            className={`px-4 py-3 font-bold transition-colors ${
              tab === 'rewards'
                ? 'border-b-4 border-star-600 text-star-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Withdrawal Requests
          </button>
          <button
            onClick={() => setTab('reports')}
            className={`px-4 py-3 font-bold transition-colors ${
              tab === 'reports'
                ? 'border-b-4 border-star-600 text-star-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Reports
          </button>
        </div>

        {/* Task Management Tab */}
        {tab === 'tasks' && (
          <div className="space-y-6">
            {starFeedback && (
              <div
                className={`rounded-lg border-l-4 p-4 ${
                  starFeedback.type === 'success'
                    ? 'bg-green-100 border-green-500 text-green-800'
                    : 'bg-red-100 border-red-500 text-red-800'
                }`}
              >
                <p className="font-bold">{starFeedback.message}</p>
              </div>
            )}

            {/* Add Task Section */}
            <div className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
              <button
                onClick={() => setShowAddTask(!showAddTask)}
                className="flex items-center gap-2 text-blue-700 font-bold hover:underline"
              >
                <Plus className="w-5 h-5" /> Add New Task
              </button>

              {showAddTask && (
                <div className="mt-4 p-4 bg-white border-2 border-blue-300 rounded-lg">
                  <input
                    type="text"
                    placeholder="Task name"
                    value={newTaskName}
                    onChange={(e) => setNewTaskName(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg mb-3"
                  />
                  <div className="flex gap-2 items-end mb-3">
                    <div className="flex-1">
                      <label className="block text-sm font-bold text-gray-700 mb-1">Stars</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={newTaskStars}
                        onChange={(e) => setNewTaskStars(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full p-2 border border-gray-300 rounded-lg"
                      />
                    </div>
                    <button
                      onClick={handleAddTask}
                      disabled={!newTaskName.trim()}
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 disabled:opacity-50"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setShowAddTask(false)}
                      className="px-6 py-2 bg-gray-400 text-white rounded-lg font-bold hover:bg-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tasks List */}
            <div className="space-y-3">
              <h3 className="font-bold text-lg text-gray-800">Today's Tasks {activeKid ? `- ${activeKid.name}` : ''}</h3>
              {record.tasks.length === 0 ? (
                <p className="text-gray-500 py-4">No tasks for today. Add a task to get started!</p>
              ) : (
                record.tasks.map((task) => {
                  const blockReason = getTaskBlockReason(task);
                  return (
                  <div
                    key={task.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      task.completed
                        ? 'bg-green-50 border-green-300 opacity-75'
                        : 'bg-white border-gray-200 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className={`font-bold ${task.completed ? 'line-through text-gray-500' : 'text-gray-800'}`}>
                          {task.name}
                        </p>
                        <p className="text-sm text-gray-600">{task.stars} ⭐</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCompleteTask(task)}
                          disabled={Boolean(blockReason)}
                          className={`p-2 rounded-lg transition-all ${
                            task.completed
                              ? 'bg-green-300 text-white'
                              : 'bg-gray-200 hover:bg-green-300 hover:text-white disabled:opacity-50'
                          }`}
                          title={blockReason || ''}
                        >
                          <Check className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="p-2 rounded-lg bg-gray-200 hover:bg-red-300 hover:text-white transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    {blockReason && !task.completed && (
                      <p className="text-xs text-amber-700 mt-2">{blockReason}</p>
                    )}
                  </div>
                  );
                })
              )}
            </div>

            {/* Subtract Stars Section */}
            <div className="bg-red-50 rounded-lg p-4 border-l-4 border-red-500">
              <h3 className="font-bold text-red-700 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> Subtract Stars
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Number of Stars</label>
                  <input
                    type="number"
                    min="1"
                    max={todayStars}
                    value={subtractStars}
                    onChange={(e) => setSubtractStars(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Reason</label>
                  <input
                    type="text"
                    placeholder="e.g., Didn't listen, threw tantrum"
                    value={subtractReason}
                    onChange={(e) => setSubtractReason(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <button
                  onClick={handleSubtractStars}
                  disabled={!subtractStars || !subtractReason.trim() || parseInt(subtractStars || '0') > todayStars}
                  className="w-full px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 disabled:opacity-50"
                >
                  Subtract Stars
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Withdrawal Requests Tab */}
        {tab === 'rewards' && (
          <div className="space-y-4">
            {pendingRequests.length === 0 ? (
              <p className="text-gray-500 py-8 text-center">No pending withdrawal requests</p>
            ) : (
              pendingRequests.map((request) => (
                <div key={request.id} className="bg-white rounded-lg p-6 shadow-md border-l-4 border-orange-400">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-lg">${request.amount}</p>
                      <p className="text-sm text-gray-600 capitalize">{request.category}</p>
                    </div>
                    <p className="text-sm text-gray-500">{new Date(request.date).toLocaleDateString()}</p>
                  </div>
                  <p className="text-gray-700 mb-3">{request.description}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => approveWithdrawal(request.id)}
                      className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg font-bold hover:bg-green-600 flex items-center justify-center gap-2"
                    >
                      <Check className="w-5 h-5" /> Approve
                    </button>
                    <button
                      onClick={() => rejectWithdrawal(request.id)}
                      className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 flex items-center justify-center gap-2"
                    >
                      <X className="w-5 h-5" /> Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Reports Tab */}
        {tab === 'reports' && <ReportsTab />}
      </div>
    </div>
  );
}

function ReportsTab() {
  const getWeeklyReport = useStarBankStore((state) => state.getWeeklyReport);
  const getMonthlyReport = useStarBankStore((state) => state.getMonthlyReport);

  const weeklyData = getWeeklyReport();
  const monthlyData = getMonthlyReport();

  const weeklyTotal = Object.values(weeklyData).reduce((a, b: any) => a + b, 0) as number;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg p-6 shadow-md">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Weekly Report</h3>
        <p className="text-3xl font-bold text-star-600 mb-4">{weeklyTotal} ⭐ this week</p>

        <div className="space-y-2">
          {Object.entries(weeklyData).map(([date, stars]) => {
            const starCount = Number(stars);
            return (
            <div key={date} className="flex justify-between items-center">
              <span>{new Date(date + 'T00:00').toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <div className="w-32 bg-gray-200 rounded-full h-6 flex items-center px-2">
                <div
                  className="bg-gradient-to-r from-star-400 to-star-500 h-4 rounded-full transition-all"
                  style={{ width: `${Math.min((starCount / 10) * 100, 100)}%` }}
                ></div>
              </div>
              <span className="font-bold">{starCount} ⭐</span>
            </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg p-6 shadow-md">
        <h3 className="text-lg font-bold text-gray-800 mb-4">Monthly Overview</h3>
        <p className="text-sm text-gray-600 mb-4">Total stars earned this month</p>
        <div className="grid grid-cols-7 gap-2">
          {Object.entries(monthlyData).map(([date, stars]) => {
            const starCount = Number(stars);
            return (
            <div
              key={date}
              className="aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-all hover:shadow-md"
              style={{
                backgroundColor: `rgba(235, 107, 74, ${Math.min(starCount / 10, 1)})`,
                color: starCount > 5 ? 'white' : 'gray',
              }}
              title={`${date}: ${starCount} stars`}
            >
              {starCount}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

