/**
 * Device Mode Hook
 * Manages device detection and manual overrides
 */

import { useState, useEffect } from 'react';
import {
  detectDeviceMode,
  getDeviceCharacteristics,
  getOptimalSizes,
  getLayoutConfig,
  shouldStack,
  shouldStickyActionBar,
  DEVICE_MODES,
} from '@/lib/deviceDetection';

export function useDeviceMode(userRole = null) {
  const [mode, setMode] = useState(null);
  const [isManualOverride, setIsManualOverride] = useState(false);

  useEffect(() => {
    // Load saved preference if exists
    const saved = localStorage.getItem('device_mode_override');
    if (saved) {
      setMode(saved);
      setIsManualOverride(true);
    } else {
      // Auto-detect
      setMode(detectDeviceMode());
      setIsManualOverride(false);
    }

    // Re-detect on resize
    const handleResize = () => {
      if (!isManualOverride) {
        setMode(detectDeviceMode());
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isManualOverride]);

  const setModeOverride = (newMode) => {
    if (newMode === 'auto') {
      localStorage.removeItem('device_mode_override');
      setMode(detectDeviceMode());
      setIsManualOverride(false);
    } else {
      localStorage.setItem('device_mode_override', newMode);
      setMode(newMode);
      setIsManualOverride(true);
    }
  };

  // Determine best mode based on user role if no override
  useEffect(() => {
    if (!isManualOverride && userRole) {
      if (userRole === 'admin' || userRole === 'supervisor') {
        // Prefer desktop for supervisors
        if (mode === DEVICE_MODES.MOBILE && detectDeviceMode() === DEVICE_MODES.DESKTOP) {
          setMode(DEVICE_MODES.DESKTOP);
        }
      } else if (userRole === 'operator') {
        // Prefer touch mode for operators
        if (mode === DEVICE_MODES.DESKTOP) {
          setMode(DEVICE_MODES.MOBILE);
        }
      }
    }
  }, [userRole, isManualOverride]);

  const currentMode = mode || detectDeviceMode();

  return {
    mode: currentMode,
    isMobile: currentMode === DEVICE_MODES.MOBILE,
    isScanner: currentMode === DEVICE_MODES.SCANNER,
    isKiosk: currentMode === DEVICE_MODES.KIOSK,
    isDesktop: currentMode === DEVICE_MODES.DESKTOP,
    isManualOverride,
    setModeOverride,
    characteristics: getDeviceCharacteristics(),
    sizes: getOptimalSizes(currentMode),
    layout: getLayoutConfig(currentMode),
    shouldStack: shouldStack(currentMode),
    shouldStickyActionBar: shouldStickyActionBar(currentMode),
  };
}