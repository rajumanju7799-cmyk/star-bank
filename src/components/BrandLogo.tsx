interface BrandLogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
}

export default function BrandLogo({ size = 44, className = '', showText = true }: BrandLogoProps) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src="/star-bank-logo.png"
        alt="Little Star Bank logo"
        width={size}
        height={size}
        className="rounded-xl shadow-md"
      />
      {showText && <span className="font-extrabold tracking-tight">Little Star Bank</span>}
    </div>
  );
}
