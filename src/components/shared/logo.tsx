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

  const src = "/clonyfy-logo-new.jpg";

  return (
    <Link href={href} className={cn("flex items-center shrink-0 group", className)}>
      <Image
        src={src}
        alt="Clonyfy"
        height={h}
        width={Math.round(h * 1.55)}
        className="object-contain"
        priority
      />
    </Link>
  );
}
