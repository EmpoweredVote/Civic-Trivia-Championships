import { useRef, useState } from 'react';

interface AvatarProps {
  name: string;
  imageUrl?: string | null;
  size?: number;
  onUpload?: (file: File) => void;
}

export function Avatar({ name, imageUrl, size = 80, onUpload }: AvatarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract initials (first letter of first and last name parts)
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Deterministic background color from name hash
  const getBackgroundColor = (name: string): string => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-teal-500',
      'bg-amber-500',
      'bg-cyan-500',
    ];

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    return colors[Math.abs(hash) % colors.length];
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onUpload) {
      onUpload(file);
    }
  };

  const handleClick = () => {
    if (onUpload) {
      fileInputRef.current?.click();
    }
  };

  const containerClasses = `relative rounded-full flex items-center justify-center ${
    onUpload ? 'cursor-pointer' : ''
  }`;

  const content = imageUrl ? (
    <img
      src={imageUrl}
      alt={name}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className={`rounded-full flex items-center justify-center text-white font-bold ${getBackgroundColor(
        name
      )}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
      }}
    >
      {getInitials(name)}
    </div>
  );

  return (
    <div
      className={containerClasses}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {content}

      {/* Camera/edit icon overlay on hover (only if upload is enabled) */}
      {onUpload && isHovered && (
        <div className="absolute inset-0 rounded-full bg-black bg-opacity-50 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </div>
      )}

      {/* Hidden file input */}
      {onUpload && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
      )}
    </div>
  );
}
