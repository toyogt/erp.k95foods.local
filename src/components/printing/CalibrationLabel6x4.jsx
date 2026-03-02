/**
 * 6×4 inch calibration/test label — grid with corner marks and rulers.
 */
export default function CalibrationLabel6x4() {
  return (
    <div style={{
      width: '6in',
      height: '4in',
      boxSizing: 'border-box',
      fontFamily: 'monospace',
      background: '#fff',
      position: 'relative',
      pageBreakAfter: 'always',
      border: '2px solid #000',
    }}>
      {/* Corner marks */}
      {[
        { top: 4, left: 4 },
        { top: 4, right: 4 },
        { bottom: 4, left: 4 },
        { bottom: 4, right: 4 },
      ].map((pos, i) => (
        <div key={i} style={{
          position: 'absolute', ...pos,
          width: 20, height: 20,
          borderTop: Object.hasOwn(pos, 'top') ? '3px solid #000' : 'none',
          borderBottom: Object.hasOwn(pos, 'bottom') ? '3px solid #000' : 'none',
          borderLeft: Object.hasOwn(pos, 'left') ? '3px solid #000' : 'none',
          borderRight: Object.hasOwn(pos, 'right') ? '3px solid #000' : 'none',
        }} />
      ))}

      {/* Grid lines every 0.5in — 6×4 => 12 cols × 8 rows */}
      {Array.from({ length: 11 }, (_, i) => (
        <div key={`v${i}`} style={{
          position: 'absolute',
          top: 0, bottom: 0,
          left: `${((i + 1) / 12) * 100}%`,
          borderLeft: i % 2 === 1 ? '1px solid #bbb' : '1px dashed #ddd',
        }} />
      ))}
      {Array.from({ length: 7 }, (_, i) => (
        <div key={`h${i}`} style={{
          position: 'absolute',
          left: 0, right: 0,
          top: `${((i + 1) / 8) * 100}%`,
          borderTop: i % 2 === 1 ? '1px solid #bbb' : '1px dashed #ddd',
        }} />
      ))}

      {/* Ruler labels — horizontal */}
      {Array.from({ length: 6 }, (_, i) => (
        <span key={`rl${i}`} style={{
          position: 'absolute',
          top: 6,
          left: `calc(${((i + 1) / 12) * 100}% - 6px)`,
          fontSize: '6pt', color: '#666',
        }}>{(i + 1) * 0.5}"</span>
      ))}
      {/* Ruler labels — vertical */}
      {Array.from({ length: 4 }, (_, i) => (
        <span key={`rv${i}`} style={{
          position: 'absolute',
          left: 6,
          top: `calc(${((i + 1) / 8) * 100}% - 8px)`,
          fontSize: '6pt', color: '#666',
        }}>{(i + 1) * 0.5}"</span>
      ))}

      {/* Centre crosshair */}
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, borderTop: '1px solid #f00', transform: 'translateY(-0.5px)' }} />
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, borderLeft: '1px solid #f00', transform: 'translateX(-0.5px)' }} />

      {/* Label */}
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', background: '#fff', padding: '4px 8px', border: '1px solid #999' }}>
        <p style={{ fontSize: '11pt', fontWeight: 'bold', margin: 0 }}>CALIBRATION</p>
        <p style={{ fontSize: '8pt', color: '#555', margin: 0 }}>6 × 4 inch — {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
}