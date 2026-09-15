// Shared geolocation helper with clear error reporting.
// Browsers block navigator.geolocation on insecure origins (anything
// other than HTTPS or localhost) and when site permission was denied
// — surface both cases explicitly instead of failing silently.

const DENIED_MESSAGE =
  'Location access is BLOCKED for this site. ' +
  'Click the lock/tune icon in the address bar → set Location to "Allow", then reload and try again.';

export async function getCurrentPosition(options = {}) {
  if (!('geolocation' in navigator)) {
    throw new Error('Geolocation is not supported by this browser.');
  }
  if (window.isSecureContext === false) {
    throw new Error(
      'Location detection requires a secure connection. Open the site via https:// or http://localhost.'
    );
  }

  // Detect permanently-blocked permission up front — without this the
  // browser fails the request instantly and shows no prompt at all.
  if (navigator.permissions?.query) {
    let status;
    try {
      status = await navigator.permissions.query({ name: 'geolocation' });
    } catch {
      status = null; // Permissions API unsupported here — fall through
    }
    if (status?.state === 'denied') {
      const err = new Error(DENIED_MESSAGE);
      err.code = 1; // PERMISSION_DENIED
      throw err;
    }
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 30000,
      ...options,
    });
  });
}

export function describeGeoError(err) {
  switch (err?.code) {
    case 1: // PERMISSION_DENIED
      return (
        err?.message ||
        'Location permission was denied. Allow location access in your browser site settings, then try again.'
      );
    case 2: // POSITION_UNAVAILABLE
      return 'Your position is unavailable right now — check that Location Services are enabled on your device.';
    case 3: // TIMEOUT
      return 'Getting your location took too long. Please try again.';
    default:
      return err?.message || 'Could not detect your location.';
  }
}
