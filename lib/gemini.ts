import { groq } from './groq'

export async function scanFoodImage(base64Image: string, mimeType: string) {
  const dataUrl = `data:${mimeType};base64,${base64Image}`

  const response = await (groq.chat.completions.create as any)({
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: dataUrl },
          },
          {
            type: 'text',
            text: `You are a precise nutrition analyst. Analyze this food image and estimate macros accurately.

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
}`,
          },
        ],
      },
    ],
    temperature: 0.3,
    max_tokens: 512,
  })

  const text = response.choices[0]?.message?.content || ''
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}
