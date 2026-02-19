const QUEUE_KEY = 'factory_offline_queue';

export function enqueue(action) {
  const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  q.push({ ...action, id: crypto.randomUUID(), queued_at: new Date().toISOString() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export function pendingCount() {
  return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]').length;
}