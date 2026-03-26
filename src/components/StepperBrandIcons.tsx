/**
 * Brand icons for App create/edit steppers — same footprint for alignment.
 */
const tile =
  'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md overflow-hidden';

/** App step — same tile size as WhatsApp/Facebook */
export function AppStepIcon({
  active,
  className = '',
}: {
  active?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`${tile} border-2 ${
        active ? 'border-[#c01721] bg-[#c01721]/10 text-[#c01721]' : 'border-gray-300 bg-white text-gray-500'
      } ${className}`}
      aria-hidden
      title="App"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-4h6v4" />
      </svg>
    </span>
  );
}

/** Official WhatsApp mark (green tile + white logo) */
export function WhatsAppStepIcon({ className = '' }: { className?: string }) {
  return (
    <span className={`${tile} bg-[#25D366] ${className}`} aria-hidden title="WhatsApp">
      <svg
        viewBox="0 0 24 24"
        className="h-[14px] w-[14px]"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          fill="currentColor"
          className="text-white"
          d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"
        />
      </svg>
    </span>
  );
}

/** Facebook “f” on brand blue — matches WhatsApp tile size */
export function FacebookStepIcon({
  className = '',
  size = 'stepper',
}: {
  className?: string;
  /** stepper: 20px tile; button: slightly larger for primary CTAs */
  size?: 'stepper' | 'button';
}) {
  const outer =
    size === 'button'
      ? 'inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md overflow-hidden bg-[#1877F2]'
      : `${tile} bg-[#1877F2]`;
  const iconClass = size === 'button' ? 'h-3.5 w-3.5' : 'h-[14px] w-[14px]';
  return (
    <span className={`${outer} ${className}`} aria-hidden title="Facebook">
      <svg viewBox="0 0 24 24" className={iconClass} fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          fill="white"
          d="M15.12 5.02H17V2.14c-.88-.06-1.75-.1-2.64-.1-2.63 0-4.43 1.6-4.43 4.8V9.6H7v3.11h3.24V22h3.94v-9.29h3.15l.47-3.11h-3.62V7.99c0-.85.23-1.43 1.47-1.43h1.57V3.2z"
        />
      </svg>
    </span>
  );
}

/** White tile + blue f (for primary blue “Connect” buttons) */
export function FacebookButtonIcon({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-white ${className}`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg">
        <path
          fill="#1877F2"
          d="M15.12 5.02H17V2.14c-.88-.06-1.75-.1-2.64-.1-2.63 0-4.43 1.6-4.43 4.8V9.6H7v3.11h3.24V22h3.94v-9.29h3.15l.47-3.11h-3.62V7.99c0-.85.23-1.43 1.47-1.43h1.57V3.2z"
        />
      </svg>
    </span>
  );
}
