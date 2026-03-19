// BMR + aktivitetstillegg basert på planlagt TSS fra Intervals

type CalorieInput = {
  weightKg: number
  heightCm: number
  age: number
  plannedTss: number    // dagens planlagte treningsbelastning
  sport?: string        // primær sport i dag
}

// Mifflin-St Jeor BMR (menn og kvinner er like om vi ikke har kjønn)
function bmr(weightKg: number, heightCm: number, age: number): number {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + 5 // +5 = mann, -161 = kvinne
}

// TSS → approx kcal ekstra (ca 4–6 kcal/TSS avhengig av sport)
function tssToKcal(tss: number, sport?: string): number {
  if (!tss || tss <= 0) return 0
  const factor = sport === 'Swim' ? 5.5 : sport === 'Run' ? 5.0 : 4.5
  return Math.round(tss * factor)
}

export function estimateCalories(input: CalorieInput): {
  bmr: number
  training: number
  total: number
  carbs: number
  protein: number
  fat: number
} {
  const baseBmr = Math.round(bmr(input.weightKg, input.heightCm, input.age))
  // Stillesittende jobb: NEAT-faktor 1.4
  const neat = Math.round(baseBmr * 1.4)
  const training = tssToKcal(input.plannedTss, input.sport)
  const total = neat + training

  // Makroer: 50% karbo, 20% protein, 30% fett
  const carbs = Math.round((total * 0.50) / 4)
  const protein = Math.round((total * 0.20) / 4)
  const fat = Math.round((total * 0.30) / 9)

  return { bmr: neat, training, total, carbs, protein, fat }
}
