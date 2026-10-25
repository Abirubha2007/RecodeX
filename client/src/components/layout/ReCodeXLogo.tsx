/**
 * ReCodeX logo components — Hexagon Tech brand identity.
 * All three variants use the shared SVG icon for crisp rendering at any size.
 */

interface IconProps {
  size?: number;
  className?: string;
}

/** Standalone hexagon </> icon */
export function HexIcon({ size = 32, className }: IconProps) {
  return (
    <img
      src="/recodex-icon.svg"
      alt="ReCodeX icon"
      width={size}
      height={size}
      className={className}
      draggable={false}
      style={{ display: 'block', flexShrink: 0 }}
    />
  );
}

interface LogoProps {
  /** Show full horizontal logo (icon + wordmark + tagline). */
  full?: boolean;
  /** Show icon + wordmark only (no tagline). Ignored when full=true. */
  wordmark?: boolean;
  iconSize?: number;
  className?: string;
}

/**
 * Primary ReCodeX logo.
 *
 * Usage:
 *   <ReCodeXLogo />                      → icon only (32px)
 *   <ReCodeXLogo wordmark />             → icon + "ReCodeX" text
 *   <ReCodeXLogo full />                 → full horizontal logo SVG
 */
export function ReCodeXLogo({ full = false, wordmark = false, iconSize = 32, className }: LogoProps) {
  if (full) {
    return (
      <img
        src="/recodex-logo.svg"
        alt="ReCodeX – Write · Run · Optimize · Verify"
        height={iconSize * 1.5}
        className={className}
        draggable={false}
        style={{ display: 'block' }}
      />
    );
  }

  if (wordmark) {
    return (
      <div
        className={className}
        style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}
      >
        <HexIcon size={iconSize} />
        <span
          style={{
            fontSize: iconSize * 0.5625,
            fontWeight: 700,
            color: 'var(--color-heading)',
            whiteSpace: 'nowrap',
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          Re<span style={{ color: 'var(--color-primary)' }}>Code</span>X
        </span>
      </div>
    );
  }

  return <HexIcon size={iconSize} className={className} />;
}
