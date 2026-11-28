import { askVisionJSON } from './ai'
import { foodPhotoPrompt, normalizeMeal } from './food'

/** Food photo -> Meal (items with grams + macros). */
export async function scanFoodImage(base64Image: string, mimeType: string) {
  return normalizeMeal(await askVisionJSON('food_photo', base64Image, mimeType, foodPhotoPrompt()))
}
