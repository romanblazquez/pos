import { MeepleMark } from '@retail-os/ui-react';

interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return <MeepleMark className={className} />;
}
