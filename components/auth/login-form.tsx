"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react"
import { useRouter } from "next/navigation"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")
    const validateEmail = (email: string) => {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return re.test(String(email).trim().toLowerCase())
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address")
      setIsLoading(false)
      return
    }
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
  body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })

      const data = await response.json()

      if (response.ok) {
        // Store user data in localStorage (in a real app, use proper session management)
        localStorage.setItem("user", JSON.stringify(data.user))
        router.push("/dashboard")
      } else {
        setError(data.message || "Login failed")
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="animate-fade-in">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <Alert variant="destructive" className="animate-slide-up border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3 animate-slide-up delay-100">
          <Label htmlFor="email" className="text-slate-700 font-medium">
            Email
          </Label>
          <div className="relative group">
            <Mail
              className={`absolute left-3 top-3 h-5 w-5 transition-all duration-300 ${
                focusedField === "email" ? "text-emerald-600 scale-110" : "text-slate-400"
              }`}
            />
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              className={`pl-12 h-12 transition-all duration-300 border-2 ${
                focusedField === "email"
                  ? "border-emerald-300 shadow-lg shadow-emerald-100 scale-[1.02]"
                  : "border-slate-200 hover:border-emerald-200"
              } focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100`}
              required
            />
          </div>
        </div>

        <div className="space-y-3 animate-slide-up delay-200">
          <Label htmlFor="password" className="text-slate-700 font-medium">
            Password
          </Label>
          <div className="relative group">
            <Lock
              className={`absolute left-3 top-3 h-5 w-5 transition-all duration-300 ${
                focusedField === "password" ? "text-emerald-600 scale-110" : "text-slate-400"
              }`}
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
              className={`pl-12 pr-12 h-12 transition-all duration-300 border-2 ${
                focusedField === "password"
                  ? "border-emerald-300 shadow-lg shadow-emerald-100 scale-[1.02]"
                  : "border-slate-200 hover:border-emerald-200"
              } focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100`}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 h-5 w-5 text-slate-400 hover:text-emerald-600 transition-all duration-300 hover:scale-110"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full h-12 gradient-primary text-white font-semibold hover-lift shadow-lg hover:shadow-emerald-200 transition-all duration-300 animate-slide-up delay-300 group"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              <span className="animate-pulse">Signing in...</span>
            </>
          ) : (
            <>
              <span className="group-hover:scale-105 transition-transform duration-200">Sign In</span>
            </>
          )}
        </Button>
      </form>
    </div>
  )
}
