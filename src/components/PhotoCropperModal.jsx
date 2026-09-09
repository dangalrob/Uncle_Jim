import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Check, X, RotateCcw, Crop } from 'lucide-react';

/**
 * Enhanced Mobile & Desktop Photo Cropper Modal
 * -------------------------------------------------------------
 * - Defaults to 1:1 Square Crop (with Free and Original aspect ratios available)
 * - Natural resize via draggable corner brackets (tl, tr, bl, br) and edges (t, b, l, r)
 * - Touch & drag inside the crop box to reposition the frame
 * - Generous 44px touch targets optimized for iPhone / touch screens
 * - Clean rule-of-thirds grid with dark outer mask
 * - Exports the exact cropped image via HTML5 Canvas (high resolution)
 */
export default function PhotoCropperModal({
  imageSrc,
  onConfirm,
  onCancel,
  initialAspect = '1:1' // '1:1' | 'free' | 'original'
}) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // Aspect ratio state: '1:1' | 'free' | 'original'
  const [aspectMode, setAspectMode] = useState(initialAspect || '1:1');
  const [isProcessing, setIsProcessing] = useState(false);

  // Layout metrics
  const [imgLayout, setImgLayout] = useState({
    naturalWidth: 0,
    naturalHeight: 0,
    renderedWidth: 0,
    renderedHeight: 0,
    offsetX: 0,
    offsetY: 0,
    loaded: false
  });

  // Crop rectangle in rendered image coordinates: { x, y, width, height }
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 0, height: 0 });

  // Drag interaction state
  const dragRef = useRef({
    isDragging: false,
    dragType: null, // 'move' | 'tl' | 'tr' | 'bl' | 'br' | 't' | 'b' | 'l' | 'r'
    startX: 0,
    startY: 0,
    startCrop: { x: 0, y: 0, width: 0, height: 0 }
  });

  // Calculate default crop for given rendered dimensions and aspect ratio
  const computeInitialCrop = useCallback((rWidth, rHeight, natWidth, natHeight, mode) => {
    if (!rWidth || !rHeight) return { x: 0, y: 0, width: 0, height: 0 };

    let targetAspect = 1;
    if (mode === '1:1') {
      targetAspect = 1;
    } else if (mode === 'original' && natWidth && natHeight) {
      targetAspect = natWidth / natHeight;
    } else {
      // Free: default to 88% of bounding box
      const w = Math.round(rWidth * 0.88);
      const h = Math.round(rHeight * 0.88);
      return {
        x: Math.round((rWidth - w) / 2),
        y: Math.round((rHeight - h) / 2),
        width: w,
        height: h
      };
    }

    let w, h;
    if (rWidth / rHeight > targetAspect) {
      h = Math.round(rHeight * 0.88);
      w = Math.round(h * targetAspect);
    } else {
      w = Math.round(rWidth * 0.88);
      h = Math.round(w / targetAspect);
    }

    w = Math.min(w, rWidth);
    h = Math.min(h, rHeight);

    return {
      x: Math.round((rWidth - w) / 2),
      y: Math.round((rHeight - h) / 2),
      width: w,
      height: h
    };
  }, []);

  // Update layout on container resize or image load
  const updateLayout = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth || !img.naturalHeight) return;

    const cWidth = container.clientWidth;
    const cHeight = container.clientHeight;
    const natWidth = img.naturalWidth;
    const natHeight = img.naturalHeight;

    const scale = Math.min(cWidth / natWidth, cHeight / natHeight);
    const rWidth = Math.round(natWidth * scale);
    const rHeight = Math.round(natHeight * scale);
    const offX = Math.round((cWidth - rWidth) / 2);
    const offY = Math.round((cHeight - rHeight) / 2);

    setImgLayout({
      naturalWidth: natWidth,
      naturalHeight: natHeight,
      renderedWidth: rWidth,
      renderedHeight: rHeight,
      offsetX: offX,
      offsetY: offY,
      loaded: true
    });

    setCrop(computeInitialCrop(rWidth, rHeight, natWidth, natHeight, aspectMode));
  }, [aspectMode, computeInitialCrop]);

  useEffect(() => {
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, [updateLayout]);

  const handleImageLoad = () => {
    updateLayout();
  };

  const handleSelectAspect = (mode) => {
    setAspectMode(mode);
    if (imgLayout.loaded) {
      setCrop(computeInitialCrop(imgLayout.renderedWidth, imgLayout.renderedHeight, imgLayout.naturalWidth, imgLayout.naturalHeight, mode));
    }
  };

  const handleReset = () => {
    if (imgLayout.loaded) {
      setCrop(computeInitialCrop(imgLayout.renderedWidth, imgLayout.renderedHeight, imgLayout.naturalWidth, imgLayout.naturalHeight, aspectMode));
    }
  };

  // -------------------------------------------------------------
  // Pointer Drag Handling (Touch + Mouse)
  // -------------------------------------------------------------
  const handlePointerDown = (e, dragType) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      e.target.setPointerCapture(e.pointerId);
    } catch (err) {}

    dragRef.current = {
      isDragging: true,
      dragType,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop }
    };
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current.isDragging || !imgLayout.loaded) return;
    e.preventDefault();

    const { dragType, startX, startY, startCrop } = dragRef.current;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const maxW = imgLayout.renderedWidth;
    const maxH = imgLayout.renderedHeight;
    const MIN_SIZE = 40;

    if (dragType === 'move') {
      const newX = Math.max(0, Math.min(maxW - startCrop.width, startCrop.x + dx));
      const newY = Math.max(0, Math.min(maxH - startCrop.height, startCrop.y + dy));
      setCrop((prev) => ({ ...prev, x: newX, y: newY }));
      return;
    }

    let newX = startCrop.x;
    let newY = startCrop.y;
    let newW = startCrop.width;
    let newH = startCrop.height;

    const isSquare = aspectMode === '1:1';
    const isOriginal = aspectMode === 'original';
    const hasFixedAspect = isSquare || isOriginal;
    const fixedRatio = isSquare ? 1 : (imgLayout.naturalWidth / imgLayout.naturalHeight);

    if (hasFixedAspect) {
      if (dragType === 'br') {
        const delta = Math.max(dx, dy);
        newW = Math.max(MIN_SIZE, Math.min(maxW - startCrop.x, startCrop.width + delta));
        newH = Math.round(newW / fixedRatio);
        if (startCrop.y + newH > maxH) {
          newH = maxH - startCrop.y;
          newW = Math.round(newH * fixedRatio);
        }
      } else if (dragType === 'tr') {
        const delta = Math.max(dx, -dy);
        newW = Math.max(MIN_SIZE, Math.min(maxW - startCrop.x, startCrop.width + delta));
        newH = Math.round(newW / fixedRatio);
        newY = startCrop.y + (startCrop.height - newH);
        if (newY < 0) {
          newY = 0;
          newH = startCrop.y + startCrop.height;
          newW = Math.round(newH * fixedRatio);
        }
      } else if (dragType === 'bl') {
        const delta = Math.max(-dx, dy);
        newW = Math.max(MIN_SIZE, Math.min(startCrop.x + startCrop.width, startCrop.width + delta));
        newH = Math.round(newW / fixedRatio);
        newX = startCrop.x + (startCrop.width - newW);
        if (startCrop.y + newH > maxH) {
          newH = maxH - startCrop.y;
          newW = Math.round(newH * fixedRatio);
          newX = startCrop.x + (startCrop.width - newW);
        }
      } else if (dragType === 'tl') {
        const delta = Math.max(-dx, -dy);
        newW = Math.max(MIN_SIZE, Math.min(startCrop.x + startCrop.width, startCrop.width + delta));
        newH = Math.round(newW / fixedRatio);
        newX = startCrop.x + (startCrop.width - newW);
        newY = startCrop.y + (startCrop.height - newH);
        if (newX < 0) {
          newX = 0;
          newW = startCrop.x + startCrop.width;
          newH = Math.round(newW / fixedRatio);
          newY = startCrop.y + (startCrop.height - newH);
        }
        if (newY < 0) {
          newY = 0;
          newH = startCrop.y + startCrop.height;
          newW = Math.round(newH * fixedRatio);
          newX = startCrop.x + (startCrop.width - newW);
        }
      } else if (dragType === 'r' || dragType === 'b') {
        const delta = (dragType === 'r') ? dx : dy;
        newW = Math.max(MIN_SIZE, Math.min(maxW - startCrop.x, startCrop.width + delta));
        newH = Math.round(newW / fixedRatio);
        if (startCrop.y + newH > maxH) {
          newH = maxH - startCrop.y;
          newW = Math.round(newH * fixedRatio);
        }
      } else if (dragType === 'l' || dragType === 't') {
        const delta = (dragType === 'l') ? -dx : -dy;
        newW = Math.max(MIN_SIZE, Math.min(startCrop.x + startCrop.width, startCrop.width + delta));
        newH = Math.round(newW / fixedRatio);
        newX = startCrop.x + (startCrop.width - newW);
        newY = startCrop.y + (startCrop.height - newH);
        if (newX < 0) {
          newX = 0;
          newW = startCrop.x + startCrop.width;
          newH = Math.round(newW / fixedRatio);
          newY = startCrop.y + (startCrop.height - newH);
        }
        if (newY < 0) {
          newY = 0;
          newH = startCrop.y + startCrop.height;
          newW = Math.round(newH * fixedRatio);
          newX = startCrop.x + (startCrop.width - newW);
        }
      }
    } else {
      if (dragType.includes('r')) {
        newW = Math.max(MIN_SIZE, Math.min(maxW - startCrop.x, startCrop.width + dx));
      }
      if (dragType.includes('b')) {
        newH = Math.max(MIN_SIZE, Math.min(maxH - startCrop.y, startCrop.height + dy));
      }
      if (dragType.includes('l')) {
        const potentialX = startCrop.x + dx;
        if (potentialX >= 0 && startCrop.width - dx >= MIN_SIZE) {
          newX = potentialX;
          newW = startCrop.width - dx;
        } else if (potentialX < 0) {
          newX = 0;
          newW = startCrop.x + startCrop.width;
        }
      }
      if (dragType.includes('t')) {
        const potentialY = startCrop.y + dy;
        if (potentialY >= 0 && startCrop.height - dy >= MIN_SIZE) {
          newY = potentialY;
          newH = startCrop.height - dy;
        } else if (potentialY < 0) {
          newY = 0;
          newH = startCrop.y + startCrop.height;
        }
      }
    }

    setCrop({
      x: Math.round(newX),
      y: Math.round(newY),
      width: Math.round(newW),
      height: Math.round(newH)
    });
  };

  const handlePointerUp = (e) => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
      try {
        e.target.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  const handleConfirmCrop = async () => {
    if (!imgRef.current || !imgLayout.loaded || crop.width === 0 || crop.height === 0) return;
    setIsProcessing(true);

    try {
      const img = imgRef.current;
      const scaleX = imgLayout.naturalWidth / imgLayout.renderedWidth;
      const scaleY = imgLayout.naturalHeight / imgLayout.renderedHeight;

      const realX = Math.max(0, Math.round(crop.x * scaleX));
      const realY = Math.max(0, Math.round(crop.y * scaleY));
      const realW = Math.min(imgLayout.naturalWidth - realX, Math.round(crop.width * scaleX));
      const realH = Math.min(imgLayout.naturalHeight - realY, Math.round(crop.height * scaleY));

      const canvas = document.createElement('canvas');
      canvas.width = realW;
      canvas.height = realH;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Canvas 2D context unavailable');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, realX, realY, realW, realH, 0, 0, realW, realH);

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else {
              canvas.toBlob((jpgB) => {
                if (jpgB) resolve(jpgB);
                else reject(new Error('Canvas empty'));
              }, 'image/jpeg', 0.92);
            }
          },
          'image/webp',
          0.92
        );
      });

      const previewUrl = URL.createObjectURL(blob);
      onConfirm({ blob, previewUrl });
    } catch (err) {
      console.error('Crop processing failed:', err);
      alert('Could not process photo crop. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        padding: 'env(safe-area-inset-top, 12px) 16px env(safe-area-inset-bottom, 16px) 16px',
        boxSizing: 'border-box',
        touchAction: 'none'
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Top Header Bar */}
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 4px',
          color: '#ffffff'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Crop size={22} color="#60a5fa" />
          <span style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.01em' }}>
            Crop Photo
          </span>
          <span
            style={{
              fontSize: '11px',
              background: 'rgba(96, 165, 250, 0.2)',
              color: '#93c5fd',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 600
            }}
          >
            {aspectMode === '1:1' ? '1:1 Square' : aspectMode === 'original' ? 'Original' : 'Free'}
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel crop"
          title="Cancel"
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: 'none',
            color: '#fff',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            minWidth: '40px',
            minHeight: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            touchAction: 'manipulation'
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Interactive Crop Viewport */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '640px',
          flex: 1,
          minHeight: '260px',
          maxHeight: '62vh',
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: '#0a0d14',
          boxShadow: '0 12px 30px rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* Base Photo */}
        <img
          ref={imgRef}
          src={imageSrc}
          alt="Crop target"
          onLoad={handleImageLoad}
          style={{
            position: 'absolute',
            left: `${imgLayout.offsetX}px`,
            top: `${imgLayout.offsetY}px`,
            width: `${imgLayout.renderedWidth}px`,
            height: `${imgLayout.renderedHeight}px`,
            pointerEvents: 'none',
            display: imgLayout.loaded ? 'block' : 'none'
          }}
        />

        {/* Outer Dark Mask Layers */}
        {imgLayout.loaded && crop.width > 0 && (
          <div
            style={{
              position: 'absolute',
              left: `${imgLayout.offsetX}px`,
              top: `${imgLayout.offsetY}px`,
              width: `${imgLayout.renderedWidth}px`,
              height: `${imgLayout.renderedHeight}px`,
              pointerEvents: 'none'
            }}
          >
            {/* Top mask */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${crop.y}px`,
                backgroundColor: 'rgba(0, 0, 0, 0.65)'
              }}
            />
            {/* Bottom mask */}
            <div
              style={{
                position: 'absolute',
                top: `${crop.y + crop.height}px`,
                left: 0,
                width: '100%',
                bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.65)'
              }}
            />
            {/* Left mask */}
            <div
              style={{
                position: 'absolute',
                top: `${crop.y}px`,
                left: 0,
                width: `${crop.x}px`,
                height: `${crop.height}px`,
                backgroundColor: 'rgba(0, 0, 0, 0.65)'
              }}
            />
            {/* Right mask */}
            <div
              style={{
                position: 'absolute',
                top: `${crop.y}px`,
                left: `${crop.x + crop.width}px`,
                right: 0,
                height: `${crop.height}px`,
                backgroundColor: 'rgba(0, 0, 0, 0.65)'
              }}
            />
          </div>
        )}

        {/* The Interactive Crop Box Overlay */}
        {imgLayout.loaded && crop.width > 0 && (
          <div
            style={{
              position: 'absolute',
              left: `${imgLayout.offsetX + crop.x}px`,
              top: `${imgLayout.offsetY + crop.y}px`,
              width: `${crop.width}px`,
              height: `${crop.height}px`,
              border: '2px solid #ffffff',
              boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(0, 0, 0, 0.3)',
              cursor: 'move',
              boxSizing: 'border-box',
              touchAction: 'none'
            }}
            onPointerDown={(e) => handlePointerDown(e, 'move')}
          >
            {/* Rule of Thirds Grid (3x3) */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gridTemplateRows: '1fr 1fr 1fr'
              }}
            >
              <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.35)', borderBottom: '1px solid rgba(255, 255, 255, 0.35)' }} />
              <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.35)', borderBottom: '1px solid rgba(255, 255, 255, 0.35)' }} />
              <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.35)' }} />
              <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.35)', borderBottom: '1px solid rgba(255, 255, 255, 0.35)' }} />
              <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.35)', borderBottom: '1px solid rgba(255, 255, 255, 0.35)' }} />
              <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.35)' }} />
              <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.35)' }} />
              <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.35)' }} />
              <div />
            </div>

            {/* Corner Handles */}
            {/* Top-Left */}
            <div
              onPointerDown={(e) => handlePointerDown(e, 'tl')}
              style={{
                position: 'absolute',
                top: '-20px',
                left: '-20px',
                width: '44px',
                height: '44px',
                cursor: 'nwse-resize',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none'
              }}
            >
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderTop: '3.5px solid #3b82f6',
                  borderLeft: '3.5px solid #3b82f6',
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
                  pointerEvents: 'none'
                }}
              />
            </div>

            {/* Top-Right */}
            <div
              onPointerDown={(e) => handlePointerDown(e, 'tr')}
              style={{
                position: 'absolute',
                top: '-20px',
                right: '-20px',
                width: '44px',
                height: '44px',
                cursor: 'nesw-resize',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none'
              }}
            >
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderTop: '3.5px solid #3b82f6',
                  borderRight: '3.5px solid #3b82f6',
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
                  pointerEvents: 'none'
                }}
              />
            </div>

            {/* Bottom-Left */}
            <div
              onPointerDown={(e) => handlePointerDown(e, 'bl')}
              style={{
                position: 'absolute',
                bottom: '-20px',
                left: '-20px',
                width: '44px',
                height: '44px',
                cursor: 'nesw-resize',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none'
              }}
            >
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderBottom: '3.5px solid #3b82f6',
                  borderLeft: '3.5px solid #3b82f6',
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
                  pointerEvents: 'none'
                }}
              />
            </div>

            {/* Bottom-Right */}
            <div
              onPointerDown={(e) => handlePointerDown(e, 'br')}
              style={{
                position: 'absolute',
                bottom: '-20px',
                right: '-20px',
                width: '44px',
                height: '44px',
                cursor: 'nwse-resize',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none'
              }}
            >
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderBottom: '3.5px solid #3b82f6',
                  borderRight: '3.5px solid #3b82f6',
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))',
                  pointerEvents: 'none'
                }}
              />
            </div>

            {/* Edge Drag Handles */}
            <div
              onPointerDown={(e) => handlePointerDown(e, 't')}
              style={{
                position: 'absolute',
                top: '-15px',
                left: '25px',
                right: '25px',
                height: '30px',
                cursor: 'ns-resize',
                zIndex: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none'
              }}
            >
              <div style={{ width: '28px', height: '4px', backgroundColor: '#3b82f6', borderRadius: '2px', boxShadow: '0 1px 2px rgba(0,0,0,0.5)' }} />
            </div>

            <div
              onPointerDown={(e) => handlePointerDown(e, 'b')}
              style={{
                position: 'absolute',
                bottom: '-15px',
                left: '25px',
                right: '25px',
                height: '30px',
                cursor: 'ns-resize',
                zIndex: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none'
              }}
            >
              <div style={{ width: '28px', height: '4px', backgroundColor: '#3b82f6', borderRadius: '2px', boxShadow: '0 1px 2px rgba(0,0,0,0.5)' }} />
            </div>

            <div
              onPointerDown={(e) => handlePointerDown(e, 'l')}
              style={{
                position: 'absolute',
                left: '-15px',
                top: '25px',
                bottom: '25px',
                width: '30px',
                cursor: 'ew-resize',
                zIndex: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none'
              }}
            >
              <div style={{ width: '4px', height: '28px', backgroundColor: '#3b82f6', borderRadius: '2px', boxShadow: '0 1px 2px rgba(0,0,0,0.5)' }} />
            </div>

            <div
              onPointerDown={(e) => handlePointerDown(e, 'r')}
              style={{
                position: 'absolute',
                right: '-15px',
                top: '25px',
                bottom: '25px',
                width: '30px',
                cursor: 'ew-resize',
                zIndex: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'none'
              }}
            >
              <div style={{ width: '4px', height: '28px', backgroundColor: '#3b82f6', borderRadius: '2px', boxShadow: '0 1px 2px rgba(0,0,0,0.5)' }} />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Control Bar */}
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          paddingTop: '10px'
        }}
      >
        {/* Aspect Ratio Selector Pills */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => handleSelectAspect('1:1')}
              style={{
                padding: '8px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 700,
                border: aspectMode === '1:1' ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.2)',
                background: aspectMode === '1:1' ? '#2563eb' : 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                cursor: 'pointer',
                minHeight: '38px',
                touchAction: 'manipulation',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span>⬛ 1:1 Square</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectAspect('free')}
              style={{
                padding: '8px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 600,
                border: aspectMode === 'free' ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.2)',
                background: aspectMode === 'free' ? '#2563eb' : 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                cursor: 'pointer',
                minHeight: '38px',
                touchAction: 'manipulation'
              }}
            >
              Freeform
            </button>

            <button
              type="button"
              onClick={() => handleSelectAspect('original')}
              style={{
                padding: '8px 14px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: 600,
                border: aspectMode === 'original' ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.2)',
                background: aspectMode === 'original' ? '#2563eb' : 'rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                cursor: 'pointer',
                minHeight: '38px',
                touchAction: 'manipulation'
              }}
            >
              Original
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            title="Reset crop"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#cbd5e1',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              minHeight: '38px',
              touchAction: 'manipulation'
            }}
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>

        {/* Action Buttons: Cancel and Confirm */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            style={{
              background: 'rgba(255, 255, 255, 0.14)',
              color: '#f3f4f6',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '16px',
              minHeight: '50px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              touchAction: 'manipulation'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmCrop}
            disabled={isProcessing}
            style={{
              background: isProcessing ? '#6b7280' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '16px',
              minHeight: '50px',
              cursor: isProcessing ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(37, 99, 235, 0.45)',
              touchAction: 'manipulation'
            }}
          >
            <Check size={20} />
            {isProcessing ? 'Applying Crop...' : 'Confirm Crop'}
          </button>
        </div>
      </div>
    </div>
  );
}
