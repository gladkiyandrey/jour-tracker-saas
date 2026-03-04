import Link from "next/link";

type SiteLogoProps = {
  href?: string;
  className?: string;
};

export default function SiteLogo({ href = "/app", className = "" }: SiteLogoProps) {
  const cls = `site-logo ${className}`.trim();
  return (
    <Link href={href} className={cls} aria-label="Consist">
      <img src="/brand/consist-logo-white.svg" alt="Consist" />
    </Link>
  );
}
