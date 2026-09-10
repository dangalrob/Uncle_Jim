import React, { useState, useEffect, useRef } from 'react';
import { thumbnailCache } from '../services/thumbnailCache';
import { Image, ImageOff } from 'lucide-react';

/**
 * CachedThumbnail Component
 * Persistent, low-bandwidth thumbnail that retrieves images from IndexedDB,
 * prioritizes visible items in viewport, and falls back gracefully on network failure.
 */
export default function CachedThumbnail({
  url,
  version = '1',
  alt = 'Estate Item',
  style = {},
  className = '',
  priority = false,
  onClick = null
}) {
  const containerRef = useRef(null);
  const [blobUrl, setBlobUrl] = useState(() => thumbnailCache.getMemoryBlobUrl(url, version));
  const [isLoading, setIsLoading] = useState(!blobUrl && !!url);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!url) {
      setBlobUrl(null);
      setIsLoading(false);
      return;
    }

    // Check if memory has it already
    const inMemory = thumbnailCache.getMemoryBlobUrl(url, version);
    if (inMemory) {
      setBlobUrl(inMemory);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    let isMounted = true;
    let observer = null;

    const fetchImage = (isHighPriority) => {
      setIsLoading(true);
      thumbnailCache.requestThumbnail(url, version, isHighPriority)
        .then((result) => {
          if (!isMounted) return;
          if (result) {
            setBlobUrl(result);
            setHasError(false);
          } else {
            setHasError(true);
          }
        })
        .catch(() => {
          if (isMounted) setHasError(true);
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    };

    if (priority) {
      fetchImage(true);
    } else if (typeof IntersectionObserver !== 'undefined' && containerRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry && (entry.isIntersecting || entry.intersectionRatio > 0)) {
            fetchImage(true);
            if (observer && containerRef.current) {
              observer.unobserve(containerRef.current);
            }
          }
        },
        { rootMargin: '250px' } // Preload when within 250px of viewport
      );
      observer.observe(containerRef.current);
    } else {
      fetchImage(false);
    }

    return () => {
      isMounted = false;
      if (observer && containerRef.current) {
        observer.disconnect();
      }
    };
  }, [url, version, priority]);

  const defaultContainerStyle = {
    position: 'relative',
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f2ee',
    overflow: 'hidden',
    ...style
  };

  if (!url || hasError) {
    return (
      <div ref={containerRef} style={defaultContainerStyle} className={className} onClick={onClick}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#9e9e9e', gap: '4px' }}>
          <ImageOff size={22} />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>No Image</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={defaultContainerStyle} className={className} onClick={onClick}>
      {blobUrl ? (
        <img
          src={blobUrl}
          alt={alt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: style.objectFit || 'contain',
            display: 'block'
          }}
          onError={() => setHasError(true)}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#b0bec5' }}>
          <Image size={24} style={{ opacity: 0.6, animation: isLoading ? 'pulse 1.5s infinite ease-in-out' : 'none' }} />
          {isLoading && (
            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>Cached load...</span>
          )}
        </div>
      )}
    </div>
  );
}
