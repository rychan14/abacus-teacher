import React, { useEffect, useRef } from 'react';
import {
  buildScene,
  buildAbacusFrame,
  buildRods,
  syncBeadsInstant,
  animateSteps,
  handleResize,
  setupInteraction,
} from '../lib/sceneManager';
import type { RodMeshes, SceneRefs } from '../lib/sceneManager';
import type { AbacusColumn, BeadStep } from '../lib/abacus';

interface AbacusCanvasProps {
  columns: AbacusColumn[];
  steps: BeadStep[];
  onManualChange?: (colIndex: number, heaven: boolean, earth: number) => void;
}

export const AbacusCanvas: React.FC<AbacusCanvasProps> = ({ columns, steps, onManualChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRefs = useRef<SceneRefs | null>(null);
  const rods = useRef<RodMeshes[]>([]);
  const columnsRef = useRef<AbacusColumn[]>(columns);

  // Keep columnsRef in sync for the interaction closure
  useEffect(() => {
    columnsRef.current = columns;
  }, [columns]);

  useEffect(() => {
    if (!containerRef.current) return;
    console.log('AbacusCanvas mounting...');

    // Aggressive cleanup: remove ANY canvas in the document before starting
    // This handles cases where previous renders might have left stray elements
    document.querySelectorAll('canvas').forEach(el => el.remove());
    
    // Ensure container is empty
    containerRef.current.innerHTML = '';

    const refs = buildScene(containerRef.current);
    sceneRefs.current = refs;
    buildAbacusFrame(refs.scene);
    rods.current = buildRods(refs.scene);

    // Initial sync
    syncBeadsInstant(rods.current, columns);

    // Setup interaction
    const cleanupInteraction = setupInteraction(
      containerRef.current,
      refs.camera,
      refs.scene,
      rods.current,
      () => columnsRef.current,
      (idx, h, e) => {
        if (onManualChange) onManualChange(idx, h, e);
      }
    );

    // Force an initial resize check with a small delay for DOM settling
    const timer = setTimeout(() => {
      if (containerRef.current && sceneRefs.current) {
        handleResize(containerRef.current, sceneRefs.current.camera, sceneRefs.current.renderer);
      }
    }, 150);

    const resizeObserver = new ResizeObserver(() => {
      if (!containerRef.current || !sceneRefs.current) return;
      requestAnimationFrame(() => {
        if (!containerRef.current || !sceneRefs.current) return;
        handleResize(containerRef.current, sceneRefs.current.camera, sceneRefs.current.renderer);
      });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      console.log('AbacusCanvas unmounting...');
      clearTimeout(timer);
      resizeObserver.disconnect();
      cleanupInteraction();
      if (sceneRefs.current) {
        cancelAnimationFrame(sceneRefs.current.frameId);
        sceneRefs.current.renderer.dispose();
        sceneRefs.current.renderer.forceContextLoss();
        if (sceneRefs.current.renderer.domElement) {
          sceneRefs.current.renderer.domElement.remove();
        }
      }
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  // Handle updates
  useEffect(() => {
    if (!rods.current.length) return;
    if (steps.length === 0) {
      syncBeadsInstant(rods.current, columns);
    } else {
      animateSteps(rods.current, steps, columns);
    }
  }, [steps, columns]);

  return <div ref={containerRef} className="absolute inset-0 w-full h-full" />;
};
