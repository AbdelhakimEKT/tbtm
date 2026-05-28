/**
 * Wrapper minimal autour de l'API OpenFoodFacts (public, sans clé).
 * Doc : https://openfoodfacts.github.io/openfoodfacts-server/api/
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_OFF_BASE_URL ?? "https://world.openfoodfacts.org";

const USER_AGENT = "TBTM/0.1 (https://github.com/popi/tbtm)";

export type OFFProduct = {
  code: string;
  nom: string;
  marque: string | null;
  photo: string | null;
  caloriesP100: number;
  proteinesP100: number;
  glucidesP100: number;
  lipidesP100: number;
};

// Source : champ nutriments OFF — on ne prend que le pertinent
type OFFRawProduct = {
  code?: string;
  product_name?: string;
  product_name_fr?: string;
  brands?: string;
  image_small_url?: string;
  image_thumb_url?: string;
  image_front_thumb_url?: string;
  nutriments?: {
    "energy-kcal_100g"?: number;
    "energy-kcal"?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
  };
};

function normaliseProduct(raw: OFFRawProduct): OFFProduct | null {
  const code = raw.code;
  const nom = raw.product_name_fr || raw.product_name;
  if (!code || !nom) return null;
  const nut = raw.nutriments ?? {};
  const cal = nut["energy-kcal_100g"] ?? nut["energy-kcal"];
  if (cal == null) return null;
  return {
    code,
    nom,
    marque: raw.brands ?? null,
    photo:
      raw.image_front_thumb_url ??
      raw.image_thumb_url ??
      raw.image_small_url ??
      null,
    caloriesP100: round1(cal),
    proteinesP100: round1(nut.proteins_100g ?? 0),
    glucidesP100: round1(nut.carbohydrates_100g ?? 0),
    lipidesP100: round1(nut.fat_100g ?? 0),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function searchOpenFoodFacts(
  query: string,
  pageSize = 12,
): Promise<OFFProduct[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url =
    `${BASE_URL}/cgi/search.pl` +
    `?search_terms=${encodeURIComponent(q)}` +
    `&search_simple=1&action=process&json=1` +
    `&fields=code,product_name,product_name_fr,brands,image_front_thumb_url,image_thumb_url,nutriments` +
    `&page_size=${pageSize}`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { products?: OFFRawProduct[] };
    if (!data.products) return [];
    return data.products
      .map(normaliseProduct)
      .filter((p): p is OFFProduct => p !== null);
  } catch {
    return [];
  }
}

export async function lookupOpenFoodFactsBarcode(
  barcode: string,
): Promise<OFFProduct | null> {
  const code = barcode.trim();
  if (!code) return null;

  const url = `${BASE_URL}/api/v2/product/${encodeURIComponent(code)}.json`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status: number;
      product?: OFFRawProduct;
    };
    if (data.status !== 1 || !data.product) return null;
    return normaliseProduct({ ...data.product, code });
  } catch {
    return null;
  }
}
