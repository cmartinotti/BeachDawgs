const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateUUID(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
    throw errorResponse(400, `${fieldName} must be a valid UUID`);
  }
  return value;
}

export function validateCoordinates(
  lat: unknown,
  lng: unknown
): { lat: number; lng: number } {
  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (isNaN(latNum) || latNum < -90 || latNum > 90) {
    throw errorResponse(400, 'latitude must be a number between -90 and 90');
  }
  if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
    throw errorResponse(400, 'longitude must be a number between -180 and 180');
  }

  return { lat: latNum, lng: lngNum };
}

export function sanitizeText(
  value: unknown,
  fieldName: string,
  maxLength: number
): string {
  if (typeof value !== 'string') {
    throw errorResponse(400, `${fieldName} must be a string`);
  }
  // Strip null bytes, control characters, and excessive whitespace
  const sanitized = value.replace(/[\x00-\x1F\x7F]/g, '').trim();
  if (sanitized.length > maxLength) {
    throw errorResponse(400, `${fieldName} must be ${maxLength} characters or fewer`);
  }
  return sanitized;
}

export function parseJsonBody(body: unknown, required: string[]): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw errorResponse(400, 'Request body must be a JSON object');
  }
  const obj = body as Record<string, unknown>;
  for (const field of required) {
    if (obj[field] === undefined || obj[field] === null) {
      throw errorResponse(400, `Missing required field: ${field}`);
    }
  }
  return obj;
}

function errorResponse(status: number, message: string): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}
