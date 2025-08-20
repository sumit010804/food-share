import { getDatabase } from "./mongodb"

// Lightweight ridge regression using gradient descent with feature scaling.
// This improves numerical stability for small datasets without adding heavy deps.

type FeatureInput = {
  expectedAttendees?: number
  eventType?: string
  dayOfWeek?: number
  hourOfDay?: number
  organizerId?: string
  location?: string
}

function mean(arr: number[]) {
  if (!arr.length) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function stddev(arr: number[], mu?: number) {
  if (!arr.length) return 0
  const m = mu ?? mean(arr)
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length
  return Math.sqrt(v) || 0
}

export async function trainAndPredictEvent(features: FeatureInput) {
  const db = await getDatabase()
  const rows: any[] = await db.collection("event_surplus_history").find({ actualSurplusKg: { $ne: null } }).toArray()

  // If too little data, fallback to per-type average or overall average
  if (!rows || rows.length < 6) {
    const byType: Record<string, { sum: number; count: number }> = {}
    let total = 0
    for (const r of rows || []) {
      const t = r.eventType || "unknown"
      byType[t] = byType[t] || { sum: 0, count: 0 }
      byType[t].sum += r.actualSurplusKg || 0
      byType[t].count += 1
      total += r.actualSurplusKg || 0
    }
    const requestedType = features.eventType || "unknown"
    if (byType[requestedType] && byType[requestedType].count > 0) {
      return { predictedKg: Math.round((byType[requestedType].sum / byType[requestedType].count) * 100) / 100 }
    }
    const overallAvg = rows && rows.length ? total / rows.length : 0
    return { predictedKg: Math.round(overallAvg * 100) / 100 }
  }

  // Build categorical vocabularies
  const eventTypes = Array.from(new Set(rows.map((r) => r.eventType).filter(Boolean)))
  const organizers = Array.from(new Set(rows.map((r) => r.organizerId).filter(Boolean)))

  // Build feature matrix X and target y
  const rawX: number[][] = []
  const y: number[] = []
  for (const r of rows) {
    const row: number[] = []
    // features: expectedAttendees, dayOfWeek, hourOfDay, eventType one-hot, organizer one-hot
    row.push(r.expectedAttendees || 0)
    row.push(typeof r.dayOfWeek === "number" ? r.dayOfWeek : 0)
    row.push(typeof r.hourOfDay === "number" ? r.hourOfDay : 0)
    for (const t of eventTypes) row.push(r.eventType === t ? 1 : 0)
    for (const o of organizers) row.push(r.organizerId === o ? 1 : 0)

    rawX.push(row)
    y.push(r.actualSurplusKg || 0)
  }

  const n = rawX.length
  const p = rawX[0]?.length || 0

  // feature scaling (compute mean/std per column)
  const means: number[] = []
  const stds: number[] = []
  for (let j = 0; j < p; j++) {
    const col = rawX.map((r) => r[j])
    const mu = mean(col)
    const sd = stddev(col, mu) || 1
    means.push(mu)
    stds.push(sd)
  }

  const X: number[][] = rawX.map((r) => r.map((v, j) => (v - means[j]) / stds[j]))

  // Add bias column (1) as first column (not scaled, not regularized)
  for (let i = 0; i < n; i++) X[i].unshift(1)

  const m = X[0].length // number of parameters

  // Initialize weights
  let weights = Array(m).fill(0)

  // Gradient descent hyperparams
  const lr = 0.05
  const iterations = 1200
  const lambda = 0.1 // ridge penalty (applied to weights except bias)

  // gradient descent loop
  for (let it = 0; it < iterations; it++) {
    const preds = new Array(n).fill(0)
    for (let i = 0; i < n; i++) {
      let s = 0
      const xi = X[i]
      for (let j = 0; j < m; j++) s += xi[j] * weights[j]
      preds[i] = s
    }

    // compute gradients
    const grads = Array(m).fill(0)
    for (let j = 0; j < m; j++) {
      let g = 0
      for (let i = 0; i < n; i++) {
        g += (preds[i] - y[i]) * X[i][j]
      }
      g = (2 / n) * g
      // regularize except bias (j===0)
      if (j !== 0) g += 2 * lambda * weights[j]
      grads[j] = g
    }

    // update weights
    for (let j = 0; j < m; j++) weights[j] -= lr * grads[j]
    // small adaptive stopping condition: if gradients very small, break
    const gnorm = Math.sqrt(grads.reduce((s, v) => s + v * v, 0))
    if (gnorm < 1e-4) break
  }

  // Build request feature vector (same ordering as rawX)
  const reqRaw: number[] = []
  reqRaw.push(features.expectedAttendees || 0)
  reqRaw.push(typeof features.dayOfWeek === "number" ? features.dayOfWeek : 0)
  reqRaw.push(typeof features.hourOfDay === "number" ? features.hourOfDay : 0)
  for (const t of eventTypes) reqRaw.push(features.eventType === t ? 1 : 0)
  for (const o of organizers) reqRaw.push(features.organizerId === o ? 1 : 0)

  // scale
  const reqScaled = reqRaw.map((v, j) => (v - means[j]) / stds[j])
  // add bias
  reqScaled.unshift(1)

  // predict
  let pred = 0
  for (let j = 0; j < weights.length; j++) pred += weights[j] * (reqScaled[j] ?? 0)

  const predicted = Math.max(0, Math.round(pred * 100) / 100)
  return { predictedKg: predicted }
}
