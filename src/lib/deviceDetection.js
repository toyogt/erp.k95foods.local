/**
 * Device Detection & Classification
 * Identifies device type and optimizes layout accordingly
 */

export const DEVICE_MODES = {
  DESKTOP: 'desktop',
  MOBILE: 'mobile',
  SCANNER: 'scanner',
  KIOSK: 'kiosk',
};

/**
 * Detect device type from user agent and screen size
 */
export function detectDeviceMode() {
  const ua = navigator.userAgent.toLowerCase();
  
  // Explicit scanner device detection
  if (ua.includes('zebra') || ua.includes('honeywell') || ua.includes('motorola')) {
    return DEVICE_MODES.SCANNER;
  }

  // Kiosk detection (full-screen, no URL bar)
  if (window.innerHeight === screen.height && window.innerWidth === screen.width) {
    return DEVICE_MODES.KIOSK;
  }

  // Mobile detection
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
  const isSmallScreen = window.innerWidth < 768;
  
  if (isMobile || isSmallScreen) {
    return DEVICE_MODES.MOBILE;
  }

  return DEVICE_MODES.DESKTOP;
}

/**
 * Check if touch device
 */
export function isTouchDevice() {
  return (
    ('ontouchstart' in window) ||
    (navigator.maxTouchPoints > 0) ||
    (navigator.msMaxTouchPoints > 0)
  );
}

/**
 * Get device characteristics for layout decisions
 */
export function getDeviceCharacteristics() {
  const mode = detectDeviceMode();
  const isTouch = isTouchDevice();
  const width = window.innerWidth;
  const height = window.innerHeight;

  const characteristics = {
    mode,
    isTouch,
    width,
    height,
    isMobile: mode === DEVICE_MODES.MOBILE,
    isScanner: mode === DEVICE_MODES.SCANNER,
    isKiosk: mode === DEVICE_MODES.KIOSK,
    isDesktop: mode === DEVICE_MODES.DESKTOP,
    orientation: width > height ? 'landscape' : 'portrait',
    hasKeyboard: mode === DEVICE_MODES.DESKTOP,
    hasMouse: !isTouch,
  };

  return characteristics;
}

/**
 * Get optimal UI sizes for device mode
 */
export function getOptimalSizes(mode = null) {
  const deviceMode = mode || detectDeviceMode();

  const sizes = {
    [DEVICE_MODES.DESKTOP]: {
      buttonHeight: 'h-9',
      buttonPadding: 'px-4 py-2',
      inputHeight: 'h-9',
      inputFontSize: 'text-sm',
      labelSize: 'text-xs',
      gapVertical: 'space-y-3',
      gapHorizontal: 'gap-3',
      padding: 'p-4 md:p-6 lg:p-8',
      tableDensity: 'compact',
    },
    [DEVICE_MODES.MOBILE]: {
      buttonHeight: 'h-11',
      buttonPadding: 'px-4 py-3',
      inputHeight: 'h-11',
      inputFontSize: 'text-base',
      labelSize: 'text-sm',
      gapVertical: 'space-y-4',
      gapHorizontal: 'gap-4',
      padding: 'p-3 md:p-4',
      tableDensity: 'comfortable',
    },
    [DEVICE_MODES.SCANNER]: {
      buttonHeight: 'h-14',
      buttonPadding: 'px-6 py-4',
      inputHeight: 'h-14',
      inputFontSize: 'text-lg',
      labelSize: 'text-base',
      gapVertical: 'space-y-6',
      gapHorizontal: 'gap-6',
      padding: 'p-4',
      tableDensity: 'sparse',
    },
    [DEVICE_MODES.KIOSK]: {
      buttonHeight: 'h-12',
      buttonPadding: 'px-6 py-3',
      inputHeight: 'h-12',
      inputFontSize: 'text-base',
      labelSize: 'text-sm',
      gapVertical: 'space-y-4',
      gapHorizontal: 'gap-4',
      padding: 'p-4 md:p-6',
      tableDensity: 'comfortable',
    },
  };

  return sizes[deviceMode];
}

/**
 * Get layout configuration for device
 */
export function getLayoutConfig(mode = null) {
  const deviceMode = mode || detectDeviceMode();

  const layouts = {
    [DEVICE_MODES.DESKTOP]: {
      sidebarCollapsed: false,
      navVisible: true,
      gridColumns: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
      maxWidth: 'max-w-7xl',
      tableMode: 'full',
      showFilters: true,
      showSearch: true,
    },
    [DEVICE_MODES.MOBILE]: {
      sidebarCollapsed: true,
      navVisible: 'drawer',
      gridColumns: 'grid-cols-1',
      maxWidth: 'max-w-2xl',
      tableMode: 'list',
      showFilters: 'expandable',
      showSearch: true,
      stickyActionBar: true,
    },
    [DEVICE_MODES.SCANNER]: {
      sidebarCollapsed: true,
      navVisible: false,
      gridColumns: 'grid-cols-1',
      maxWidth: 'max-w-2xl',
      tableMode: 'hidden',
      showFilters: false,
      showSearch: 'scan_only',
      stickyActionBar: true,
      fullScreenMode: true,
    },
    [DEVICE_MODES.KIOSK]: {
      sidebarCollapsed: true,
      navVisible: 'bottom',
      gridColumns: 'grid-cols-1',
      maxWidth: 'max-w-4xl',
      tableMode: 'list',
      showFilters: 'expandable',
      showSearch: false,
      stickyActionBar: true,
    },
  };

  return layouts[deviceMode];
}

/**
 * Check if layout should stack vertically
 */
export function shouldStack(mode = null) {
  const deviceMode = mode || detectDeviceMode();
  return deviceMode !== DEVICE_MODES.DESKTOP;
}

/**
 * Check if action bar should be sticky
 */
export function shouldStickyActionBar(mode = null) {
  const deviceMode = mode || detectDeviceMode();
  return [DEVICE_MODES.MOBILE, DEVICE_MODES.SCANNER, DEVICE_MODES.KIOSK].includes(deviceMode);
}

/**
 * Get responsive class for button
 */
export function getResponsiveButtonClass(mode = null) {
  const sizes = getOptimalSizes(mode);
  return `${sizes.buttonHeight} ${sizes.buttonPadding} font-medium text-sm md:text-base rounded-lg`;
}

/**
 * Get responsive class for input
 */
export function getResponsiveInputClass(mode = null) {
  const sizes = getOptimalSizes(mode);
  return `${sizes.inputHeight} ${sizes.inputFontSize} border border-slate-200 rounded-lg px-3 py-2`;
}