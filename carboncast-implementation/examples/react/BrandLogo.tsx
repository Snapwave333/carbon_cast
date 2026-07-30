import type { ImgHTMLAttributes } from "react";

type BrandLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> & {
  variant?: "horizontal" | "mark" | "stacked";
  surface?: "dark" | "light";
};

export function BrandLogo({
  variant = "horizontal",
  surface = "dark",
  className,
  ...props
}: BrandLogoProps) {
  const file = variant === "mark"
    ? "logo-mark.svg"
    : `logo-${variant}-${surface}.svg`;

  return (
    <img
      src={`/branding/logos/${file}`}
      alt="CarbonCast IPTV"
      className={className}
      draggable={false}
      {...props}
    />
  );
}
