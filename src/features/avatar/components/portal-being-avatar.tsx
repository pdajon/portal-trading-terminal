import { forwardRef } from "react";

type PortalBeingAvatarProps = {
  className?: string;
};

export const PortalBeingAvatar = forwardRef<SVGGElement, PortalBeingAvatarProps>(
  function PortalBeingAvatar({ className }, eyeGroupRef) {
  return (
    <svg
      className={className}
      width="512"
      height="512"
      viewBox="62 108 388 370"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Portal Being"
    >
      <defs>
        <radialGradient
          id="bodyFill"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(222 202) rotate(67) scale(316 267)"
        >
          <stop stopColor="#243C6B" stopOpacity="0.95" />
          <stop offset="0.36" stopColor="#121936" stopOpacity="0.98" />
          <stop offset="0.7" stopColor="#080B19" />
          <stop offset="1" stopColor="#04050B" />
        </radialGradient>
        <radialGradient
          id="facePlate"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(256 244) rotate(90) scale(86 142)"
        >
          <stop stopColor="#080B11" />
          <stop offset="0.62" stopColor="#02040A" />
          <stop offset="1" stopColor="#000106" />
        </radialGradient>
        <linearGradient
          id="rimStroke"
          x1="103"
          y1="148"
          x2="407"
          y2="436"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8B5CF6" stopOpacity="0.82" />
          <stop offset="0.48" stopColor="#67E8F9" stopOpacity="0.72" />
          <stop offset="1" stopColor="#2563EB" stopOpacity="0.36" />
        </linearGradient>
        <linearGradient
          id="eyeFill"
          x1="211"
          y1="228"
          x2="305"
          y2="309"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#CFFAFE" />
          <stop offset="0.42" stopColor="#67E8F9" />
          <stop offset="1" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient
          id="sideFill"
          x1="101"
          y1="235"
          x2="411"
          y2="337"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#3B1B83" />
          <stop offset="0.5" stopColor="#0B1532" />
          <stop offset="1" stopColor="#0E7490" />
        </linearGradient>
        <radialGradient
          id="lowerNubFill"
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(256 416) rotate(90) scale(74 122)"
        >
          <stop stopColor="#17264D" />
          <stop offset="0.48" stopColor="#0B1128" />
          <stop offset="1" stopColor="#04050B" />
        </radialGradient>
        <filter
          id="softAura"
          x="54"
          y="72"
          width="404"
          height="392"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter
          id="eyeAura"
          x="180"
          y="204"
          width="154"
          height="94"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      <rect width="512" height="640" fill="transparent" />
      <path
        d="M148 255C126 237 91 250 82 287C73 324 96 358 131 357C152 356 168 341 175 316L148 255Z"
        fill="url(#sideFill)"
        opacity="0.6"
        filter="url(#softAura)"
      />
      <path
        d="M364 255C386 237 421 250 430 287C439 324 416 358 381 357C360 356 344 341 337 316L364 255Z"
        fill="url(#sideFill)"
        opacity="0.6"
        filter="url(#softAura)"
      />
      <path
        d="M148 255C126 237 91 250 82 287C73 324 96 358 131 357C152 356 168 341 175 316"
        fill="url(#sideFill)"
        stroke="url(#rimStroke)"
        strokeWidth="1.65"
        strokeOpacity="0.5"
      />
      <path
        d="M364 255C386 237 421 250 430 287C439 324 416 358 381 357C360 356 344 341 337 316"
        fill="url(#sideFill)"
        stroke="url(#rimStroke)"
        strokeWidth="1.65"
        strokeOpacity="0.5"
      />
      <path
        d="M183 387C164 403 166 439 191 454C219 471 253 450 254 414C255 393 239 379 216 378C201 378 190 381 183 387Z"
        fill="url(#lowerNubFill)"
        stroke="url(#rimStroke)"
        strokeWidth="1.7"
        strokeOpacity="0.52"
      />
      <path
        d="M329 387C348 403 346 439 321 454C293 471 259 450 258 414C257 393 273 379 296 378C311 378 322 381 329 387Z"
        fill="url(#lowerNubFill)"
        stroke="url(#rimStroke)"
        strokeWidth="1.7"
        strokeOpacity="0.52"
      />

      <path
        d="M256 126C346 126 400 185 406 276C412 367 352 432 256 432C160 432 100 367 106 276C112 185 166 126 256 126Z"
        fill="url(#bodyFill)"
        filter="url(#softAura)"
        opacity="0.62"
      />
      <path
        d="M256 130C341 130 395 187 400 276C405 363 348 424 256 424C164 424 107 363 112 276C117 187 171 130 256 130Z"
        fill="url(#bodyFill)"
        stroke="url(#rimStroke)"
        strokeWidth="2.4"
      />

      <path
        d="M163 225C181 187 219 171 256 171C293 171 331 187 349 225C363 256 351 296 319 318C288 339 224 339 193 318C161 296 149 256 163 225Z"
        fill="url(#facePlate)"
        stroke="#1E293B"
        strokeWidth="2.3"
      />

      <g ref={eyeGroupRef} transform="translate(0 0)">
        <rect
          className="portal-being-eye"
          x="204"
          y="232"
          width="22"
          height="55"
          rx="11"
          fill="url(#eyeFill)"
          filter="url(#eyeAura)"
        />
        <rect
          className="portal-being-eye"
          x="286"
          y="232"
          width="22"
          height="55"
          rx="11"
          fill="url(#eyeFill)"
          filter="url(#eyeAura)"
        />
        <rect
          className="portal-being-eye-highlight"
          x="209"
          y="238"
          width="12"
          height="43"
          rx="6"
          fill="#ECFEFF"
          fillOpacity="0.44"
        />
        <rect
          className="portal-being-eye-highlight"
          x="291"
          y="238"
          width="12"
          height="43"
          rx="6"
          fill="#ECFEFF"
          fillOpacity="0.44"
        />
      </g>

    </svg>
  );
  },
);
