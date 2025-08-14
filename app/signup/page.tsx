import { SignupForm } from "@/components/auth/signup-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Leaf, Sparkles } from "lucide-react"
import Link from "next/link"

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-emerald-50/30 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-20 left-10 w-32 h-32 bg-emerald-200/20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-10 w-40 h-40 bg-emerald-300/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
      <div className="absolute top-1/2 left-1/3 w-24 h-24 bg-emerald-400/10 rounded-full blur-2xl animate-pulse delay-500"></div>

      <div className="w-full max-w-2xl relative z-10">
        <div className="text-center mb-8 animate-slide-up">
          <Link href="/" className="inline-flex items-center gap-3 mb-6 hover-lift group">
            <div className="relative">
              <Leaf className="h-8 w-8 text-emerald-600 group-hover:scale-110 transition-transform duration-300" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
            </div>
            <span className="text-2xl font-serif font-black text-emerald-800 tracking-tight">FoodShare</span>
          </Link>
          <h1 className="text-3xl font-serif font-black text-slate-800 mb-3">Join FoodShare</h1>
          <p className="text-slate-600 leading-relaxed">Create an account to start reducing food waste</p>
        </div>

        <Card className="border-emerald-100 shadow-xl hover:shadow-2xl transition-all duration-300 animate-scale-in backdrop-blur-sm bg-white/95">
          <CardHeader className="space-y-2 p-6 sm:p-8">
            <CardTitle className="text-2xl font-serif font-bold text-center text-slate-800 flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              Create Account
            </CardTitle>
            <CardDescription className="text-center text-slate-600 leading-relaxed">
              Fill in your details to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 sm:p-8 pt-0">
            <SignupForm />
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-600 mt-8 animate-fade-in delay-300">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-emerald-600 hover:text-emerald-700 font-semibold transition-colors duration-300 hover:underline"
          >
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  )
}
