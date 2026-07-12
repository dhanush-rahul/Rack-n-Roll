/**
 * Compare dotted version strings. Returns -1, 0, or 1.
 */
export function compareSemver(left, right) {
  const leftParts = String(left || '0')
    .split('.')
    .map((part) => Number(part) || 0);
  const rightParts = String(right || '0')
    .split('.')
    .map((part) => Number(part) || 0);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] || 0;
    const rightValue = rightParts[index] || 0;

    if (leftValue > rightValue) {
      return 1;
    }

    if (leftValue < rightValue) {
      return -1;
    }
  }

  return 0;
}

export function isVersionLessThan(installedVersion, minimumVersion) {
  return compareSemver(installedVersion, minimumVersion) < 0;
}

export function isVersionGreaterThan(installedVersion, latestVersion) {
  return compareSemver(installedVersion, latestVersion) < 0;
}
