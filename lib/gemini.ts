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
            text: `Analyze this food image and estimate the nutritional content.

Return ONLY valid JSON with no markdown:
{
  "food_name": "descriptive name of what you see",
  "calories": 350,
  "protein_g": 25,
  "carbs_g": 40,
  "fat_g": 8,
  "quantity": "estimated portion size",
  "items_detected": ["item1", "item2"]
}

Be as accurate as possible based on visible portion sizes.`,
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
