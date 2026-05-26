"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  href?: string;
  variant?: "dark" | "light"; // dark = logo on light bg, light = logo on dark bg
}

export function Logo({ className, size = "md", href = "/", variant = "dark" }: LogoProps) {
  const heights = { sm: 28, md: 34, lg: 42 };
  const h = heights[size];

  // Use the logo+text SVG — white bg version for dark text (dark variant), black bg version for light text (light variant)
  const src = variant === "light"
    ? "/clonyfy-logo-text-black.svg"   // black bg = white text logo (for dark backgrounds)
    : "/clonyfy-logo-text-white.svg";  // white bg = dark text logo (for light backgrounds)

  return (
    <Link href={href} className={cn("flex items-center shrink-0 group", className)}>
      <Image
        src={src}
        alt="Clonyfy"
        height={h}
        width={h * 4.5}
        className="object-contain"
        priority
      />
    </Link>
  );
}
