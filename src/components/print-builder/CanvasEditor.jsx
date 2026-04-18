/**
 * CanvasEditor
 * Renders the label canvas scaled to screen. Elements are positioned as % of page.
 * Drag to move. Click to select.
 */
import { useRef, useState, useCallback } from 'react';
import { Trash2 } from 'lucide-react';

const SAMPLE_VALUES = {
  batch_no:             '01PC46130',
  mfg_date:            '18/04/2026',
  expiry_date:         '17/04/2027',
  shelf_life:          '12 months',
  labelling_date:      '18/04/2026',
  mrp:                 '95.00',
  mrp_with_usp:        '₹95.00 (USP: ₹0.32/ml)',
  usp:                 '0.32',
  usp_with_unit:       '₹0.32/ml',
  tax_line:            'Incl. of all taxes',
  product_name:        'Toyo Kombucha Exotic Peach 330ml',
  brand_name:          'Toyo',
  flavour:             'Exotic Peach',
  bottle_type:         'Glass Bottle 330ml',
  sku_code:            'TK-EXPE-LS-GLS-330',
  net_weight:          '330 ml',
  ml_per_bottle:       '330',
  bottles_per_box:     '12',
  fssai_no:            '10012345000123',
  hsn_code:            '2202',
  manufacturer_name:   'Toyo Beverages Pvt. Ltd.',
  manufacturer_address:'Plot 12, Industrial Area, Pune 411001',
  customer_care_phone: '+91 98765 43210',
  customer_care_email: 'care@toyo.in',
  product_barcode:     '8901234567890',
  box_barcode:         '8901234567890',
  batch_no_qr:         '01PC46130',
  __static__:          'Static Text',
};

// Pixels per mm for canvas display (96 dpi ≈ 3.78 px/mm)
const PX_PER_MM = 3.0;

export default function CanvasEditor({
  pageSize, elements, selectedId, onSelect, onChange, onRemove, showPreview,
}) {
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(null); // { id, startMouseX, startMouseY, startX, startY }
  const [resizing, setResizing] = useState(null);

  const canvasW = pageSize.width * PX_PER_MM;
  const canvasH = pageSize.height * PX_PER_MM;

  const pctToCanvas = (pct, dim) => (pct / 100) * dim;
  const canvasToPct = (px, dim) => (px / dim) * 100;

  const handleMouseDown = useCallback((e, el, isResize) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(el._id);
    const rect = canvasRef.current.getBoundingClientRect();

    if (isResize) {
      setResizing({ id: el._id, startMouseX: e.clientX, startMouseY: e.clientY, startW: el.w, startH: el.h });
    } else {
      setDragging({ id: el._id, startMouseX: e.clientX, startMouseY: e.clientY, startX: el.x, startY: el.y });
    }
  }, [onSelect]);

  const handleMouseMove = useCallback((e) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    if (dragging) {
      const dx = canvasToPct(e.clientX - dragging.startMouseX, rect.width);
      const dy = canvasToPct(e.clientY - dragging.startMouseY, rect.height);
      const newX = Math.max(0, Math.min(95, dragging.startX + dx));
      const newY = Math.max(0, Math.min(95, dragging.startY + dy));
      onChange(dragging.id, { x: parseFloat(newX.toFixed(1)), y: parseFloat(newY.toFixed(1)) });
    }

    if (resizing) {
      const dx = canvasToPct(e.clientX - resizing.startMouseX, rect.width);
      const dy = canvasToPct(e.clientY - resizing.startMouseY, rect.height);
      const newW = Math.max(5, Math.min(100, resizing.startW + dx));
      const newH = Math.max(3, Math.min(80, resizing.startH + dy));
      onChange(resizing.id, { w: parseFloat(newW.toFixed(1)), h: parseFloat(newH.toFixed(1)) });
    }
  }, [dragging, resizing, onChange]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setResizing(null);
  }, []);

  const renderElement = (el) => {
    const isSelected = el._id === selectedId;
    const style = {
      position: 'absolute',
      left: `${el.x}%`,
      top: `${el.y}%`,
      width: `${el.w}%`,
      height: `${el.h}%`,
      border: isSelected ? '1.5px solid #7c3aed' : '1px dashed #cbd5e1',
      borderRadius: 2,
      boxSizing: 'border-box',
      cursor: showPreview ? 'default' : 'move',
      userSelect: 'none',
      overflow: 'hidden',
      background: isSelected ? 'rgba(124,58,237,0.04)' : 'transparent',
    };

    const textStyle = {
      fontSize: el.fontSize || 10,
      fontWeight: el.fontWeight || 'normal',
      color: el.color || '#000',
      textAlign: el.align || 'left',
      lineHeight: 1.2,
      padding: '1px 3px',
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
    };

    let content = null;
    const sampleVal = SAMPLE_VALUES[el.field] || el.staticText || el.label || el.field;

    if (el.type === 'divider') {
      content = (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '100%', height: el.lineHeight || 1, background: el.color || '#000' }} />
        </div>
      );
    } else if (el.type === 'box') {
      content = (
        <div style={{
          width: '100%', height: '100%',
          border: `${el.borderWidth || 1}px solid ${el.color || '#000'}`,
          borderRadius: el.borderRadius || 0,
          boxSizing: 'border-box',
        }} />
      );
    } else if (el.type === 'barcode') {
      content = (
        <div style={{ ...textStyle, flexDirection: 'column', justifyContent: 'center', gap: 1, background: '#fff' }}>
          <div style={{ width: '80%', height: '60%', background: 'repeating-linear-gradient(90deg, #000 0px, #000 2px, #fff 2px, #fff 4px)' }} />
          <span style={{ fontSize: 6, letterSpacing: 1 }}>{showPreview ? sampleVal : '▐▌▐▌▐▌ Barcode'}</span>
        </div>
      );
    } else if (el.type === 'qr') {
      content = (
        <div style={{ ...textStyle, justifyContent: 'center' }}>
          <div style={{ width: 'min(100%, 100%)', height: '100%', background: 'repeating-linear-gradient(0deg, #000 0px, #000 3px, #fff 3px, #fff 6px)', opacity: 0.8 }} />
        </div>
      );
    } else {
      // text / static
      content = (
        <div style={textStyle}>
          {showPreview ? sampleVal : (
            <>
              <span style={{ color: '#9333ea', fontWeight: 600, fontSize: (el.fontSize || 10) * 0.75, marginRight: 3, flexShrink: 0 }}>{el.label?.split(' ').map(w=>w[0]).join('').slice(0,4) || '?'}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{el.label || el.field}</span>
            </>
          )}
        </div>
      );
    }

    return (
      <div
        key={el._id}
        style={style}
        onMouseDown={showPreview ? undefined : (e) => handleMouseDown(e, el, false)}
        onClick={(e) => { e.stopPropagation(); onSelect(el._id); }}
      >
        {content}

        {/* Resize handle */}
        {isSelected && !showPreview && (
          <div
            style={{
              position: 'absolute', right: -4, bottom: -4, width: 8, height: 8,
              background: '#7c3aed', borderRadius: 2, cursor: 'se-resize', zIndex: 10,
            }}
            onMouseDown={(e) => handleMouseDown(e, el, true)}
          />
        )}

        {/* Delete button on selection */}
        {isSelected && !showPreview && (
          <button
            style={{
              position: 'absolute', top: -10, right: -10, width: 18, height: 18,
              background: '#ef4444', borderRadius: '50%', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10,
            }}
            onClick={(e) => { e.stopPropagation(); onRemove(el._id); }}
          >
            <Trash2 style={{ width: 9, height: 9, color: '#fff' }} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div
      style={{ position: 'relative', userSelect: 'none' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Shadow wrapper */}
      <div style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.15)', borderRadius: 2 }}>
        {/* Label canvas */}
        <div
          ref={canvasRef}
          style={{
            position: 'relative',
            width: canvasW,
            height: canvasH,
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            overflow: 'hidden',
          }}
          onClick={() => onSelect(null)}
        >
          {/* Grid lines */}
          {!showPreview && (
            <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.15 }}>
              {Array.from({ length: 10 }).map((_, i) => (
                <g key={i}>
                  <line x1={`${(i + 1) * 10}%`} y1="0" x2={`${(i + 1) * 10}%`} y2="100%" stroke="#6366f1" strokeWidth="0.5" />
                  <line x1="0" y1={`${(i + 1) * 10}%`} x2="100%" y2={`${(i + 1) * 10}%`} stroke="#6366f1" strokeWidth="0.5" />
                </g>
              ))}
            </svg>
          )}

          {elements.map(renderElement)}

          {/* Empty state hint */}
          {elements.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6, color: '#94a3b8', pointerEvents: 'none' }}>
              <span style={{ fontSize: 12 }}>← Click a field from the left panel to add it</span>
              <span style={{ fontSize: 11 }}>Drag elements to position them on this label</span>
            </div>
          )}
        </div>
      </div>

      {/* Canvas size label */}
      <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#94a3b8' }}>
        {pageSize.width} × {pageSize.height} {pageSize.unit}
        {showPreview && <span style={{ marginLeft: 8, color: '#7c3aed', fontWeight: 600 }}>PREVIEW MODE</span>}
      </div>
    </div>
  );
}