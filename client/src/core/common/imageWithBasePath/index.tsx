
import { useState, useEffect, type CSSProperties } from 'react';
import { img_path } from '../../../environment';
import { apiService, getTenantBearerToken } from '../../services/apiService';

/** Paths that must hit the API host (not the static SPA host). */
function isRemoteApiMediaPath(raw: string): boolean {
  const s = (raw || '').trim();
  if (!s || /^https?:\/\//i.test(s)) return false;
  return (
    s.startsWith('/api/') ||
    s.startsWith('api/') ||
    s.startsWith('/storage/files/') ||
    s.startsWith('storage/files/') ||
    s.startsWith('school_')
  );
}

function resolveStaticSrc(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return `${img_path}`;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith('/')) return s;
  return `${img_path}${s}`;
}

interface Image {
  className?: string;
  src: string;
  alt?: string;
  height?: number;
  width?: number;
  id?: string;
  gender?: string;
  style?: CSSProperties;
}

const ImageWithBasePath = (props: Image) => {
  const apiMedia = isRemoteApiMediaPath(props.src);
  const [imgSrc, setImgSrc] = useState(() =>
    apiMedia ? '' : resolveStaticSrc(props.src)
  );
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(apiMedia);

  useEffect(() => {
    setHasError(false);
    const src = props.src;

    if (!isRemoteApiMediaPath(src)) {
      setLoading(false);
      setImgSrc(resolveStaticSrc(src));
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setImgSrc('');

    (async () => {
      try {
        const abs = await apiService.resolveAvatarUrl(String(src).trim());
        if (!abs) {
          if (!cancelled) {
            setHasError(true);
            setLoading(false);
          }
          return;
        }
        const headers: Record<string, string> = { Accept: 'image/*,*/*' };
        const tb = getTenantBearerToken();
        if (tb) headers.Authorization = `Bearer ${tb}`;
        const res = await fetch(abs, {
          method: 'GET',
          credentials: 'include',
          headers,
          cache: 'no-store',
          mode: 'cors',
        });
        if (!res.ok) {
          if (!cancelled) {
            setHasError(true);
            setLoading(false);
          }
          return;
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!cancelled) {
          setImgSrc(objectUrl);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setHasError(true);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [props.src]);

  const getDefaultAvatar = (gender?: string) => {
    switch (gender?.toLowerCase()) {
      case 'male':
        return `${img_path}assets/img/profiles/avatar-01.jpg`;
      case 'female':
        return `${img_path}assets/img/profiles/avatar-02.jpg`;
      default:
        return `${img_path}assets/img/profiles/avatar-01.jpg`;
    }
  };

  const handleImageError = () => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(getDefaultAvatar(props.gender));
    }
  };

  if (loading && !imgSrc) {
    return (
      <span
        className={props.className}
        style={{ ...props.style, display: 'inline-block', minWidth: 24, minHeight: 24, opacity: 0.35 }}
        aria-hidden
      />
    );
  }

  return (
    <img
      className={props.className}
      src={imgSrc || getDefaultAvatar(props.gender)}
      height={props.height}
      alt={props.alt}
      width={props.width}
      id={props.id}
      style={props.style}
      onError={handleImageError}
    />
  );
};

export default ImageWithBasePath;
