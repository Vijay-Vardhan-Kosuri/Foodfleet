import React, { useState } from "react";
import { Utensils } from "lucide-react";

interface Props {
  src?: string | null;
  alt: string;
  className?: string;
}

export const PhotoFrame: React.FC<Props> = ({ src, alt, className = "" }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-charcoal/90 text-cream/80 p-4 text-center ${className}`}
      >
        <Utensils className="w-7 h-7 text-food-orange mb-2" />
        <span className="text-xs font-medium tracking-wide uppercase opacity-80 line-clamp-1">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
};
