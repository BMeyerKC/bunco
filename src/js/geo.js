// js/geo.js
export async function captureOrigin() {
  const res = await fetch('https://ipapi.co/json/');
  if (!res.ok) throw new Error(`geo lookup failed: ${res.status}`);
  const data = await res.json();
  return {
    ip: data.ip ?? null,
    city: data.city ?? null,
    region: data.region ?? null,
    country: data.country_name ?? null,
  };
}
