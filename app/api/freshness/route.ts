import { NextResponse, type NextRequest } from "next/server"
import fs from "node:fs"
import path from "node:path"
import { execFile } from "node:child_process"

export const runtime = 'nodejs'

function runPythonPredictor(imagePath: string, modelPath?: string): Promise<{ label?: string; probabilities?: Record<string, number>; error?: string }>
{
  return new Promise((resolve) => {
  const scriptPath = path.join(process.cwd(), 'FOOD-FRESHNESS-master', 'predict_cli.py')
  // Prefer project venv Python if present, else fall back to system python3
  const venvPython = path.join(process.cwd(), '.venv', 'bin', 'python')
  const python = fs.existsSync(venvPython) ? venvPython : (process.env.PYTHON || 'python3')
    const args = [scriptPath, '--image', imagePath]
    if (modelPath) args.push('--model', modelPath)

    execFile(python, args, { timeout: 20000 }, (err, stdout, stderr) => {
      if (err) {
        return resolve({ error: `predictor error: ${String(err.message || err)}` })
      }
      try {
        const parsed = JSON.parse(stdout?.toString() || '{}')
        if (parsed && parsed.label) return resolve({ label: parsed.label, probabilities: parsed.probabilities })
        return resolve({ error: parsed?.error || 'unknown predictor output' })
      } catch (e: any) {
        return resolve({ error: `parse error: ${e?.message || String(e)}` })
      }
    })
  })
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const file = form.get('image') as File | null
    if (!file) return NextResponse.json({ message: 'No image provided' }, { status: 400 })

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    fs.mkdirSync(uploadsDir, { recursive: true })
    const ext = (file as any).name ? String((file as any).name).split('.').pop() : 'jpg'
    const safeExt = ext && /^[a-zA-Z0-9]+$/.test(ext) ? ext : 'jpg'
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`
    const filePath = path.join(uploadsDir, filename)

    const arrayBuffer = await file.arrayBuffer()
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer))

    const modelPath = process.env.FOOD_FRESHNESS_MODEL || path.join(process.cwd(), 'FOOD-FRESHNESS-master', 'model.keras')
    const result = await runPythonPredictor(filePath, modelPath)

    // Graceful fallback if predictor unavailable
    if (result.error) {
      return NextResponse.json({
        message: 'Prediction unavailable',
        label: 'Unknown',
        probabilities: {},
        imageUrl: `/uploads/${filename}`,
        error: result.error,
      }, { status: 200 })
    }

    return NextResponse.json({
      message: 'Predicted',
      label: result.label,
      probabilities: result.probabilities || {},
      imageUrl: `/uploads/${filename}`,
    })
  } catch (e: any) {
    return NextResponse.json({ message: 'Internal server error', error: e?.message || String(e) }, { status: 500 })
  }
}
