declare module '@empoweredvote/ev-ui' {
  import { CSSProperties } from 'react';

  export interface SiteFooterLink {
    label: string;
    href: string;
    external?: boolean;
  }

  export interface SiteFooterProps {
    darkMode?: boolean;
    brandLabel?: string;
    year?: number;
    links?: SiteFooterLink[];
    newsletter?: boolean;
    endpoint?: string;
    className?: string;
    style?: CSSProperties;
  }

  export function SiteFooter(props?: SiteFooterProps): JSX.Element;
}
