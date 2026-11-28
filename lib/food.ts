// Food counter: one prompt + one normalizer shared by photo scan and text estimate.
// A meal is a list of items, each with its own grams and macros, so the user can
// fix a portion or delete an item and the totals stay consistent.

export type FoodItem = {
  name: string
  grams: number | null
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
}

export type Meal = {
  meal_name: string
  items: FoodItem[]
  confidence: 'high' | 'medium' | 'low'
  notes: string
}

const r1 = (v: number) => Math.round(v * 10) / 10

function num(v: any): number {
  if (v === null || v === undefined || v === '') return 0
  if (typeof v === 'object') return num(v.value ?? v.total ?? v.amount)
  const x = parseFloat(String(v).replace(',', '.'))
  return Number.isFinite(x) && x > 0 ? x : 0
}
const str = (v: any) => (v == null ? '' : typeof v === 'string' ? v : Array.isArray(v) ? v.join(', ') : Object.values(v).join(', '))

/** Coerce any model reply (old or new schema) into a Meal whose totals are the sum of its items. */
export function normalizeMeal(raw: any): Meal {
  const list: any[] = raw?.items ?? raw?.items_detected ?? raw?.items_breakdown ?? []
  let items: FoodItem[] = (Array.isArray(list) ? list : []).map((it: any) => ({
    name: str(it.name ?? it.item ?? it.food) || 'Item',
    grams: num(it.grams ?? it.weight_g ?? it.weight) || null,
    calories: Math.round(num(it.calories ?? it.kcal)),
    protein_g: r1(num(it.protein_g ?? it.protein)),
    carbs_g: r1(num(it.carbs_g ?? it.carbs)),
    fat_g: r1(num(it.fat_g ?? it.fat)),
    fiber_g: r1(num(it.fiber_g ?? it.fiber)),
  })).filter(it => it.calories > 0 || it.protein_g + it.carbs_g + it.fat_g > 0)

  if (!items.length) {
    items = [{
      name: str(raw?.meal_name ?? raw?.food_name) || 'Food',
      grams: num(raw?.grams) || null,
      calories: Math.round(num(raw?.calories)),
      protein_g: r1(num(raw?.protein_g)),
      carbs_g: r1(num(raw?.carbs_g)),
      fat_g: r1(num(raw?.fat_g)),
      fiber_g: r1(num(raw?.fiber_g)),
    }]
  }

  const conf = str(raw?.confidence).toLowerCase()
  return {
    meal_name: str(raw?.meal_name ?? raw?.food_name) || items.map(i => i.name).join(', '),
    items,
    confidence: conf === 'high' || conf === 'low' ? conf : 'medium',
    notes: str(raw?.notes),
  }
}

export function mealTotals(items: FoodItem[]) {
  return items.reduce((t, i) => ({
    calories: t.calories + (i.calories || 0),
    protein_g: r1(t.protein_g + (i.protein_g || 0)),
    carbs_g: r1(t.carbs_g + (i.carbs_g || 0)),
    fat_g: r1(t.fat_g + (i.fat_g || 0)),
    fiber_g: r1(t.fiber_g + (i.fiber_g || 0)),
  }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0 })
}

/** Change an item's portion: macros scale linearly with grams. */
export function scaleItem(item: FoodItem, grams: number): FoodItem {
  if (!item.grams || !(grams > 0)) return { ...item, grams: grams > 0 ? grams : item.grams }
  const f = grams / item.grams
  return {
    ...item,
    grams,
    calories: Math.round(item.calories * f),
    protein_g: r1(item.protein_g * f),
    carbs_g: r1(item.carbs_g * f),
    fat_g: r1(item.fat_g * f),
    fiber_g: r1(item.fiber_g * f),
  }
}

const SCHEMA = `Return ONLY a JSON object:
{
  "meal_name": "short name for the whole meal",
  "items": [
    {"name": "food item", "grams": 150, "calories": 248, "protein_g": 46.5, "carbs_g": 0, "fat_g": 5.4, "fiber_g": 0}
  ],
  "confidence": "high | medium | low",
  "notes": "one short sentence on anything uncertain"
}`

const RULES = `Method:
1. List every distinct food separately (e.g. rice, chicken, sauce, bread). Do not merge them.
2. Estimate each item's cooked/served weight in grams.
3. Compute macros from standard nutrition values per 100 g (USDA / German BLS) for that preparation.
4. If the food is visibly fried or shiny with oil, or the dish is normally cooked in oil, add the oil or butter as its own item with a realistic amount (usually 5-15 g). Do not invent oil for raw, boiled or plain foods.
5. Give your BEST estimate, not a high or low one. Calories must roughly equal 4×protein + 4×carbs + 9×fat for each item.
6. Packaged foods with a visible label: use the label values.`

export function foodPhotoPrompt() {
  return `You are a precise nutrition analyst. Identify the food in this photo and estimate its nutrition.
Use the plate (~26 cm), cutlery, hands or packaging in the photo as size references.
${RULES}
${SCHEMA}`
}

export function foodTextPrompt(description: string) {
  return `You are a precise nutrition analyst. Estimate the nutrition of this meal description.
If an amount is given (e.g. "2 eggs", "200 g rice", "1 Döner") use it; otherwise assume one typical portion.
Meal: "${description.slice(0, 500)}"
${RULES}
${SCHEMA}`
}
