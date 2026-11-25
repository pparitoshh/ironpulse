import { askVisionJSON } from './ai'

export async function scanFoodImage(base64Image: string, mimeType: string) {
  return askVisionJSON(base64Image, mimeType, `You are a precise nutrition analyst. Analyze this food image and estimate macros accurately.

STEP 1 - IDENTIFY all food items visible:
- List every ingredient separately
- Identify cooking method (fried, boiled, grilled, air-fried)
- Estimate plate/portion size (small/medium/large)

STEP 2 - ESTIMATE portions using visual cues:
- Use standard plate size (25-28cm) as reference
- Estimate weight in grams per item
- A fist = ~150g carbs, palm = ~120g protein, thumb = ~15g fat

STEP 3 - CRITICAL: Always account for hidden calories:
- Cooking oil: +150-200 kcal per dish unless stated otherwise
- Sauces/marinades: +50-100 kcal
- If stir-fried: assume 1-2 tbsp oil used

STEP 4 - Calculate using USDA standards per 100g:
- Identify each ingredient
- Apply portion weight
- Sum all items

ACCURACY RULES:
- Never underestimate oil/fat from cooking
- Mixed dishes → estimate conservatively high
- If uncertain about portion → use the higher estimate
- Always flag low-confidence items

Return ONLY valid JSON with no markdown:
{
  "food_name": "descriptive name of what you see",
  "calories": 350,
  "protein_g": 25,
  "carbs_g": 40,
  "fat_g": 8,
  "quantity": "estimated portion size with weight in grams",
  "items_detected": [
    {"item": "item name", "weight_g": 150, "calories": 200, "protein_g": 15, "carbs_g": 20, "fat_g": 5}
  ],
  "confidence": "high/medium/low",
  "notes": "any flags about hidden calories or uncertain items"
}`)
}
