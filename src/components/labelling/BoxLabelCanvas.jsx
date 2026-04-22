import { useRef, useState, useEffect } from 'react';
import { unitToPx, pxToUnit, resolveElementValue } from '@/lib/boxLabelHelpers';
import { Image as ImageIcon, Barcode } from 'lucide-react';

/**
 * Drag-and-drop canvas for editing box label templates.
 * Pure positional editing — stateless about element creation/deletion.
 */
export default function BoxLabelCanvas({
  template,
  elements,
  selectedId,
  onSelect,
  onUpdateElement,
  previewData = null,          // when provided, renders resolved values (preview mode)
  readOnly = false,
  scale = 3,                   // px per mm (adjust for readability)
}) {
  const canvasRef = useRef(null);
  const [drag, setDrag] = useState(null);   // { id, offsetX, offsetY }
  const [resize, setResize] = useState(null); // { id, startX, startY, startW, startH }

  const unit = template.page_unit || 'mm';
  const pageW = unitToPx(template.page_width, unit) * (scale / (unit === 'mm' ? 3.7795275591 : 96));
  const pageH = unitToPx(template.page_height, unit) * (scale / (unit === 'mm' ? 3.7795275591 : 96));

  // Convert element coords (unit) → canvas px
  const toPx = (v) => v * scale * (unit === 'mm' ? 1 : 25.4);
  const fromPx = (v) => v / (scale * (unit === 'mm' ? 1 : 25.4));

  const onMouseDownElement = (e, el) => {
    if (readOnly) return;
    e.stopPropagation();
    onSelect(el.id);
    const rect = canvasRef.current.getBoundingClientRect();
    setDrag({
      id: el.id,
      offsetX: e.clientX - rect.left - toPx(el.x),
      offsetY: e.clientY - rect.top - toPx(el.y),
    });
  };

  const onMouseDownResize = (e, el) => {
    if (readOnly) return;
    e.stopPropagation();
    setResize({ id: el.id, startX: e.clientX, startY: e.clientY, startW: el.width, startH: el.height });
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      if (drag) {
        const x = fromPx(e.clientX - rect.left - drag.offsetX);
        const y = fromPx(e.clientY - rect.top - drag.offsetY);
        onUpdateElement(drag.id, {
          x: Math.max(0, Math.min(template.page_width, x)),
          y: Math.max(0, Math.min(template.page_height, y)),
        });
      } else if (resize) {
        const dx = fromPx(e.clientX - resize.startX);
        const dy = fromPx(e.clientY - resize.startY);
        onUpdateElement(resize.id, {
          width: Math.max(2, resize.startW + dx),
          height: Math.max(2, resize.startH + dy),
        });
      }
    };
    const onUp = () => { setDrag(null); setResize(null); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, resize, template.page_width, template.page_height, onUpdateElement]);

  const renderContent = (el) => {
    const text = previewData ? resolveElementValue(el, previewData) : (el.data_field ? `{${el.data_field}}` : (el.text_content || ''));

    if (el.type === 'text') {
      return (
        <div
          style={{
            fontSize: toPx(el.height * 0.5),
            fontWeight: el.font_weight || 'normal',
            textAlign: el.text_align || 'left',
            color: el.color || '#000',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            lineHeight: 1.1,
            padding: '1px',
          }}
        >
          {text || <span className="text-slate-300">Text</span>}
        </div>
      );
    }
    if (el.type === 'image') {
      return el.image_url ? (
        <img src={el.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-400 border border-dashed border-slate-300">
          <ImageIcon className="w-5 h-5" />
        </div>
      );
    }
    if (el.type === 'barcode') {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-white border border-slate-300" style={{ color: el.color || '#000' }}>
          <Barcode className="w-full h-2/3" strokeWidth={1} />
          <div className="text-[8px] truncate w-full text-center">{text || el.data_field || 'barcode'}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="inline-block bg-slate-100 p-4 rounded-lg">
      <div
        ref={canvasRef}
        onClick={() => !readOnly && onSelect(null)}
        className="relative bg-white shadow-md border border-slate-300"
        style={{ width: pageW, height: pageH }}
      >
        {elements.map(el => {
          const selected = selectedId === el.id;
          return (
            <div
              key={el.id}
              onMouseDown={(e) => onMouseDownElement(e, el)}
              className={`absolute ${readOnly ? '' : 'cursor-move'} ${selected ? 'ring-2 ring-blue-500' : 'hover:ring-1 hover:ring-slate-300'}`}
              style={{
                left: toPx(el.x),
                top: toPx(el.y),
                width: toPx(el.width),
                height: toPx(el.height),
                transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
              }}
            >
              {renderContent(el)}
              {selected && !readOnly && (
                <div
                  onMouseDown={(e) => onMouseDownResize(e, el)}
                  className="absolute -right-1.5 -bottom-1.5 w-3 h-3 bg-blue-500 border border-white rounded-sm cursor-se-resize"
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-xs text-slate-500 text-center">
        {template.page_width} × {template.page_height} {unit}
      </div>
    </div>
  );
}