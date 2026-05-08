import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent
} from "react";

interface PanelOffset {
  x: number;
  y: number;
}

interface DragState {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffset: PanelOffset;
  panelRect: DOMRect;
  parentRect: DOMRect;
}

const PANEL_MARGIN = 8;
const DRAG_BLOCK_SELECTOR = "button, input, textarea, select, option, a, [role='button']";

export function useFloatingPanelDrag<TElement extends HTMLElement>() {
  const panelRef = useRef<TElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [offset, setOffset] = useState<PanelOffset>({ x: 0, y: 0 });

  const panelStyle = useMemo<CSSProperties>(
    () => ({
      transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`
    }),
    [offset.x, offset.y]
  );

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target;

    if (target instanceof Element && target.closest(DRAG_BLOCK_SELECTOR) !== null) {
      return;
    }

    const panelElement = panelRef.current;
    const parentElement = panelElement?.parentElement;

    if (panelElement === null || parentElement === undefined || parentElement === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffset: offset,
      panelRect: panelElement.getBoundingClientRect(),
      parentRect: parentElement.getBoundingClientRect()
    };
  }, [offset]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current;

    if (dragState === null || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const deltaX = event.clientX - dragState.startClientX;
    const deltaY = event.clientY - dragState.startClientY;
    const clampedDeltaX = clamp(
      deltaX,
      dragState.parentRect.left + PANEL_MARGIN - dragState.panelRect.left,
      dragState.parentRect.right - PANEL_MARGIN - dragState.panelRect.right
    );
    const clampedDeltaY = clamp(
      deltaY,
      dragState.parentRect.top + PANEL_MARGIN - dragState.panelRect.top,
      dragState.parentRect.bottom - PANEL_MARGIN - dragState.panelRect.bottom
    );

    setOffset({
      x: dragState.startOffset.x + clampedDeltaX,
      y: dragState.startOffset.y + clampedDeltaY
    });
  }, []);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current;

    if (dragState === null || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

  return {
    panelRef,
    panelStyle,
    dragHandleProps: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerUp
    }
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
