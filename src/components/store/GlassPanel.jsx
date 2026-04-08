import { motion } from 'framer-motion';

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: 'easeOut' },
};

export default function GlassPanel({ children, className = '', glow = false, animate = true }) {
  const base = `bg-white/60 backdrop-blur-xl border border-white/40 shadow-[0_4px_24px_rgba(0,0,0,0.06)] ${glow ? 'shadow-primary/10' : ''}`;
  const rounded = 'rounded-[28px]';
  const cls = `${base} ${rounded} ${className}`;

  if (!animate) return <div className={cls}>{children}</div>;

  return (
    <motion.div className={cls} {...fadeIn}>
      {children}
    </motion.div>
  );
}

export function GlassCard({ children, className = '', onClick }) {
  return (
    <motion.div
      className={`bg-white/50 backdrop-blur-lg border border-white/30 rounded-[20px] shadow-sm hover:shadow-md transition-shadow ${className}`}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );
}

export function GlassButton({ children, className = '', variant = 'primary', ...props }) {
  const variants = {
    primary: 'bg-slate-900/90 backdrop-blur-sm text-white hover:bg-slate-800/90 shadow-lg shadow-slate-900/20',
    secondary: 'bg-white/70 backdrop-blur-sm text-slate-700 border border-white/40 hover:bg-white/90 shadow-sm',
    success: 'bg-green-600/90 backdrop-blur-sm text-white hover:bg-green-500/90 shadow-lg shadow-green-600/20',
    danger: 'bg-red-600/90 backdrop-blur-sm text-white hover:bg-red-500/90 shadow-lg shadow-red-600/20',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className={`inline-flex items-center justify-center gap-2 rounded-[18px] px-5 py-3 text-sm font-semibold transition-all ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function GlassInput({ className = '', ...props }) {
  return (
    <input
      className={`w-full h-11 rounded-[18px] border border-white/40 bg-white/50 backdrop-blur-sm px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all ${className}`}
      {...props}
    />
  );
}

export function GlassSelect({ className = '', children, ...props }) {
  return (
    <select
      className={`w-full h-11 rounded-[18px] border border-white/40 bg-white/50 backdrop-blur-sm px-4 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all appearance-none ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

export function GlassStatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500 font-medium">{label}</p>
          <p className="text-xl font-bold text-slate-900">{value ?? '—'}</p>
          {sub && <p className="text-xs text-slate-400">{sub}</p>}
        </div>
      </div>
    </GlassCard>
  );
}