import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#0f172a', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

function formatTick(iso) {
  if (!iso || iso.length < 10) return iso;
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

export function ReachVsConversionChart({ reachedSeries, convertedSeries }) {
  // Merge by date
  const map = {};
  reachedSeries.forEach((d) => { map[d.date] = { date: d.date, reached: d.count, converted: 0 }; });
  convertedSeries.forEach((d) => {
    map[d.date] = map[d.date] || { date: d.date, reached: 0, converted: 0 };
    map[d.date].converted = d.count;
  });
  const data = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="date" tickFormatter={formatTick} fontSize={11} stroke="#64748b" />
          <YAxis fontSize={11} stroke="#64748b" allowDecimals={false} />
          <Tooltip labelFormatter={formatTick} />
          <Legend />
          <Line type="monotone" dataKey="reached" stroke="#3b82f6" name="Reached" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="converted" stroke="#10b981" name="Converted" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryBarChart({ data, label, color = '#0f172a' }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" fontSize={11} stroke="#64748b" allowDecimals={false} />
          <YAxis type="category" dataKey="name" fontSize={11} stroke="#64748b" width={100} />
          <Tooltip />
          <Bar dataKey="value" name={label} fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TenureBucketChart({ data }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" fontSize={11} stroke="#64748b" />
          <YAxis fontSize={11} stroke="#64748b" allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" name="Employees" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusPieChart({ data }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={80} label>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}