import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { ZoomIn, ZoomOut, Check, X, RotateCcw, Crop } from 'lucide-react';

// Helper function to create an image element from URL
const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      image.setAttribute('crossOrigin', 'anonymous');
    }
    image.src = url;
  });

/**
 * Returns a Blob of the cropped area of an image using an HTML5 Canvas.
 */
async function getCroppedImg(imageSrc, pixelCrop) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  // Set canvas size to the cropped dimensions
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // Draw the cropped portion to the canvas
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  // Return as a Blob (webp format with jpeg fallback)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          // Fallback to image/jpeg if webp not supported by canvas implementation
          canvas.toBlob(
            (jpegBlob) => {
              if (!jpegBlob) {
                reject(new Error('Canvas is empty'));
                return;
              }
              resolve(jpegBlob);
            },
            'image/jpeg',
            0.92
          );
          return;
        }
        resolve(blob);
      },
      'image/webp',
      0.92
    );
  });
}

export default function PhotoCropperModal({
  imageSrc,
  onConfirm,
  onCancel,
  initialAspect = null
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [aspect, setAspect] = useState(initialAspect); // null = free / flexible
  const [isProcessing, setIsProcessing] = useState(false);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels || !imageSrc) return;
    try {
      setIsProcessing(true);
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const croppedPreviewUrl = URL.createObjectURL(croppedBlob);
      onConfirm({ blob: croppedBlob, previewUrl: croppedPreviewUrl });
    } catch (e) {
      console.error('Failed to generate cropped image:', e);
      alert('Could not crop image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const aspectOptions = [
    { label: 'Free', value: null },
    { label: '1:1 Square', value: 1 / 1 },
    { label: '3:4 Portrait', value: 3 / 4 },
    { label: '4:3 Landscape', value: 4 / 3 },
    { label: '16:9 Wide', value: 16 / 9 },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.92)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        padding: 'env(safe-area-inset-top, 12px) 16px env(safe-area-inset-bottom, 16px) 16px',
        boxSizing: 'border-box'
      }}
    >
      {/* Top Bar: Title & Cancel */}
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 4px 8px 4px',
          color: '#ffffff'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Crop size={22} color="#60a5fa" />
          <span style={{ fontSize: '17px', fontWeight: 600, letterSpacing: '-0.01em' }}>
            Crop / Adjust Photo
          </span>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel crop"
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

      {/* Main Cropper Viewport */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '640px',
          flex: 1,
          minHeight: '280px',
          maxHeight: '60vh',
          borderRadius: '16px',
          overflow: 'hidden',
          backgroundColor: '#111827',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
        }}
      >
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          showGrid={true}
          style={{
            containerStyle: {
              width: '100%',
              height: '100%',
              backgroundColor: '#0f172a'
            },
            cropAreaStyle: {
              border: '2px solid #3b82f6',
              boxShadow: '0 0 0 9999em rgba(0, 0, 0, 0.65)'
            }
          }}
        />
      </div>

      {/* Bottom Controls Area */}
      <div
        style={{
          width: '100%',
          maxWidth: '640px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '12px 0 8px 0'
        }}
      >
        {/* Aspect Ratio Selector Pills */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '4px',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'none'
          }}
        >
          {aspectOptions.map((opt) => {
            const isSelected = aspect === opt.value;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => setAspect(opt.value)}
                style={{
                  flex: '0 0 auto',
                  padding: '8px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: isSelected ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.2)',
                  background: isSelected ? '#2563eb' : 'rgba(255, 255, 255, 0.1)',
                  color: isSelected ? '#ffffff' : '#d1d5db',
                  cursor: 'pointer',
                  minHeight: '36px',
                  touchAction: 'manipulation',
                  transition: 'all 0.15s ease'
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Zoom Slider & Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: 'rgba(255, 255, 255, 0.08)',
            padding: '8px 14px',
            borderRadius: '14px'
          }}
        >
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, z - 0.2))}
            aria-label="Zoom out"
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '36px',
              minHeight: '36px',
              touchAction: 'manipulation'
            }}
          >
            <ZoomOut size={20} />
          </button>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.05}
            aria-label="Zoom level"
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{
              flex: 1,
              accentColor: '#3b82f6',
              height: '6px',
              cursor: 'pointer'
            }}
          />
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
            aria-label="Zoom in"
            style={{
              background: 'none',
              border: 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '36px',
              minHeight: '36px',
              touchAction: 'manipulation'
            }}
          >
            <ZoomIn size={20} />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setCrop({ x: 0, y: 0 });
            }}
            title="Reset position & zoom"
            aria-label="Reset crop position"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              color: '#cbd5e1',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              minHeight: '34px',
              touchAction: 'manipulation'
            }}
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>

        {/* Action Buttons: Cancel and Confirm */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px', marginTop: '4px' }}>
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
              minHeight: '48px',
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
            onClick={handleConfirm}
            disabled={isProcessing}
            style={{
              background: isProcessing ? '#6b7280' : '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '16px',
              minHeight: '48px',
              cursor: isProcessing ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.4)',
              touchAction: 'manipulation'
            }}
          >
            <Check size={20} />
            {isProcessing ? 'Applying...' : 'Confirm Crop'}
          </button>
        </div>
      </div>
    </div>
  );
}
