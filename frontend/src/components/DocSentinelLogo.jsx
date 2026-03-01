/**
 * DocSentinel Logo
 * Shield shape with an AI scan line through a document
 */
const DocSentinelLogo = ({ size = 40, className = '' }) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Shield body */}
      <path
        d="M20 3L5 9V20C5 28.5 11.5 35.5 20 38C28.5 35.5 35 28.5 35 20V9L20 3Z"
        fill="url(#shield-gradient)"
      />
      {/* Shield inner highlight */}
      <path
        d="M20 6L8 11V20C8 27 13.5 33 20 35.2C26.5 33 32 27 32 20V11L20 6Z"
        fill="url(#shield-inner)"
        opacity="0.4"
      />
      {/* Document lines */}
      <rect x="14" y="14" width="8" height="1.5" rx="0.75" fill="white" opacity="0.9" />
      <rect x="14" y="17.5" width="12" height="1.5" rx="0.75" fill="white" opacity="0.9" />
      <rect x="14" y="21" width="10" height="1.5" rx="0.75" fill="white" opacity="0.9" />
      {/* Scan line — animated */}
      <line
        x1="8"
        y1="19.5"
        x2="32"
        y2="19.5"
        stroke="url(#scan-gradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <animate
          attributeName="y1"
          values="13;27;13"
          dur="2.5s"
          repeatCount="indefinite"
          calcMode="easeInOut"
        />
        <animate
          attributeName="y2"
          values="13;27;13"
          dur="2.5s"
          repeatCount="indefinite"
          calcMode="easeInOut"
        />
      </line>
      {/* Scan glow */}
      <line
        x1="8"
        y1="19.5"
        x2="32"
        y2="19.5"
        stroke="url(#scan-glow)"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.3"
      >
        <animate
          attributeName="y1"
          values="13;27;13"
          dur="2.5s"
          repeatCount="indefinite"
          calcMode="easeInOut"
        />
        <animate
          attributeName="y2"
          values="13;27;13"
          dur="2.5s"
          repeatCount="indefinite"
          calcMode="easeInOut"
        />
      </line>
  
      <defs>
        <linearGradient id="shield-gradient" x1="20" y1="3" x2="20" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id="shield-inner" x1="20" y1="6" x2="20" y2="35" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="scan-gradient" x1="8" y1="0" x2="32" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0" />
          <stop offset="30%" stopColor="#93c5fd" />
          <stop offset="50%" stopColor="white" />
          <stop offset="70%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="scan-glow" x1="8" y1="0" x2="32" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
          <stop offset="50%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  )
  
  export default DocSentinelLogo