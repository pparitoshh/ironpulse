import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function scanFoodImage(base64Image: string, mimeType: string) {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  const prompt = `Analyze this food image and estimate the nutritional content.
  
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

Be as accurate as possible based on visible portion sizes.`

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64Image,
        mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
      },
    },
    prompt,
  ])

  const text = result.response.text()
  const clean = text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}
