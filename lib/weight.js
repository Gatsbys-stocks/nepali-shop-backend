// Turns a size string like "500 gm", "1 kg", "250 ml", "1 ud" into a
// weight in grams, so we can build a parcel for a carrier rate quote.
// Liquids are approximated at 1g/ml. Countable units ("1 ud") default to 300g —
// adjust DEFAULT_UNIT_GRAMS if your average per-unit product is heavier/lighter.
const DEFAULT_UNIT_GRAMS = 300;

function sizeToGrams(size) {
  if (!size) return DEFAULT_UNIT_GRAMS;
  const s = size.toLowerCase().trim();
  const num = parseFloat(s.replace(",", "."));
  if (isNaN(num)) return DEFAULT_UNIT_GRAMS;

  if (s.includes("kg")) return num * 1000;
  if (s.includes("gm") || s.includes("g")) return num;
  if (s.includes("l") && !s.includes("ml")) return num * 1000; // litres ~ grams for water-like liquids
  if (s.includes("ml")) return num; // ~1g per ml
  if (s.includes("ud") || s.includes("pkt")) return DEFAULT_UNIT_GRAMS;
  return DEFAULT_UNIT_GRAMS;
}

// items: [{ size: "500 gm", qty: 2 }, ...]
// Returns total parcel weight in grams, including packaging overhead.
function parcelWeightGrams(items, packagingOverheadGrams = 200) {
  const productWeight = items.reduce(
    (sum, it) => sum + sizeToGrams(it.size) * (it.qty || 1),
    0
  );
  return Math.max(productWeight + packagingOverheadGrams, 100);
}

module.exports = { sizeToGrams, parcelWeightGrams };
